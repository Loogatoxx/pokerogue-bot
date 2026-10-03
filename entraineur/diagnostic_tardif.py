"""D'où viennent les défaites de fin de partie (vagues 100+) : du combat, ou de l'équipe qui arrive ?

Comme diagnostic_vague.py pour le rival 1, mais depuis les photos du banc tardif (banc_tardif.py) :
pour chaque photo de la vague 100, le bot rejoue (hasard du jeu, graine fixe : la partie est
reproductible) jusqu'à sa défaite à la vague D ; on rejoue alors la même partie en photographiant le
début de la vague D ; depuis cette photo, la vague D est rejouée 8 fois avec le meilleur coup du bot
(hasard différent à chaque fois), puis 8 fois avec des coups variés. Si son meilleur coup perd là où
d'autres gagnent, c'est le combat qui est mal joué ; si rien ne gagne, l'équipe arrivait condamnée.

Usage : .venv/bin/python -m entraineur.diagnostic_tardif [--photos 30] [--processus 10]
"""
from __future__ import annotations

import argparse
import collections
import json
import threading
from pathlib import Path

import torch

from .banc_tardif import BANC, V5, jouer
from .format_cerveau import lire
from .pont import Pont
from .professeur import jouer_essai

TEMPERATURES = (30.0, 100.0, 300.0)  # valeurs du moteur amplifiées (× 900) : il faut de fortes températures


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("--vague", type=int, default=100)
    parametres.add_argument("--photos", type=int, default=30)
    parametres.add_argument("--essais", type=int, default=8)
    parametres.add_argument("--processus", type=int, default=10)
    args = parametres.parse_args()
    cerveau, _ = lire(V5)
    cerveau.eval()
    torch.set_num_threads(1)
    photos = [json.loads(l) for l in (BANC / f"tardif-{args.vague}.jsonl").read_text(encoding="utf-8").splitlines()][: args.photos]
    a_faire = list(enumerate(photos))
    verrou = threading.Lock()
    resultats: list[dict] = []
    murs = collections.Counter()

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                k, p = a_faire.pop(0)
            graine = f"diag-{k}"
            try:
                fin = jouer(pont.entretenir(i), cerveau, depart=p["photo"], graine=graine, hasard_du_jeu=True)
                d = fin.get("vague", 0)
                if fin.get("erreur") or d > 200:
                    continue
                refait = jouer(pont.entretenir(i), cerveau, depart=p["photo"], graine=graine, hasard_du_jeu=True, photos=[d])
                photo_d = refait.get("photos", {}).get(str(d))
                if not photo_d:
                    continue
                meilleurs = sum(jouer_essai(pont.entretenir(i), cerveau, photo_d, d, 0.0, graine=f"{graine}-m{e}").gagne
                                for e in range(args.essais))
                varies = sum(jouer_essai(pont.entretenir(i), cerveau, photo_d, d, TEMPERATURES[e % 3], graine=f"{graine}-v{e}").gagne
                             for e in range(args.essais))
            except (TimeoutError, ConnectionError, OSError):
                pont.redemarrer(i)
                continue
            with verrou:
                resultats.append({"photo": k, "vague": d, "meilleurCoup": meilleurs, "coupsVaries": varies})
                murs[d] += 1
                print(f"  photo {k} : défaite à la vague {d} · meilleur coup gagne {meilleurs}/{args.essais}, "
                      f"coups variés {varies}/{args.essais}", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    n = len(resultats)
    condamnees = sum(r["meilleurCoup"] == 0 and r["coupsVaries"] == 0 for r in resultats)
    mal_jouees = sum(r["meilleurCoup"] < args.essais / 2 and r["coupsVaries"] > r["meilleurCoup"] for r in resultats)
    print(f"\n{n} défaites analysées · vagues : {sorted(murs.items())}")
    print(f"Combat mal joué (des coups variés gagnent plus souvent que son meilleur coup) : {mal_jouees}")
    print(f"Équipe condamnée (rien ne gagne) : {condamnees}")
    print(f"Son meilleur coup gagne quand même souvent (le hasard l'avait fait perdre) : {n - mal_jouees - condamnees}")
    (BANC / "diagnostic-tardif.json").write_text(json.dumps(resultats), encoding="utf-8")


if __name__ == "__main__":
    main()
