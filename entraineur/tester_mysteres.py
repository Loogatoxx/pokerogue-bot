"""Tester chaque rencontre mystère une par une : le mode auto passe-t-il sans bloquer ?

Carlos (01/10) : « il bloque encore sur les PNJ qui proposent des objets ». Le jeu compte
31 rencontres mystères ; l'outil de test les coupe. Ici, chacune est forcée à chaque vague où elle
peut apparaître, le temps de quelques parties courtes, avec le cerveau et le pilote du mode auto.

Usage : .venv/bin/python -m entraineur.tester_mysteres [cerveau] [--parties 2] [--vague-max 25]
"""
from __future__ import annotations

import argparse
import random
import re
import threading
from collections import Counter
from pathlib import Path

import torch

from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .pont import Etat, Pont

RACINE = Path(__file__).resolve().parent.parent
V5 = Path("/Volumes/Lexar/pokerogue-bot/cerveaux/v5-2026-10-01.cerveau")


def rencontres() -> list[str]:
    texte = (RACINE / "jeu/src/enums/mystery-encounter-type.ts").read_text(encoding="utf-8")
    return re.findall(r"^\s+([A-Z][A-Z_]+),", texte, flags=re.M)


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path, nargs="?", default=V5)
    parametres.add_argument("--parties", type=int, default=2, help="parties par rencontre")
    parametres.add_argument("--vague-max", type=int, default=25)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--seulement", nargs="*", help="noms de rencontres à tester (par défaut : toutes)")
    args = parametres.parse_args()
    torch.set_num_threads(2)
    cerveau, _ = lire(args.cerveau)
    cerveau.eval()
    a_faire = [(nom, n) for nom in (args.seulement or rencontres()) for n in range(args.parties)]
    resultats: dict[str, list[dict]] = {}
    verrou = threading.Lock()
    hasard = random.Random(1)

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                nom, _ = a_faire.pop(0)
                especes = hasard.sample(STARTERS_COMPTE_NEUF, 3)
            simulateur = pont.entretenir(i)
            try:
                etat = simulateur.nouvelle_partie(especes=especes, vague_max=args.vague_max, mystere=nom, style_combat="changer")
                while isinstance(etat, Etat):
                    action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=False,
                                                plan=None if etat.plan is None else torch.from_numpy(etat.plan))
                    etat = simulateur.agir(action)
                fin = etat.info
            except (TimeoutError, ConnectionError, OSError) as erreur:
                pont.redemarrer(i)
                fin = {"erreur": f"copie figée ({type(erreur).__name__})", "vague": "?"}
            with verrou:
                resultats.setdefault(nom, []).append(fin)
                print(f"  {nom:28} vague {fin.get('vague')}" + (f" — ERREUR : {fin['erreur']}" if "erreur" in fin else ""), flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    print("\nBilan :")
    bloquees = 0
    for nom in sorted(resultats):
        fins = resultats[nom]
        erreurs = [f["erreur"] for f in fins if "erreur" in f]
        bloquees += bool(erreurs)
        regles = Counter(k for f in fins for k in f.get("regles", {}))
        print(f"  {'BLOQUE' if erreurs else 'ok    '} {nom:28} vagues {[f.get('vague') for f in fins]}"
              + (f" · {erreurs[0]}" if erreurs else "") + (" · option de rencontre" if regles.get("option") else ""))
    print(f"\n{bloquees} rencontre(s) bloquante(s) sur {len(resultats)}.")


if __name__ == "__main__":
    main()
