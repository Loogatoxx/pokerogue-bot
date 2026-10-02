"""Juge ciblé : à une vague donnée (le rival 1 par défaut), quels coups le cerveau rate-t-il ?

Pour chaque partie (starters et graine au hasard) : le cerveau joue jusqu'au début de la vague ;
puis, depuis cette photo et avec le hasard du jeu (mêmes coups, même résultat), chaque décision du
combat est jugée : tous les coups permis (attaques et changements) sont joués à cet instant, la vague
est finie sur 3 avenirs, et le meilleur en moyenne est comparé au coup du cerveau. Les écarts sont
classés (attaque résistée au lieu d'une plus forte, changement manqué, changement inutile…).

Usage : .venv/bin/python -m entraineur.juge_cible [--vague 8] [--parties 80]
"""
from __future__ import annotations

import argparse
import json
import random
import string
import threading
from collections import Counter
from datetime import datetime
from pathlib import Path

import numpy as np
import torch

from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .juge import jouer, scores_de
from .pont import Etat, Pont

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V5 = LEXAR / "cerveaux" / "v5-2026-10-01.cerveau"
AVENIRS = 3


def force(c: dict | None) -> float:
    """Force attendue d'une attaque : puissance × efficacité × 1,5 si même type (0 pour le statut)."""
    if not c or c.get("genre") != "attaque" or c.get("statut"):
        return 0.0
    return c["puissance"] * c["efficacite"] * (1.5 if c["memeType"] else 1)


def classer(habituel: dict | None, meilleur: dict | None) -> str:
    h, m = (habituel or {}).get("genre"), (meilleur or {}).get("genre")
    if h == "attaque" and m == "attaque":
        if habituel.get("statut") and not meilleur.get("statut"):
            return "statut au lieu d'attaquer"
        if not habituel.get("statut") and meilleur.get("statut"):
            return "aurait dû utiliser une attaque de statut"
        if habituel["efficacite"] < 1 and force(meilleur) > force(habituel):
            return "attaque résistée au lieu d'une plus forte"
        if force(meilleur) > force(habituel):
            return "attaque plus faible que possible"
        return "autre attaque (moins forte mais meilleure)"
    if h == "attaque" and m == "changement":
        return "aurait dû changer de Pokémon"
    if h == "changement" and m == "attaque":
        return "a changé au lieu d'attaquer"
    if h == "changement" and m == "changement":
        return "mauvais Pokémon envoyé"
    return f"{h} → {m}"


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path, nargs="?", default=V5)
    parametres.add_argument("--vague", type=int, default=8)
    parametres.add_argument("--parties", type=int, default=80)
    parametres.add_argument("--processus", type=int, default=8)
    args = parametres.parse_args()
    cerveau, _ = lire(args.cerveau)
    cerveau.eval()
    torch.set_num_threads(1)
    V = args.vague
    hasard = random.Random(42)
    a_faire = [(hasard.sample(STARTERS_COMPTE_NEUF, 3), "".join(hasard.choices(string.ascii_lowercase + string.digits, k=10)))
               for _ in range(args.parties)]
    verrou = threading.Lock()
    corrections: list[dict] = []
    bilan = Counter()

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                especes, graine = a_faire.pop(0)
            s = pont.entretenir(i)
            etat = s.nouvelle_partie(especes=especes, graine=graine, photos=[V], vague_max=V - 1, style_combat="changer")
            while isinstance(etat, Etat):
                etat = s.agir(int(scores_de(cerveau, etat).argmax()))
            photo = etat.info.get("photos", {}).get(str(V))
            if not photo:
                continue
            reel = jouer(pont.entretenir(i), cerveau, V, graine, photo, None, recit=True)
            perdu_avant = not reel.gagne
            ici = []
            for d, e in enumerate(reel.etats):
                coups = e.info.get("coups") or []
                permis = [a for a, c in enumerate(coups) if c and c.get("genre") in ("attaque", "changement")]
                if len(permis) < 2:
                    continue
                q = {}
                for a in permis:
                    vals = [jouer(pont.entretenir(i), cerveau, V, graine, photo, None, reel.actions[:d], a, f"{graine}-{d}-{r}").valeur
                            for r in range(AVENIRS)]
                    q[a] = float(np.mean(vals))
                habituel = reel.actions[d]
                meilleur = max(q, key=q.get)
                if q[meilleur] - q.get(habituel, q[meilleur]) > 0.3:
                    ici.append({"graine": graine, "decision": d, "ecart": round(q[meilleur] - q[habituel], 2),
                                "habituel": coups[habituel], "meilleur": coups[meilleur],
                                "categorie": classer(coups[habituel], coups[meilleur]),
                                "gagneHabituel": q[habituel] > -4, "gagneMeilleur": q[meilleur] > -4})
            with verrou:
                bilan["combats"] += 1
                bilan["perdus"] += perdu_avant
                corrections.extend(ici)
                for c in ici:
                    bilan[c["categorie"]] += 1
                print(f"  {graine} : {'perdu' if perdu_avant else 'gagné'}, {len(ici)} erreurs nettes", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    print(f"\n{bilan['combats']} combats à la vague {V} jugés, {bilan['perdus']} perdus par le cerveau.")
    print("Erreurs nettes (le meilleur coup vaut 0,3 de plus en moyenne), par catégorie :")
    for cle, n in bilan.most_common():
        if cle not in ("combats", "perdus"):
            print(f"  {n:4}  {cle}")
    sortie = LEXAR / "analyses" / f"juge-cible-v{V}-{datetime.now():%Y-%m-%d-%Hh%M}.json"
    sortie.write_text(json.dumps(corrections, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Détails : {sortie}")


if __name__ == "__main__":
    main()
