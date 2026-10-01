"""Toutes les copies du jeu vues comme un seul environnement, pour l'apprentissage.

À chaque étape, chaque copie reçoit l'action choisie pour elle, joue jusqu'à sa prochaine
décision, et renvoie la récompense gagnée entre-temps (calculée ici, selon reglages.toml).
Une partie terminée est aussitôt remplacée par une nouvelle : l'apprentissage n'attend jamais.
"""
from __future__ import annotations

import random
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .pont import Etat, Fin, Pont, Simulateur

# Les 27 starters d'un compte neuf (defaultStarterSpecies, jeu/src/constants.ts), par numéro du
# Pokédex national. Tirer trois d'entre eux à chaque partie évite que le cerveau n'apprenne que
# pour Bulbizarre, Salamèche et Carapuce, alors qu'un humain choisit ses starters.
STARTERS_COMPTE_NEUF = [
    1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
    650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
]


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
        self.hasard = random.Random()
        self.starters: list[list[int] | None] = [None] * self.nombre
        # Entraînement ciblé : une part des parties repart d'une photo prise au début d'un combat
        # qui bloque (rival, boss…), pour s'y exercer bien plus souvent qu'en partant de la vague 1.
        self.part_exercices = float(self.partie.get("entrainement_cible", 0))
        self.vagues_photos = list(self.partie.get("photos_vagues", []))
        self.photos: dict[int, list[str]] = {}
        self.verrou_photos = threading.Lock()
        self.depart: list[int | None] = [None] * self.nombre
        # Réussite des 100 derniers exercices de chaque combat : on travaille d'abord ce qui coince.
        self.resultats_exercices: dict[int, deque] = {}
        self.etats: list[Etat] = list(self.fils.map(self._nouvelle_partie, range(self.nombre)))

    # ─── Récompenses : ce que le cerveau cherche à maximiser ─────────────────────────────────

    def recompense(self, avant: dict, apres: dict) -> float:
        """Points gagnés entre deux décisions d'une même partie."""
        vagues = apres["vague"] - avant["vague"]
        points = vagues * self.points["vague_gagnee"]
        points += max(0, apres["koEquipe"] - avant["koEquipe"]) * self.points["ko_subi"]
        # Capture gardée : un nouveau venu dans l'équipe, y compris à la place d'un membre (la note
        # d'équipe ne remplace que pour mieux). Ancien calcul (l'équipe grandit) pour un simulateur
        # qui ne compte pas encore les recrues.
        if "recrues" in apres:
            nouveaux = apres["recrues"] - avant.get("recrues", 0)
        else:
            nouveaux = apres["tailleEquipe"] - avant["tailleEquipe"]
        points += max(0, nouveaux) * self.points["capture"]
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

    # ─── Photos (entraînement ciblé) ──────────────────────────────────────────────────────────

    PHOTOS_MAX = 200  # par vague : les plus anciennes sont remplacées au hasard

    def _garder_photos(self, info: dict) -> None:
        """Range les photos renvoyées par une partie (et les retire de son info, trop lourdes)."""
        photos = info.pop("photos", None) or {}
        with self.verrou_photos:
            for vague, texte in photos.items():
                reserve = self.photos.setdefault(int(vague), [])
                if len(reserve) < self.PHOTOS_MAX:
                    reserve.append(texte)
                else:
                    reserve[self.hasard.randrange(self.PHOTOS_MAX)] = texte

    def reussite_exercices(self, vague: int) -> float | None:
        """Part des derniers exercices de ce combat qui l'ont passé (None sans exercice encore)."""
        resultats = self.resultats_exercices.get(vague)
        return sum(resultats) / len(resultats) if resultats else None

    def _choisir_depart(self) -> tuple[int, str] | None:
        """Une photo, ou None pour une partie normale. Le combat est tiré d'autant plus souvent
        qu'il est raté à l'exercice (un combat jamais essayé compte pour moitié réussi)."""
        with self.verrou_photos:
            if not self.photos or self.hasard.random() >= self.part_exercices:
                return None
            vagues = sorted(self.photos)
            poids = [0.1 + 1 - (self.reussite_exercices(v) if self.reussite_exercices(v) is not None else 0.5)
                     for v in vagues]
            vague = self.hasard.choices(vagues, weights=poids)[0]
            return vague, self.hasard.choice(self.photos[vague])

    def _noter_exercice(self, i: int, info: dict) -> None:
        if self.depart[i] is not None and "erreur" not in info:
            self.resultats_exercices.setdefault(self.depart[i], deque(maxlen=100)).append(info["vague"] > self.depart[i])

    def _nouvelle_partie(self, i: int) -> Etat:
        simulateur: Simulateur = self.pont.entretenir(i)
        while True:
            depart = self._choisir_depart()
            self.depart[i] = depart[0] if depart else None
            # « hasard » : trois starters différents d'un compte neuf ; sinon ceux du simulateur.
            especes = None
            if not depart and self.partie.get("starters") == "hasard":
                especes = self.hasard.sample(STARTERS_COMPTE_NEUF, 3)
            self.starters[i] = especes
            etat = simulateur.nouvelle_partie(especes=especes, style_combat=self.partie["style_combat"],
                                              vague_max=self.partie["vague_max"],
                                              depart=depart[1] if depart else None,
                                              photos=self.vagues_photos or None)
            if isinstance(etat, Etat):
                return etat
            # Partie finie avant la moindre décision (rarissime) : on la note et on recommence.
            self._garder_photos(etat.info)
            self.parties_finies.append({**etat.info, "starters": especes, "depart": self.depart[i], "recompense": 0.0})

    def jouer(self, i: int, action: int) -> tuple[float, bool]:
        """Joue l'action dans la copie n° i ; renvoie (récompense gagnée, partie terminée)."""
        avant = self.etats[i]
        try:
            apres: Etat | Fin = self.pont.simulateurs[i].agir(action)
        except (OSError, ConnectionError, ValueError) as erreur:
            # Copie du jeu figée ou tombée : on la remplace et on compte la partie comme perdue,
            # plutôt que de bloquer tout l'entraînement.
            self.parties_finies.append({**avant.info, "decisions": 0, "phases": 0, "secondes": 0,
                                        "starters": self.starters[i], "depart": self.depart[i],
                                        "recompense": round(self.cumul[i], 3),
                                        "erreur": f"simulateur n° {i} muet ou tombé ({type(erreur).__name__}), redémarré"})
            self.cumul[i] = 0.0
            self.pont.redemarrer(i)
            self.etats[i] = self._nouvelle_partie(i)
            return 0.0, True
        if isinstance(apres, Etat):
            points = self.recompense(avant.info, apres.info)
            self.cumul[i] += points
            self.etats[i] = apres
            return points, False
        points = self.recompense_fin(avant.info, apres.info)
        self._garder_photos(apres.info)
        self._noter_exercice(i, apres.info)
        self.parties_finies.append({**apres.info, "starters": self.starters[i], "depart": self.depart[i],
                                    "recompense": round(self.cumul[i] + points, 3)})
        self.cumul[i] = 0.0
        self.etats[i] = self._nouvelle_partie(i)
        return points, True

    def observations(self) -> tuple[np.ndarray, np.ndarray]:
        return (np.stack([e.observation for e in self.etats]), np.stack([e.masque for e in self.etats]))

    def etape(self, actions: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Joue une action par copie ; renvoie (récompenses, parties terminées)."""
        resultats = list(self.fils.map(self.jouer, range(self.nombre), actions.tolist()))
        return (np.array([r for r, _ in resultats], dtype=np.float32), np.array([f for _, f in resultats]))

    def vider_parties_finies(self) -> list[dict]:
        finies, self.parties_finies = self.parties_finies, []
        return finies
