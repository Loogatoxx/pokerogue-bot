"""Rejouer une partie perdue « parfaitement » : était-elle gagnable, et qu'est-ce qui a manqué ?

Idée de Carlos (02/10) : reprendre la graine d'une partie perdue et la faire jouer au mieux ; si
même la partie parfaite perd, on cherche ailleurs ; si elle gagne, comparer pour voir d'où vient
l'erreur. Le professeur (entraineur/professeur.py) rejoue la même partie (même graine, mêmes
starters : mêmes rencontres) en gardant le meilleur de plusieurs essais à chaque vague et en
reculant face à un mur. On compare son équipe au début de la vague perdue avec celle du cerveau.

Usage : .venv/bin/python -m entraineur.rejouer_defaites <analyse.json> [--vague 8] [--nombre 24]
"""
from __future__ import annotations

import argparse
import json
import re
import threading
from pathlib import Path

import torch

from .format_cerveau import lire
from .pont import Pont
from .professeur import partie_du_professeur

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
RACINE = Path(__file__).resolve().parent.parent


def noms_especes() -> dict[int, str]:
    texte = (RACINE / "observateur/donnees-especes.ts").read_text(encoding="utf-8")
    texte = texte[texte.index("export const ESPECES"):texte.index("export const ATTAQUES")]  # pas les talents
    return {int(m.group(1)): m.group(2) for m in re.finditer(r'^  (\d+): \["([^"]*)", \[', texte, re.M) if int(m.group(1)) <= 1025}


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("analyse", type=Path)
    parametres.add_argument("--vague", type=int, default=8)
    parametres.add_argument("--nombre", type=int, default=24)
    parametres.add_argument("--essais", type=int, default=8)
    parametres.add_argument("--processus", type=int, default=8)
    args = parametres.parse_args()
    donnees = json.load(open(args.analyse))
    cerveau, _ = lire(Path(donnees["cerveau"]))
    cerveau.eval()
    torch.set_num_threads(1)
    perdues = [p for p in donnees["parties"] if "erreur" not in p and p["vague"] == args.vague and not p.get("tronquee")][: args.nombre]
    noms = noms_especes()
    resultats: list[dict] = []
    verrou = threading.Lock()
    a_faire = list(perdues)

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                p = a_faire.pop(0)
            r = partie_du_professeur(pont, i, cerveau, args.essais, args.vague, p["starters"], p["graine"])
            r.pop("exemples")
            debut = [t for t in p.get("journalCombat", []) if t["vague"] == args.vague]
            ligne = {
                "graine": p["graine"], "gagnee": r["mur"] is None, "murs": r["murs"],
                "cerveau": debut[0]["equipe"] if debut else [],
                "rival": debut[0]["adversaires"] if debut else [],
                "professeur": [f"{noms.get(m['espece'], m['espece'])} N.{m['niveau']} {round(100 * m['pv'] / max(m['pvMax'], 1))} %"
                               for m in r["equipes"].get(args.vague, [])],
            }
            with verrou:
                resultats.append(ligne)
                print(f"{'GAGNÉE ' if ligne['gagnee'] else 'perdue '} {p['graine']} | rival : {', '.join(ligne['rival'])}\n"
                      f"    cerveau    : {', '.join(ligne['cerveau'])}\n    professeur : {', '.join(ligne['professeur'])}"
                      f"{'  (murs : ' + str(ligne['murs']) + ')' if ligne['murs'] else ''}", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    gagnees = sum(r["gagnee"] for r in resultats)
    print(f"\n{gagnees} parties sur {len(resultats)} gagnables par le professeur à la vague {args.vague}.")
    sortie = LEXAR / "analyses" / f"rejeu-{args.analyse.stem}-v{args.vague}.json"
    sortie.write_text(json.dumps(resultats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Détails : {sortie}")


if __name__ == "__main__":
    main()
