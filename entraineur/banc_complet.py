"""Banc des parties complètes : les mêmes parties (graine, starters, hasard du jeu) rejouées par chaque
version du code, pour des comparaisons appariées.

Pourquoi : une mesure ordinaire (analyse_defaites.py, graines au hasard) a un bruit de ±2 vagues sur
480 parties ; les petits réglages (+0,5 vague) s'y perdent, et deux mesures du même code ont donné
57,7 et 56,9. Ici, chaque partie k a une graine fixe (« complet-k »), un trio fixe (un Plante, un
Feu, un Eau tirés avec k) et le hasard du jeu fixé : tant que deux versions prennent les mêmes
décisions, la partie est identique. La différence ne vient que des décisions changées.

Usage :
  .venv/bin/python -m entraineur.banc_complet --nom reference [--parties 480]
  .venv/bin/python -m entraineur.banc_complet --comparer essai reference
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from collections import Counter

import torch

from .banc_tardif import BANC, V5, en_parallele, jouer
from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .pont import Pont

RIVAUX = {8: "rival 1", 25: "rival 2", 55: "rival 3", 95: "rival 4", 145: "rival 5", 195: "rival 6"}


def trio_de(k: int) -> list[int]:
    hasard = random.Random(k)
    trio = [hasard.choice(STARTERS_COMPTE_NEUF[i::3]) for i in range(3)]
    hasard.shuffle(trio)
    return trio


def fichier(nom: str):
    return BANC / f"complet-{nom}.jsonl"


def lire_resultats(nom: str) -> dict[int, dict]:
    return {r["k"]: r for r in map(json.loads, fichier(nom).read_text(encoding="utf-8").splitlines())}


def resume(resultats: dict[int, dict]) -> str:
    vagues = [r["vague"] for r in resultats.values()]
    morts = Counter(vagues)
    lignes = [f"{len(vagues)} parties · vague moyenne {statistics.mean(vagues):.1f} · médiane {statistics.median(vagues):.0f}"]
    restants = len(vagues)
    taux = []
    for v in sorted(morts):
        if v in RIVAUX:
            taux.append(f"{RIVAUX[v]} {100 * (1 - morts[v] / max(restants, 1)):.0f} %")
        restants -= morts[v]
    lignes.append("passent : " + ", ".join(taux))
    lignes.append("murs : " + ", ".join(f"{v} ({n})" for v, n in morts.most_common(8)))
    return "\n".join(lignes)


def comparer(a: str, b: str) -> None:
    ra, rb = lire_resultats(a), lire_resultats(b)
    communs = sorted(set(ra) & set(rb))
    d = [ra[k]["vague"] - rb[k]["vague"] for k in communs]
    m = statistics.mean(d)
    se = statistics.stdev(d) / math.sqrt(len(d)) if len(d) > 1 else 0
    print(f"{a} − {b} : {m:+.2f} vagues (± {se:.2f}, {len(d)} paires) · mieux {sum(x > 0 for x in d)}, "
          f"pareil {sum(x == 0 for x in d)}, pire {sum(x < 0 for x in d)}")
    print(f"\n{a} :\n{resume({k: ra[k] for k in communs})}\n\n{b} :\n{resume({k: rb[k] for k in communs})}")


def jouer_banc(args, cerveau) -> None:
    BANC.mkdir(exist_ok=True)
    sortie = fichier(args.nom)
    faites = set(lire_resultats(args.nom)) if sortie.exists() else set()
    a_faire = [k for k in range(args.parties) if k not in faites]

    def travail(pont, i, k, verrou):
        info = jouer(pont.entretenir(i), cerveau, especes=trio_de(k), graine=f"complet-{k}", hasard_du_jeu=True, recit=True,
                     **({"objets_depart": args.objets} if args.objets else {}))
        if info.get("erreur"):
            return
        recit = info.get("recit") or []
        ligne = {
            "k": k, "vague": info.get("vague", 0), "starters": trio_de(k),
            "recompenses": info.get("recompenses"), "offertes": info.get("offertes"), "achats": info.get("achats"),
            "bilan": info.get("bilan"),
            "niveaux": {r["vague"]: r["equipe"] for r in recit},
            "defaite": info.get("defaite"),
        }
        with verrou:
            with open(sortie, "a", encoding="utf-8") as f:
                f.write(json.dumps(ligne, ensure_ascii=False) + "\n")
            faites.add(k)
            if len(faites) % 40 == 0:
                print(f"  {len(faites)}/{args.parties} parties", flush=True)

    with Pont(args.processus) as pont:
        en_parallele(pont, travail, a_faire)
    print(resume(lire_resultats(args.nom)))
    print(f"Détails : {sortie}")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("--nom")
    parametres.add_argument("--parties", type=int, default=480)
    parametres.add_argument("--processus", type=int, default=10)
    parametres.add_argument("--comparer", nargs=2, metavar=("ESSAI", "REFERENCE"))
    parametres.add_argument("--objets", nargs="+", help="diagnostic « et si… » : objets donnés au départ (ex. EXP_SHARE EXP_SHARE)")
    args = parametres.parse_args()
    if args.comparer:
        comparer(*args.comparer)
        return
    cerveau, _ = lire(V5)
    cerveau.eval()
    torch.set_num_threads(1)
    jouer_banc(args, cerveau)


if __name__ == "__main__":
    main()
