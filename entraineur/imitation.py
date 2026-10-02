"""L'élève : le cerveau apprend à refaire les choix du professeur (entraineur/professeur.py).

Apprentissage « supervisé » : pour chaque situation enregistrée par le professeur, on montre au
cerveau l'action que l'essai gardé a jouée, et on corrige ses poids pour qu'il la juge plus
probable (perte d'entropie croisée : plus le cerveau donnait une faible probabilité au bon coup,
plus la correction est forte). Le cerveau reste guidé par le planificateur (ses scores + 30 × plan),
exactement comme en jeu : il apprend ce que le plan seul ne voit pas.

Une partie sur dix est mise de côté : on mesure sur elle si le cerveau s'accorde de mieux en mieux
avec le professeur, sans simplement apprendre par cœur.

Usage :
  .venv/bin/python -m entraineur.imitation /Volumes/Lexar/pokerogue-bot/professeur/<date> [--depart v5] [--epoques 3]
Le cerveau obtenu va dans /Volumes/Lexar/pokerogue-bot/entrainements/imitation-<date>/cerveaux/.
"""
from __future__ import annotations

import argparse
import random
from datetime import datetime
from pathlib import Path

import numpy as np
import torch

from .format_cerveau import ecrire, lire

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V5 = LEXAR / "cerveaux" / "v5-2026-10-01.cerveau"


def charger(dossiers: list[Path]) -> list[dict[str, np.ndarray]]:
    parties = []
    for dossier in dossiers:
        for fichier in sorted(dossier.glob("partie-*.npz")):
            if fichier.name.startswith("._"):
                continue
            with np.load(fichier) as d:
                parties.append({k: d[k] for k in d.files})
    return parties


def empiler(parties: list[dict[str, np.ndarray]]) -> dict[str, torch.Tensor]:
    return {
        "observations": torch.from_numpy(np.concatenate([p["observations"] for p in parties]).astype(np.float32)),
        "masques": torch.from_numpy(np.concatenate([p["masques"] for p in parties])),
        "plans": torch.from_numpy(np.concatenate([p["plans"] for p in parties]).astype(np.float32)),
        "actions": torch.from_numpy(np.concatenate([p["actions"] for p in parties]).astype(np.int64)),
        # Poids de chaque exemple (professeur.py) : 1 = décision qui a fait gagner, 0,1 = le coup
        # que le cerveau aurait joué de toute façon. Absent (anciens fichiers) : 1 partout.
        "poids": torch.from_numpy(np.concatenate([p.get("poids", np.ones(len(p["actions"]), np.float32)) for p in parties])),
    }


@torch.no_grad()
def accord(cerveau, donnees: dict[str, torch.Tensor], taille: int = 4096, decisifs: bool = False) -> float:
    """Part des situations où le meilleur coup du cerveau est celui du professeur (seulement les
    décisions décisives, poids ≥ 0,5, si `decisifs`)."""
    justes, total = 0, 0
    n = len(donnees["actions"])
    for debut in range(0, n, taille):
        tranche = slice(debut, debut + taille)
        garder = donnees["poids"][tranche] >= 0.5 if decisifs else torch.ones_like(donnees["poids"][tranche], dtype=torch.bool)
        scores, _ = cerveau(donnees["observations"][tranche], donnees["masques"][tranche], donnees["plans"][tranche])
        justes += int(((scores.argmax(-1) == donnees["actions"][tranche]) & garder).sum())
        total += int(garder.sum())
    return justes / max(total, 1)


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("dossiers", type=Path, nargs="+", help="dossiers du professeur")
    parametres.add_argument("--depart", type=Path, default=V5)
    parametres.add_argument("--epoques", type=int, default=3, help="passages sur toutes les données")
    parametres.add_argument("--taux", type=float, default=1e-4, help="taux d'apprentissage")
    parametres.add_argument("--lot", type=int, default=512)
    args = parametres.parse_args()
    torch.manual_seed(0)
    cerveau, entete = lire(args.depart)
    parties = charger(args.dossiers)
    random.Random(0).shuffle(parties)
    nb_test = max(1, len(parties) // 10)
    test, appris = empiler(parties[:nb_test]), empiler(parties[nb_test:])
    n = len(appris["actions"])
    print(f"Départ : {entete['nom']} · {len(parties)} parties du professeur · {n} exemples à apprendre, "
          f"{len(test['actions'])} mis de côté")
    cerveau.eval()
    print(f"Exemples décisifs (poids ≥ 0,5) : {int((appris['poids'] >= 0.5).sum())} à apprendre")
    print(f"Accord avec le professeur avant : {100 * accord(cerveau, test):.1f} % ; sur les coups décisifs "
          f"{100 * accord(cerveau, test, decisifs=True):.1f} % (parties mises de côté)")
    optimiseur = torch.optim.Adam(cerveau.parameters(), lr=args.taux)
    for epoque in range(1, args.epoques + 1):
        cerveau.train()
        ordre = torch.randperm(n)
        pertes = []
        for debut in range(0, n, args.lot):
            lot = ordre[debut:debut + args.lot]
            scores, _ = cerveau(appris["observations"][lot], appris["masques"][lot], appris["plans"][lot])
            poids = appris["poids"][lot]
            perte = (torch.nn.functional.cross_entropy(scores, appris["actions"][lot], reduction="none") * poids).sum() / poids.sum()
            optimiseur.zero_grad()
            perte.backward()
            torch.nn.utils.clip_grad_norm_(cerveau.parameters(), 0.5)
            optimiseur.step()
            pertes.append(float(perte))
        cerveau.eval()
        print(f"  époque {epoque} : perte {np.mean(pertes):.3f} · accord {100 * accord(cerveau, test):.1f} % · "
              f"coups décisifs {100 * accord(cerveau, test, decisifs=True):.1f} %", flush=True)
    dossier = LEXAR / "entrainements" / f"imitation-{datetime.now():%Y-%m-%d-%Hh%M}" / "cerveaux"
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = ecrire(
        dossier / "imitation.cerveau", cerveau, nom=f"imitation de {len(parties)} parties du professeur",
        description=f"{entete['description']} Puis imitation du professeur ({', '.join(d.name for d in args.dossiers)}).",
        versions={"versionObservation": entete["versionObservation"], "versionEncodage": entete["versionEncodage"]},
        entrainement={"parties": entete.get("entrainement", {}).get("parties", 0), "decisions": n},
    )
    print(f"Cerveau : {chemin}")


if __name__ == "__main__":
    main()
