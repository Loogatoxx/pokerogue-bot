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
import random
from collections import Counter
from pathlib import Path

import torch

from .banc_tardif import BANC, V5, en_parallele, jouer
from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .pont import Etat, Pont
from .statistiques_banc import comparer_apparie, est_valide, resume


def trio_de(k: int) -> list[int]:
    hasard = random.Random(k)
    trio = [hasard.choice(STARTERS_COMPTE_NEUF[i::3]) for i in range(3)]
    hasard.shuffle(trio)
    return trio


def fichier(nom: str, dossier: Path = BANC) -> Path:
    return dossier / f"complet-{nom}.jsonl"


def lire_resultats(nom: str, dossier: Path = BANC, avec_erreurs: bool = False) -> dict[int, dict]:
    lignes = map(json.loads, fichier(nom, dossier).read_text(encoding="utf-8").splitlines())
    return {r["k"]: r for r in lignes if avec_erreurs or est_valide(r)}


def comparer(a: str, b: str, dossier: Path = BANC) -> None:
    ra, rb = lire_resultats(a, dossier, avec_erreurs=True), lire_resultats(b, dossier, avec_erreurs=True)
    communs = sorted(k for k in set(ra) & set(rb) if est_valide(ra[k]) and est_valide(rb[k]))
    differences = [ra[k]["vague"] - rb[k]["vague"] for k in communs]
    moyenne, erreur_type, verdict = comparer_apparie(differences)
    print(f"{a} − {b} : {moyenne:+.2f} vagues (erreur-type appariée {erreur_type:.2f}, seuil {2 * erreur_type:.2f}, "
          f"{len(differences)} paires) · mieux {sum(x > 0 for x in differences)}, "
          f"pareil {sum(x == 0 for x in differences)}, pire {sum(x < 0 for x in differences)}")
    print(f"verdict : {verdict}")
    print(f"\n{a} :\n{resume([ra[k] for k in communs])}\n\n{b} :\n{resume([rb[k] for k in communs])}")


def choisir_plan_seul(etat: Etat) -> int:
    permises = [i for i, permise in enumerate(etat.masque) if permise]
    if etat.plan is None:
        return permises[0]
    return max(permises, key=lambda i: etat.plan[i])


def jouer_plan_seul(simulateur, **partie) -> dict:
    etat = simulateur.nouvelle_partie(style_combat="changer", plan_capture=True, **partie)
    while isinstance(etat, Etat):
        etat = simulateur.agir(choisir_plan_seul(etat))
    return etat.info


def jouer_banc(args, cerveau) -> None:
    dossier = Path(args.dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    sortie = fichier(args.nom, dossier)
    faites = set(lire_resultats(args.nom, dossier, avec_erreurs=True)) if sortie.exists() else set()
    a_faire = [k for k in range(args.parties) if k not in faites]
    reglages = {"mysteres": args.mysteres} if args.mysteres != "aucune" else {}
    essais_depart = Counter()

    def travail(pont, i, k, verrou):
        partie = {"especes": args.trio or trio_de(k), "graine": f"complet-{k}", "hasard_du_jeu": True, "recit": True,
                  **reglages, **({"objets_depart": args.objets} if args.objets else {})}
        simulateur = pont.entretenir(i)
        info = jouer_plan_seul(simulateur, **partie) if cerveau is None else jouer(simulateur, cerveau, **partie)
        if info.get("erreur") and info.get("vague", 0) == 0 and essais_depart[k] < 2:
            pont.redemarrer(i)
            with verrou:
                essais_depart[k] += 1
                a_faire.append(k)
            return
        recit = info.get("recit") or []
        ligne = {
            "k": k, "vague": info.get("vague", 0), "victoire": info.get("victoire", False), "starters": args.trio or trio_de(k),
            "totalStatsDepart": info.get("totalStatsDepart"), "changements": info.get("changements"),
            "recompenses": info.get("recompenses"), "offertes": info.get("offertes"), "achats": info.get("achats"),
            "rencontres": info.get("rencontres"),
            "bilan": info.get("bilan"),
            "niveaux": {r["vague"]: r["equipe"] for r in recit},
            "defaite": info.get("defaite"),
            "protocole": {"mysteres": args.mysteres, "planSeul": cerveau is None},
            **({"erreur": info["erreur"], "phase": info.get("phase")} if info.get("erreur") else {}),
        }
        with verrou:
            with open(sortie, "a", encoding="utf-8") as f:
                f.write(json.dumps(ligne, ensure_ascii=False) + "\n")
            faites.add(k)
            if len(faites) % 40 == 0:
                print(f"  {len(faites)}/{args.parties} parties", flush=True)

    with Pont(args.processus) as pont:
        en_parallele(pont, travail, a_faire)
    print(resume(list(lire_resultats(args.nom, dossier, avec_erreurs=True).values())))
    print(f"Détails : {sortie}")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("--nom")
    parametres.add_argument("--parties", type=int, default=480)
    parametres.add_argument("--processus", type=int, default=10)
    parametres.add_argument("--comparer", nargs=2, metavar=("ESSAI", "REFERENCE"))
    parametres.add_argument("--trio", type=int, nargs=3, help="starters imposés à toutes les parties (le porteur en premier)")
    parametres.add_argument("--objets", nargs="+", help="diagnostic « et si… » : objets donnés au départ (ex. EXP_SHARE EXP_SHARE)")
    parametres.add_argument("--plan-seul", action="store_true", help="sans cerveau : l'action la mieux notée par le planificateur, Balls notées par le planificateur")
    parametres.add_argument("--mysteres", default="jeu", help="rencontres mystères : « jeu » (rythme du vrai jeu, protocole) ou « aucune »")
    parametres.add_argument("--dossier", default=str(BANC), help="dossier des résultats (par défaut sur le Lexar)")
    args = parametres.parse_args()
    if args.comparer:
        comparer(*args.comparer, dossier=Path(args.dossier))
        return
    cerveau = None
    if not args.plan_seul:
        cerveau, _ = lire(V5)
        cerveau.eval()
        torch.set_num_threads(1)
    jouer_banc(args, cerveau)


if __name__ == "__main__":
    main()
