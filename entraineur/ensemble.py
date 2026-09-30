"""Toutes les copies du jeu vues comme un seul environnement, pour l'apprentissage.

À chaque étape, chaque copie reçoit l'action choisie pour elle, joue jusqu'à sa prochaine
décision, et renvoie la récompense gagnée entre-temps (calculée ici, selon reglages.toml).
Une partie terminée est aussitôt remplacée par une nouvelle : l'apprentissage n'attend jamais.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .pont import Etat, Fin, Pont, Simulateur


class Ensemble:
    def __init__(self, pont: Pont, reglages: dict):
        self.pont = pont
        self.points = reglages["recompenses"]
        self.partie = reglages["partie"]
        self.nombre = len(pont.simulateurs)
        # Un fil d'exécution par copie : pendant qu'une copie joue, les autres aussi.
        self.fils = ThreadPoolExecutor(self.nombre)
        self.cumul = [0.0] * self.nombre
        self.parties_finies: list[dict] = []
        self.etats: list[Etat] = list(self.fils.map(self._nouvelle_partie, range(self.nombre)))

    # ─── Récompenses : ce que le cerveau cherche à maximiser ─────────────────────────────────

    def recompense(self, avant: dict, apres: dict) -> float:
        """Points gagnés entre deux décisions d'une même partie."""
        vagues = apres["vague"] - avant["vague"]
        points = vagues * self.points["vague_gagnee"]
        points += max(0, apres["koEquipe"] - avant["koEquipe"]) * self.points["ko_subi"]
        points += max(0, apres["tailleEquipe"] - avant["tailleEquipe"]) * self.points["capture"]
        if vagues == 0:
            # Coup de pouce : les PV retirés à l'adversaire (seulement s'ils baissent ; un nouvel
            # adversaire qui entre en pleine forme ne compte pas comme une punition).
            points += max(0.0, avant["pvAdversaires"] - apres["pvAdversaires"]) * self.points["degats_infliges"]
        return points

    def recompense_fin(self, avant: dict, fin: dict) -> float:
        """Points de la dernière décision d'une partie."""
        points = max(0, fin["vague"] - avant["vague"]) * self.points["vague_gagnee"]
        if fin.get("victoire") or fin.get("tronquee"):
            return points
        # Défaite : le dernier Pokémon debout vient de tomber.
        return points + self.points["ko_subi"] + self.points["defaite"]

    # ─── Déroulement ─────────────────────────────────────────────────────────────────────────

    def _nouvelle_partie(self, i: int) -> Etat:
        simulateur: Simulateur = self.pont.entretenir(i)
        while True:
            etat = simulateur.nouvelle_partie(style_combat=self.partie["style_combat"],
                                              vague_max=self.partie["vague_max"])
            if isinstance(etat, Etat):
                return etat
            # Partie finie avant la moindre décision (rarissime) : on la note et on recommence.
            self.parties_finies.append({**etat.info, "recompense": 0.0})

    def _jouer(self, i: int, action: int) -> tuple[float, bool]:
        avant = self.etats[i]
        apres: Etat | Fin = self.pont.simulateurs[i].agir(action)
        if isinstance(apres, Etat):
            points = self.recompense(avant.info, apres.info)
            self.cumul[i] += points
            self.etats[i] = apres
            return points, False
        points = self.recompense_fin(avant.info, apres.info)
        self.parties_finies.append({**apres.info, "recompense": round(self.cumul[i] + points, 3)})
        self.cumul[i] = 0.0
        self.etats[i] = self._nouvelle_partie(i)
        return points, True

    def observations(self) -> tuple[np.ndarray, np.ndarray]:
        return (np.stack([e.observation for e in self.etats]), np.stack([e.masque for e in self.etats]))

    def etape(self, actions: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Joue une action par copie ; renvoie (récompenses, parties terminées)."""
        resultats = list(self.fils.map(self._jouer, range(self.nombre), actions.tolist()))
        return (np.array([r for r, _ in resultats], dtype=np.float32), np.array([f for _, f in resultats]))

    def vider_parties_finies(self) -> list[dict]:
        finies, self.parties_finies = self.parties_finies, []
        return finies
