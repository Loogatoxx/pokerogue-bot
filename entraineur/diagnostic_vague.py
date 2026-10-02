"""D'où vient une défaite : de l'équipe qui arrive à la vague, ou du combat lui-même ?

Pour chaque partie perdue à la vague V (même graine, mêmes starters) :
1. le cerveau rejoue la partie jusqu'au début de la vague V ; on photographie son équipe ;
2. depuis cette photo, la vague est rejouée 8 fois avec son meilleur coup (hasard différent à
   chaque fois), puis 8 fois en tirant au sort parmi des coups proches du meilleur.
Si son meilleur coup perd souvent là où d'autres coups gagnent, c'est le combat qui est mal joué ;
si rien ne gagne depuis cette photo, l'équipe arrivait déjà condamnée (décisions d'avant).

Usage : .venv/bin/python -m entraineur.diagnostic_vague <analyse.json> [--vague 8] [--nombre 24]
"""
from __future__ import annotations

import argparse
import json
import threading
from pathlib import Path

import torch

from .format_cerveau import lire
from .pont import Etat, Pont
from .professeur import jouer_essai

# Contre un dresseur, les valeurs du combat d'équipe sont amplifiées (× 30, puis × 30 par le poids du
# plan) : pour varier vraiment les coups, il faut des températures bien plus fortes qu'ailleurs.
TEMPERATURES_VARIEES = (30.0, 100.0, 300.0)


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
    resultats: list[dict] = []
    verrou = threading.Lock()
    a_faire = list(perdues)
    V = args.vague

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                p = a_faire.pop(0)
            s = pont.entretenir(i)
            # 1. Le cerveau jusqu'au début de la vague V.
            etat = s.nouvelle_partie(especes=p["starters"], graine=p["graine"], photos=[V], vague_max=V - 1, style_combat="changer")
            while isinstance(etat, Etat):
                plan = None if etat.plan is None else torch.from_numpy(etat.plan)
                action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=False, plan=plan)
                etat = s.agir(action)
            photo = etat.info.get("photos", {}).get(str(V))
            if not photo:
                with verrou:
                    resultats.append({"graine": p["graine"], "arrive": False})
                continue
            # 2. La vague V depuis cette photo : meilleur coup, puis coups variés.
            meilleurs = [jouer_essai(pont.entretenir(i), cerveau, photo, V, 0.0, graine=p["graine"]).gagne for _ in range(args.essais)]
            varies = [jouer_essai(pont.entretenir(i), cerveau, photo, V, TEMPERATURES_VARIEES[k % 3], graine=p["graine"]).gagne
                      for k in range(args.essais)]
            ligne = {"graine": p["graine"], "arrive": True, "meilleurCoup": sum(meilleurs), "coupsVaries": sum(varies)}
            with verrou:
                resultats.append(ligne)
                print(f"  {p['graine']} : meilleur coup gagne {ligne['meilleurCoup']}/{args.essais}, "
                      f"coups variés {ligne['coupsVaries']}/{args.essais}", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    arrives = [r for r in resultats if r["arrive"]]
    n = max(1, len(arrives) * args.essais)
    print(f"\n{len(arrives)} parties arrivées à la vague {V} (sur {len(resultats)}).")
    print(f"Depuis l'équipe du cerveau : son meilleur coup gagne {100 * sum(r['meilleurCoup'] for r in arrives) / n:.0f} % des combats, "
          f"des coups variés {100 * sum(r['coupsVaries'] for r in arrives) / n:.0f} %.")
    print(f"Parties où rien ne gagne depuis cette photo (équipe condamnée) : "
          f"{sum(1 for r in arrives if r['meilleurCoup'] == 0 and r['coupsVaries'] == 0)}")


if __name__ == "__main__":
    main()
