"""Liste de puissance des starters, mesurée dans le simulateur.

Demande de Carlos (03/10) : que l'IA construise elle-même l'équipe de départ, avec une grande base de
starters, en conseillant celle qui a le plus de chances de gagner. Avant les IV, natures, talents et
passifs, il faut savoir ce que vaut chaque espèce en vrai : chaque starter (572 espèces, liste et
coûts tirés du jeu : entraineur/donnees_starters.json) joue N parties comme porteur (1er de l'équipe),
avec deux starters régionaux tirés au hasard, jusqu'à la vague --vague-max. On note la vague atteinte
et les rivaux passés. Compte neuf : IV 15, nature neutre (les vrais IV viendront en plus).

Usage : .venv/bin/python -m entraineur.liste_puissance [--parties 12] [--vague-max 60] [--processus 10]
Résultats au fil de l'eau : /Volumes/Lexar/pokerogue-bot/puissance/<date>.jsonl (une ligne par partie).
"""
from __future__ import annotations

import argparse
import json
import random
import threading
from datetime import datetime
from pathlib import Path

import torch

from .ensemble import STARTERS_COMPTE_NEUF
from .entrainer import Entrainement
from .format_cerveau import lire
from .pont import Etat, Pont

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V5 = LEXAR / "cerveaux" / "v5-2026-10-01.cerveau"
STARTERS = {int(k): v for k, v in json.loads((Path(__file__).parent / "donnees_starters.json").read_text()).items()}


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("--parties", type=int, default=12, help="parties par espèce")
    parametres.add_argument("--vague-max", type=int, default=60)
    parametres.add_argument("--processus", type=int, default=10)
    parametres.add_argument("--especes", type=int, nargs="*", help="seulement ces espèces")
    args = parametres.parse_args()
    cerveau, _ = lire(V5)
    cerveau.eval()
    torch.set_num_threads(1)
    hasard = random.Random(3)
    especes = args.especes or sorted(STARTERS)
    a_faire = [(e, k) for k in range(args.parties) for e in especes]  # une passe complète avant la suivante
    sortie = LEXAR / "puissance" / f"{datetime.now():%Y-%m-%d-%Hh%M}.jsonl"
    sortie.parent.mkdir(exist_ok=True)
    print(f"{len(especes)} espèces × {args.parties} parties → {sortie}", flush=True)
    verrou = threading.Lock()
    faites = [0]

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                espece, k = a_faire.pop(0)
                partenaires = hasard.sample([s for s in STARTERS_COMPTE_NEUF if s != espece], 2)
            simulateur = pont.entretenir(i)
            try:
                etat = simulateur.nouvelle_partie(especes=[espece, *partenaires], vague_max=args.vague_max, style_combat="changer")
                while isinstance(etat, Etat):
                    plan = None if etat.plan is None else torch.from_numpy(etat.plan)
                    action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=False, plan=plan)
                    etat = simulateur.agir(action)
                info = etat.info
            except (TimeoutError, ConnectionError, OSError) as erreur:
                pont.redemarrer(i)
                info = {"erreur": f"copie figée ({type(erreur).__name__})"}
            ligne = {"espece": espece, "nom": STARTERS[espece][0], "cout": STARTERS[espece][1], "partenaires": partenaires,
                     "vague": info.get("vague"), "tronquee": info.get("tronquee"), "erreur": info.get("erreur")}
            with verrou:
                Entrainement.patienter_disque(lambda: open(sortie, "a", encoding="utf-8").write(json.dumps(ligne) + "\n"))
                faites[0] += 1
                if faites[0] % 200 == 0:
                    print(f"  {faites[0]} parties", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    print("Fini.", flush=True)


if __name__ == "__main__":
    main()
