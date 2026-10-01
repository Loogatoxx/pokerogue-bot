"""Faire jouer des parties complètes à une « politique » (le cerveau, ou un joueur de référence).

Une politique reçoit (observation, masque) et renvoie une action. Chaque simulateur du pont joue
dans son propre fil d'exécution (thread), pour que les N copies du jeu tournent en même temps.
"""
from __future__ import annotations

import threading
import time
from typing import Callable

import numpy as np
import torch

from .pont import Etat, Fin, Pont
from .reseau import Cerveau

# Une politique reçoit l'observation, le masque et les valeurs du planificateur (ou None).
Politique = Callable[[np.ndarray, np.ndarray, "np.ndarray | None"], int]


def politique_cerveau(cerveau: Cerveau, tirage: bool = True) -> Politique:
    """Le cerveau choisit : tirage au sort selon ses probabilités, ou l'action la plus probable."""
    cerveau.eval()

    def choisir(observation: np.ndarray, masque: np.ndarray, plan: np.ndarray | None = None) -> int:
        action, _ = cerveau.choisir(torch.from_numpy(observation), torch.from_numpy(masque), tirage=tirage,
                                    plan=None if plan is None else torch.from_numpy(plan))
        return action

    return choisir


def politique_hasard(generateur: np.random.Generator | None = None) -> Politique:
    """Référence : une action permise au hasard, sans réfléchir."""
    generateur = generateur or np.random.default_rng()

    def choisir(_observation: np.ndarray, masque: np.ndarray, _plan: np.ndarray | None = None) -> int:
        return int(generateur.choice(np.flatnonzero(masque)))

    return choisir


def jouer_parties(pont: Pont, politique: Politique, nombre: int, afficher: bool = True) -> list[dict]:
    """Joue `nombre` parties réparties sur les simulateurs du pont ; renvoie l'info de fin de chacune."""
    resultats: list[dict] = []
    verrou = threading.Lock()
    restantes = [nombre]
    debut = time.time()

    def boucle(simulateur) -> None:
        while True:
            with verrou:
                if restantes[0] <= 0:
                    return
                restantes[0] -= 1
            etat: Etat | Fin = simulateur.nouvelle_partie()
            while isinstance(etat, Etat):
                etat = simulateur.agir(politique(etat.observation, etat.masque, etat.plan))
            with verrou:
                resultats.append(etat.info)
                if afficher:
                    fait = len(resultats)
                    erreur = f" ⚠ {etat.info['erreur']}" if "erreur" in etat.info else ""
                    print(f"  partie {fait}/{nombre} : vague {etat.info['vague']}, "
                          f"{etat.info['decisions']} décisions ({time.time() - debut:.0f} s){erreur}", flush=True)

    fils = [threading.Thread(target=boucle, args=(s,)) for s in pont.simulateurs]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    return resultats


def resumer(resultats: list[dict]) -> dict:
    vagues = np.array([r["vague"] for r in resultats])
    return {
        "parties": len(resultats),
        "vagueMoyenne": round(float(vagues.mean()), 2),
        "vagueMediane": float(np.median(vagues)),
        "vagueMax": int(vagues.max()),
        "victoires": sum(1 for r in resultats if r.get("victoire")),
        "erreurs": sum(1 for r in resultats if "erreur" in r),
        "decisionsMoyennes": round(float(np.mean([r["decisions"] for r in resultats])), 1),
    }
