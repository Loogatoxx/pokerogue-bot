"""Greffe : agrandir un cerveau existant (plus d'entrées, plus d'actions) sans perdre ce qu'il sait.

Quand l'observation gagne des nombres (ajoutés à la fin, voir observateur/encodeur.ts) ou que de
nouvelles actions apparaissent (ajoutées à la fin, voir observateur/actions.ts), on ne repart pas
de zéro :
- les nouvelles entrées reçoivent des poids nuls : au départ, le cerveau les ignore et raisonne
  exactement comme avant ; l'entraînement lui apprendra à s'en servir ;
- les nouvelles actions reçoivent des poids nuls et un biais égal à la moyenne des anciennes :
  il les considère d'abord comme des actions « moyennes », qu'il va essayer puis juger.

Usage : .venv/bin/python -m entraineur.greffe <ancien.cerveau> --nom v1-greffe
  (tailles lues auprès du jeu ; résultat dans /Volumes/Lexar/pokerogue-bot/cerveaux/)
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import torch
from torch import nn

from .format_cerveau import ecrire, lire
from .pont import Pont
from .reseau import Cerveau

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")


def lineaires(module: nn.Module) -> list[nn.Linear]:
    return [m for m in (module if isinstance(module, nn.Sequential) else [module]) if isinstance(m, nn.Linear)]


@torch.no_grad()
def greffer(ancien: Cerveau, taille_entree: int, nombre_actions: int) -> Cerveau:
    if taille_entree < ancien.taille_entree or nombre_actions < ancien.nombre_actions:
        raise ValueError("Une greffe ne peut qu'agrandir : entrées et actions nouvelles s'ajoutent à la fin.")
    tailles = tuple(c.out_features for c in lineaires(ancien.tronc))
    nouveau = Cerveau(taille_entree, nombre_actions, tailles)

    for i, (a, n) in enumerate(zip(lineaires(ancien.tronc), lineaires(nouveau.tronc))):
        n.weight.zero_()
        n.weight[:, : a.in_features] = a.weight  # première couche : colonnes nouvelles à zéro
        n.bias.copy_(a.bias)

    a, n = ancien.politique, nouveau.politique
    n.weight.zero_()
    n.weight[: a.out_features] = a.weight
    n.bias[: a.out_features] = a.bias
    n.bias[a.out_features:] = a.bias.mean()

    nouveau.valeur.load_state_dict(ancien.valeur.state_dict())
    return nouveau


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("ancien", type=Path)
    parametres.add_argument("--nom", required=True)
    args = parametres.parse_args()

    ancien, entete = lire(args.ancien)
    with Pont(1) as pont:
        taille, actions, versions = pont.taille_entree, pont.nombre_actions, pont.versions
    nouveau = greffer(ancien, taille, actions)
    chemin = ecrire(
        LEXAR / "cerveaux" / f"{args.nom}-{datetime.now():%Y-%m-%d}.cerveau", nouveau, nom=args.nom,
        description=f"{entete['nom']} greffé : {ancien.taille_entree} → {taille} entrées, "
                    f"{ancien.nombre_actions} → {actions} actions (nouveautés à zéro).",
        versions=versions, entrainement=entete["entrainement"],
    )
    print(f"Greffe : {ancien.taille_entree} → {taille} entrées, {ancien.nombre_actions} → {actions} actions\n{chemin}")


if __name__ == "__main__":
    main()
