"""Banc de la fin de partie : les mêmes situations tardives, rejouées par chaque version du bot.

Demande de Carlos (03/10) : entraîner le bot sur la fin de partie (« même avec des légendaires, il
avait du mal vers la vague 110 »). Les parties mesurées s'arrêtent surtout avant la vague 100 : une
mesure ordinaire voit à peine la fin de partie, et elle est bruitée. D'où ce banc :

  récolte  : des parties complètes (trio Plante/Feu/Eau) ; à chaque passage des vagues 100, 120 et
             140, la photo (sauvegarde du jeu) est gardée sur le Lexar (banc/tardif-<vague>.jsonl) ;
  rejeu    : chaque photo est rejouée jusqu'à la défaite (ou la vague 200) avec quelques graines fixes
             et le hasard du jeu (mêmes coups → même résultat) : chaque version du code affronte
             exactement les mêmes situations, la comparaison est appariée.

Usage :
  .venv/bin/python -m entraineur.banc_tardif recolte --parties 600
  .venv/bin/python -m entraineur.banc_tardif rejeu --vague 100 --nom avec-objets [--graines 3]
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
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
BANC = LEXAR / "banc"
VAGUES = (100, 120, 140)


def jouer(simulateur, cerveau, **partie) -> dict:
    etat = simulateur.nouvelle_partie(style_combat="changer", **partie)
    while isinstance(etat, Etat):
        plan = None if etat.plan is None else torch.from_numpy(etat.plan)
        action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=False, plan=plan)
        etat = simulateur.agir(action)
    return etat.info


def en_parallele(pont: Pont, travail, a_faire: list) -> None:
    verrou = threading.Lock()

    def boucle(i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                tache = a_faire.pop(0)
            try:
                travail(pont, i, tache, verrou)
            except (TimeoutError, ConnectionError, OSError):
                pont.redemarrer(i)

    fils = [threading.Thread(target=boucle, args=(i,)) for i in range(len(pont.simulateurs))]
    for f in fils:
        f.start()
    for f in fils:
        f.join()


def recolte(args, cerveau) -> None:
    BANC.mkdir(exist_ok=True)
    hasard = random.Random(int(datetime.now().timestamp()))
    a_faire = []
    for _ in range(args.parties):
        trio = [hasard.choice(STARTERS_COMPTE_NEUF[k::3]) for k in range(3)]
        hasard.shuffle(trio)
        a_faire.append(trio)
    gardees = [0]

    def travail(pont, i, trio, verrou):
        info = jouer(pont.entretenir(i), cerveau, especes=trio, photos=list(VAGUES))
        with verrou:
            for vague, texte in info.get("photos", {}).items():
                ligne = {"vague": int(vague), "starters": trio, "photo": texte}
                Entrainement.patienter_disque(lambda: open(BANC / f"tardif-{vague}.jsonl", "a", encoding="utf-8").write(json.dumps(ligne) + "\n"))
                gardees[0] += 1
            if info.get("photos"):
                print(f"  vague {info.get('vague')} : photos {sorted(info['photos'])}", flush=True)

    with Pont(args.processus) as pont:
        en_parallele(pont, travail, a_faire)
    print(f"{gardees[0]} photos gardées dans {BANC}")


def rejeu(args, cerveau) -> None:
    photos = [json.loads(l) for l in (BANC / f"tardif-{args.vague}.jsonl").read_text(encoding="utf-8").splitlines()]
    photos = photos[: args.photos]
    a_faire = [(k, p, f"banc-{k}-{g}") for k, p in enumerate(photos) for g in range(args.graines)]
    resultats: dict[tuple[int, str], int] = {}

    def travail(pont, i, tache, verrou):
        k, p, graine = tache
        info = jouer(pont.entretenir(i), cerveau, depart=p["photo"], graine=graine, hasard_du_jeu=True)
        with verrou:
            resultats[(k, graine)] = info.get("vague", args.vague) if not info.get("erreur") else -1

    with Pont(args.processus) as pont:
        en_parallele(pont, travail, a_faire)
    valides = {c: v for c, v in resultats.items() if v >= 0}
    sortie = BANC / f"rejeu-{args.vague}-{args.nom}.json"
    sortie.write_text(json.dumps({f"{k}|{g}": v for (k, g), v in valides.items()}), encoding="utf-8")
    gagnees = [v - args.vague for v in valides.values()]
    print(f"{args.nom} : {len(photos)} photos × {args.graines} graines depuis la vague {args.vague} · "
          f"vagues gagnées en moyenne {statistics.mean(gagnees):.1f} · arrivées au bout (200) "
          f"{sum(v > 200 for v in valides.values())} sur {len(valides)}")
    print(f"Détails : {sortie}")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("mode", choices=["recolte", "rejeu"])
    parametres.add_argument("--parties", type=int, default=600)
    parametres.add_argument("--vague", type=int, default=100)
    parametres.add_argument("--photos", type=int, default=60)
    parametres.add_argument("--graines", type=int, default=3)
    parametres.add_argument("--nom", default="essai")
    parametres.add_argument("--processus", type=int, default=10)
    args = parametres.parse_args()
    cerveau, _ = lire(V5)
    cerveau.eval()
    torch.set_num_threads(1)
    (recolte if args.mode == "recolte" else rejeu)(args, cerveau)


if __name__ == "__main__":
    main()
