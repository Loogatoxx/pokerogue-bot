"""Écriture et lecture des fichiers .cerveau (lus aussi par l'extension, voir cerveau/cerveau.ts).

Format (version 1) : « CRVO » · longueur de l'en-tête (uint32 petit-boutiste) · en-tête JSON
· bourrage jusqu'à un multiple de 4 octets · poids float32 petit-boutistes.
Une couche linéaire range ses poids ligne par ligne (sortie × entrée), comme PyTorch.
"""
from __future__ import annotations

import json
import struct
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .reseau import Cerveau

SIGNATURE = b"CRVO"


def _couches(module: nn.Module) -> list[tuple[nn.Linear, str]]:
    """Couches linéaires d'un bloc, avec l'activation qui les suit."""
    elements = list(module) if isinstance(module, nn.Sequential) else [module]
    resultat = []
    for i, element in enumerate(elements):
        if isinstance(element, nn.Linear):
            suivant = elements[i + 1] if i + 1 < len(elements) else None
            resultat.append((element, "relu" if isinstance(suivant, nn.ReLU) else "aucune"))
    return resultat


def ecrire(chemin: Path, cerveau: Cerveau, *, nom: str, description: str, versions: dict,
           entrainement: dict | None = None, evaluation: dict | None = None) -> Path:
    blocs: dict[str, list[dict]] = {}
    morceaux: list[np.ndarray] = []
    position = 0
    for nom_bloc, module in (("tronc", cerveau.tronc), ("politique", cerveau.politique), ("valeur", cerveau.valeur)):
        blocs[nom_bloc] = []
        for couche, activation in _couches(module):
            poids = couche.weight.detach().cpu().numpy().astype("<f4")
            biais = couche.bias.detach().cpu().numpy().astype("<f4")
            blocs[nom_bloc].append({
                "entree": couche.in_features, "sortie": couche.out_features, "activation": activation,
                "poids": position, "biais": position + poids.size,
            })
            position += poids.size + biais.size
            morceaux += [poids.ravel(), biais]

    entete = {
        "format": "cerveau-pokerogue", "versionFormat": 1,
        "nom": nom, "description": description,
        "creeLe": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "versionObservation": versions["versionObservation"], "versionEncodage": versions["versionEncodage"],
        "tailleEntree": cerveau.taille_entree, "nombreActions": cerveau.nombre_actions,
        "entrainement": entrainement or {"parties": 0, "decisions": 0},
        **({"evaluation": evaluation} if evaluation else {}),
        **blocs,
    }
    texte = json.dumps(entete, ensure_ascii=False).encode("utf-8")
    debut = 8 + len(texte)
    bourrage = b"\0" * ((-debut) % 4)
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with open(chemin, "wb") as f:
        f.write(SIGNATURE + struct.pack("<I", len(texte)) + texte + bourrage)
        f.write(np.concatenate(morceaux).astype("<f4").tobytes())
    return chemin


def lire(chemin: Path) -> tuple[Cerveau, dict]:
    donnees = Path(chemin).read_bytes()
    if donnees[:4] != SIGNATURE:
        raise ValueError(f"{chemin} n'est pas un fichier .cerveau")
    (longueur,) = struct.unpack("<I", donnees[4:8])
    entete = json.loads(donnees[8:8 + longueur].decode("utf-8"))
    debut = 8 + longueur + ((-(8 + longueur)) % 4)
    poids = np.frombuffer(donnees[debut:], dtype="<f4")

    tailles = tuple(c["sortie"] for c in entete["tronc"])
    cerveau = Cerveau(entete["tailleEntree"], entete["nombreActions"], tailles)
    for nom_bloc, module in (("tronc", cerveau.tronc), ("politique", cerveau.politique), ("valeur", cerveau.valeur)):
        for (couche, _), decrite in zip(_couches(module), entete[nom_bloc]):
            n = decrite["entree"] * decrite["sortie"]
            couche.weight.data = torch.from_numpy(poids[decrite["poids"]:decrite["poids"] + n].copy()).view(decrite["sortie"], decrite["entree"])
            couche.bias.data = torch.from_numpy(poids[decrite["biais"]:decrite["biais"] + decrite["sortie"]].copy())
    return cerveau, entete
