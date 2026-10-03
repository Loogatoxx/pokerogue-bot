"""Résumer les mesures de puissance (entraineur/liste_puissance.py) en table de forces pour le
constructeur d'équipe (observateur/puissance-starters.ts).

Force d'une espèce = sa vague moyenne comme porteur, tirée vers la moyenne générale quand elle a peu
de parties (moyenne « bayésienne » : on ajoute K parties fictives à la moyenne générale), pour qu'un
coup de chance isolé ne la propulse pas en tête. Plusieurs fichiers (ex. une passe arrêtée à la
vague 60, puis une passe sans limite pour les meilleurs) : la dernière mesure d'une espèce l'emporte.

Usage : .venv/bin/python -m entraineur.resumer_puissance [fichiers.jsonl…]
"""
from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
SORTIE = Path(__file__).resolve().parent.parent / "observateur" / "puissance-starters.ts"
K = 3


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("fichiers", type=Path, nargs="*")
    args = parametres.parse_args()
    fichiers = args.fichiers or sorted((LEXAR / "puissance").glob("2*.jsonl"))[-1:]
    forces: dict[int, float] = {}
    noms: dict[int, str] = {}
    for f in fichiers:
        par: dict[int, list[int]] = defaultdict(list)
        for ligne in f.read_text(encoding="utf-8").splitlines():
            x = json.loads(ligne)
            if x.get("vague") and not x.get("erreur"):
                par[x["espece"]].append(x["vague"])
                noms[x["espece"]] = x["nom"]
        if not par:
            continue
        moyenne = statistics.mean(v for vs in par.values() for v in vs)
        for e, vs in par.items():
            forces[e] = (sum(vs) + K * moyenne) / (len(vs) + K)
        print(f"{f.name} : {len(par)} espèces, {sum(len(v) for v in par.values())} parties, moyenne {moyenne:.1f}")
    lignes = ["// Fichier GÉNÉRÉ par entraineur/resumer_puissance.py — ne pas modifier à la main.",
              "/** Force mesurée de chaque starter comme porteur : vague moyenne atteinte (tirée vers la moyenne",
              " * quand il a peu de parties). Mesures : simulateur, IV 15, nature neutre, 2 starters régionaux au hasard. */",
              "export const PUISSANCE_STARTERS: Readonly<Record<number, number>> = {"]
    lignes += [f"  {e}: {forces[e]:.1f}, // {noms[e]}" for e in sorted(forces)]
    lignes += ["};", ""]
    SORTIE.write_text("\n".join(lignes), encoding="utf-8")
    meilleurs = sorted(forces, key=forces.get, reverse=True)[:20]
    print("Les 20 plus forts :", ", ".join(f"{noms[e]} {forces[e]:.0f}" for e in meilleurs))
    print(f"Table : {SORTIE}")


if __name__ == "__main__":
    main()
