"""Évalue un cerveau dans le simulateur, et peut le publier comme nouvelle version officielle.

Deux façons de le faire jouer :
- « meilleur coup » : il prend toujours l'action la plus probable (c'est ce que fait le mode auto
  de l'extension, donc ce que tu verras dans Brave) ;
- « tirage » : il tire au sort selon ses probabilités (comme pendant l'entraînement).

Usage :
  .venv/bin/python -m entraineur.evaluer <fichier.cerveau> [--parties 64]
  .venv/bin/python -m entraineur.evaluer <fichier.cerveau> --publier v1
    → copie dans /Volumes/Lexar/pokerogue-bot/cerveaux/v1-<date>.cerveau avec son évaluation
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import torch

from .format_cerveau import ecrire, lire
from .jouer import jouer_parties, politique_cerveau, resumer
from .pont import Pont

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path)
    parametres.add_argument("--parties", type=int, default=64)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--publier", metavar="NOM", help="publier comme version officielle (ex. v1)")
    args = parametres.parse_args()
    torch.set_num_threads(2)

    cerveau, entete = lire(args.cerveau)
    print(f"Cerveau : {entete['nom']} ({entete['entrainement']['parties']} parties d'entraînement)")
    with Pont(args.processus) as pont:
        print("\nMeilleur coup (comme le mode auto de l'extension) :")
        meilleur = jouer_parties(pont, politique_cerveau(cerveau, tirage=False), args.parties, afficher=False)
        print("Tirage (comme à l'entraînement) :")
        tirage = jouer_parties(pont, politique_cerveau(cerveau, tirage=True), args.parties, afficher=False)
        versions = pont.versions

    r_meilleur, r_tirage = resumer(meilleur), resumer(tirage)
    print(f"\n{'':16}{'vague moy.':>11}{'médiane':>9}{'max':>5}{'erreurs':>9}")
    for nom, r in (("meilleur coup", r_meilleur), ("tirage", r_tirage)):
        print(f"{nom:16}{r['vagueMoyenne']:>11}{r['vagueMediane']:>9}{r['vagueMax']:>5}{r['erreurs']:>9}")

    if args.publier:
        date = datetime.now().strftime("%Y-%m-%d")
        chemin = ecrire(
            LEXAR / "cerveaux" / f"{args.publier}-{date}.cerveau", cerveau,
            nom=args.publier,
            description=f"{entete['description']} Publié depuis {args.cerveau.parent.parent.name}/{args.cerveau.name}.",
            versions=versions, entrainement=entete["entrainement"],
            evaluation={k: r_meilleur[k] for k in ("parties", "vagueMoyenne", "vagueMax")},
        )
        fichier = LEXAR / "evaluations" / f"{args.publier}-{date}.json"
        fichier.write_text(json.dumps({
            "cerveau": chemin.name, "source": str(args.cerveau), "date": datetime.now().isoformat(timespec="seconds"),
            "meilleurCoup": {"resume": r_meilleur, "parties": meilleur},
            "tirage": {"resume": r_tirage, "parties": tirage},
        }, ensure_ascii=False, indent=1))
        print(f"\nPublié : {chemin}\nRésultats : {fichier}")


if __name__ == "__main__":
    main()
