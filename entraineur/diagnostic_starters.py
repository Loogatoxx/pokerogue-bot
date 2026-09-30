"""Diagnostic : le cerveau joue-t-il aussi bien avec d'autres starters ?

Pendant l'entraînement, le simulateur donne toujours Bulbizarre, Salamèche et Carapuce. Ce script
fait jouer un cerveau (en « meilleur coup », comme le mode auto de l'extension) avec plusieurs
trios de starters, et compte ce qu'il fait à chaque décision de combat : attaquer, changer de
Pokémon ou lancer une Ball. Un cerveau qui a trop appris sur un seul trio se trahit par une
vague moyenne qui s'effondre et une part de changements qui explose.

Usage :
  .venv/bin/python -m entraineur.diagnostic_starters <fichier.cerveau> [--parties 16]
"""
from __future__ import annotations

import argparse
import threading
from collections import Counter

import numpy as np
import torch

from .format_cerveau import lire
from .pont import Etat, Pont
from .reseau import Cerveau

# Numéros du Pokédex national (ce sont les SpeciesId du jeu).
TRIOS = {
    "Kanto (entraînement)": [1, 4, 7],  # Bulbizarre, Salamèche, Carapuce
    "Johto": [152, 155, 158],  # Germignon, Héricendre, Kaiminus
    "Hoenn": [252, 255, 258],  # Arcko, Poussifeu, Gobou
    "Sinnoh": [387, 390, 393],  # Tortipouss, Ouisticram, Tiplouf
    "Galar": [810, 813, 816],  # Ouistempo, Flambino, Larméléon
    "Un seul (Tiplouf)": [393],
}
PREMIER_CHANGEMENT, PREMIERE_BALL = 8, 14


def type_action(action: int) -> str:
    return "attaque" if action < PREMIER_CHANGEMENT else "changement" if action < PREMIERE_BALL else "ball"


def jouer_trio(pont: Pont, cerveau: Cerveau, especes: list[int], nombre: int) -> tuple[list[dict], Counter]:
    """Joue `nombre` parties avec ces starters ; renvoie les fins de partie et le décompte des actions
    prises aux décisions de combat où attaquer ET changer étaient permis (un vrai choix)."""
    resultats: list[dict] = []
    actions: Counter = Counter()
    verrou = threading.Lock()
    restantes = [nombre]

    def boucle(simulateur) -> None:
        while True:
            with verrou:
                if restantes[0] <= 0:
                    return
                restantes[0] -= 1
            etat = simulateur.nouvelle_partie(especes=especes)
            while isinstance(etat, Etat):
                masque = etat.masque
                action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(masque), tirage=False)
                vrai_choix = masque[:PREMIER_CHANGEMENT].any() and masque[PREMIER_CHANGEMENT:PREMIERE_BALL].any()
                if vrai_choix:
                    with verrou:
                        actions[type_action(action)] += 1
                etat = simulateur.agir(action)
            with verrou:
                resultats.append(etat.info)

    fils = [threading.Thread(target=boucle, args=(s,)) for s in pont.simulateurs]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    return resultats, actions


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=lambda s: __import__("pathlib").Path(s))
    parametres.add_argument("--parties", type=int, default=16, help="parties par trio")
    parametres.add_argument("--processus", type=int, default=8)
    args = parametres.parse_args()
    torch.set_num_threads(2)

    cerveau, entete = lire(args.cerveau)
    cerveau.eval()
    print(f"Cerveau : {entete['nom']} — {args.parties} parties par trio, meilleur coup\n")
    print(f"{'trio':24}{'vague moy.':>11}{'médiane':>9}{'max':>5}{'attaques':>10}{'changements':>13}{'balls':>7}")
    with Pont(args.processus) as pont:
        for nom, especes in TRIOS.items():
            resultats, actions = jouer_trio(pont, cerveau, especes, args.parties)
            vagues = np.array([r["vague"] for r in resultats])
            total = max(sum(actions.values()), 1)
            part = {k: f"{100 * actions[k] / total:.0f} %" for k in ("attaque", "changement", "ball")}
            print(f"{nom:24}{vagues.mean():>11.2f}{np.median(vagues):>9.1f}{vagues.max():>5}"
                  f"{part['attaque']:>10}{part['changement']:>13}{part['ball']:>7}", flush=True)


if __name__ == "__main__":
    main()
