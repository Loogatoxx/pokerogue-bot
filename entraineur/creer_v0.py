"""Crée le cerveau v0 : le réseau complet, mais pas encore entraîné (poids aléatoires).

Il joue donc « au hasard », avec des préférences arbitraires dues à ses poids de départ.
C'est le point zéro de la courbe d'évolution : chaque version suivante devra faire mieux.

Le script :
1. lance les copies du jeu (pont) ;
2. crée le réseau (graine fixe : la v0 est reproductible) ;
3. le fait jouer N parties, ainsi qu'un joueur « hasard pur » comme référence ;
4. enregistre le cerveau et les résultats sur le Lexar.

Usage : .venv/bin/python -m entraineur.creer_v0 [--processus 8] [--parties 64]
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import torch

from .format_cerveau import ecrire
from .jouer import jouer_parties, politique_cerveau, politique_hasard, resumer
from .pont import Pont
from .reseau import Cerveau

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--parties", type=int, default=64)
    parametres.add_argument("--graine", type=int, default=0)
    args = parametres.parse_args()

    if not LEXAR.exists():
        raise SystemExit("Le Lexar n'est pas branché : les cerveaux y sont rangés.")
    torch.set_num_threads(2)
    date = datetime.now().strftime("%Y-%m-%d")

    with Pont(args.processus) as pont:
        print(f"{args.processus} copies du jeu prêtes — observation de {pont.taille_entree} nombres, "
              f"{pont.nombre_actions} actions")

        torch.manual_seed(args.graine)
        cerveau = Cerveau(pont.taille_entree, pont.nombre_actions)
        print(f"\nCerveau v0 (non entraîné) : {sum(p.numel() for p in cerveau.parameters()):,} poids".replace(",", " "))
        resultats_v0 = jouer_parties(pont, politique_cerveau(cerveau, tirage=True), args.parties)

        print("\nRéférence : hasard pur")
        resultats_hasard = jouer_parties(pont, politique_hasard(np.random.default_rng(args.graine)), args.parties)

    resume_v0, resume_hasard = resumer(resultats_v0), resumer(resultats_hasard)
    chemin = ecrire(
        LEXAR / "cerveaux" / f"v0-{date}.cerveau", cerveau,
        nom="v0",
        description="Réseau complet non entraîné (poids aléatoires, graine "
                    f"{args.graine}). Point zéro de la courbe d'évolution.",
        versions=pont.versions,
        evaluation={k: resume_v0[k] for k in ("parties", "vagueMoyenne", "vagueMax")},
    )
    evaluation = LEXAR / "evaluations" / f"v0-{date}.json"
    evaluation.parent.mkdir(parents=True, exist_ok=True)
    evaluation.write_text(json.dumps({
        "cerveau": chemin.name, "date": datetime.now().isoformat(timespec="seconds"),
        "v0": {"resume": resume_v0, "parties": resultats_v0},
        "hasard": {"resume": resume_hasard, "parties": resultats_hasard},
    }, ensure_ascii=False, indent=1))

    print(f"\n{'':12}{'vague moy.':>11}{'médiane':>9}{'max':>5}{'erreurs':>9}")
    for nom, r in (("v0", resume_v0), ("hasard pur", resume_hasard)):
        print(f"{nom:12}{r['vagueMoyenne']:>11}{r['vagueMediane']:>9}{r['vagueMax']:>5}{r['erreurs']:>9}")
    print(f"\nCerveau : {chemin} ({chemin.stat().st_size / 1e6:.1f} Mo)\nRésultats : {evaluation}")


if __name__ == "__main__":
    main()
