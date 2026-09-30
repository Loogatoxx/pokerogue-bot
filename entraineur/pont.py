"""Le pont entre le cerveau (Python) et le jeu (Node, sans écran).

Lance N copies du jeu en parallèle (simulateur/environnement.test.ts, une par processus Node)
et leur parle en TCP sur la machine locale : une ligne JSON par message.

    pont = Pont(8)
    partie = pont.simulateurs[0]
    etat = partie.nouvelle_partie()            # → Etat (une décision à prendre) ou Fin
    etat = partie.agir(action)                 # idem, jusqu'à Fin
    pont.fermer()
"""
from __future__ import annotations

import base64
import json
import os
import shutil
import socket
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent.parent
JEU = RACINE / "jeu"
JOURNAUX = RACINE / ".journaux"
# Fichiers du simulateur copiés dans le jeu : ses raccourcis d'import (#app, #enums…)
# ne fonctionnent que depuis l'intérieur du jeu.
FICHIERS_SIMULATEUR = ["environnement.test.ts", "outils-partie.ts"]


@dataclass
class Etat:
    """Une décision à prendre : ce que voit le cerveau et ce que le jeu permet."""
    observation: np.ndarray  # float32, taille tailleEntree
    masque: np.ndarray       # bool, taille nombreActions
    info: dict               # vague, PV de l'équipe… (pour calculer la récompense)


@dataclass
class Fin:
    """Fin de partie : vague atteinte, victoire, erreur éventuelle."""
    info: dict


class Simulateur:
    """Une copie du jeu, qui joue une partie à la fois."""

    def __init__(self, connexion: socket.socket):
        self.connexion = connexion
        self.fichier = connexion.makefile("rwb")
        # Premier message du simulateur : il se présente (numéro, tailles, versions).
        self.pret: dict = json.loads(self.fichier.readline())
        self.id: int = self.pret["id"]

    def _envoyer(self, message: dict) -> None:
        self.fichier.write(json.dumps(message).encode() + b"\n")
        self.fichier.flush()

    def _recevoir(self) -> Etat | Fin:
        ligne = self.fichier.readline()
        if not ligne:
            raise ConnectionError(f"le simulateur n° {self.id} s'est arrêté (voir {JOURNAUX})")
        message = json.loads(ligne)
        if message["type"] == "fin-partie":
            return Fin(message["info"])
        return Etat(
            observation=np.frombuffer(base64.b64decode(message["observation"]), dtype="<f4").copy(),
            masque=np.array(message["masque"], dtype=bool),
            info=message["info"],
        )

    def nouvelle_partie(self, graine: str | None = None, especes: list[int] | None = None,
                        style_combat: str = "fixe") -> Etat | Fin:
        """style_combat : « fixe » ou « changer » (le jeu propose alors de changer après chaque K.O.)."""
        demande: dict = {"type": "nouvelle-partie", "styleCombat": style_combat}
        if graine:
            demande["graine"] = graine
        if especes:
            demande["especes"] = especes
        self._envoyer(demande)
        return self._recevoir()

    def agir(self, action: int) -> Etat | Fin:
        self._envoyer({"type": "action", "action": int(action)})
        return self._recevoir()

    def fermer(self) -> None:
        try:
            self._envoyer({"type": "fin"})
        except OSError:
            pass
        self.connexion.close()


class Pont:
    def __init__(self, nombre: int, attente_s: float = 180):
        if not JEU.exists():
            raise FileNotFoundError(f"La copie du jeu est introuvable : {JEU} (voir README)")
        (JEU / "test" / "bot").mkdir(parents=True, exist_ok=True)
        for nom in FICHIERS_SIMULATEUR:
            shutil.copy(RACINE / "simulateur" / nom, JEU / "test" / "bot" / nom)
        JOURNAUX.mkdir(exist_ok=True)

        self.serveur = socket.create_server(("127.0.0.1", 0))
        self.serveur.settimeout(attente_s)
        port = self.serveur.getsockname()[1]
        self.processus = []
        for i in range(nombre):
            env = dict(os.environ, PONT_PORT=str(port), PONT_ID=str(i),
                       NODE_OPTIONS="--no-experimental-webstorage")
            journal = open(JOURNAUX / f"simulateur-{i}.log", "wb")
            self.processus.append(subprocess.Popen(
                ["pnpm", "exec", "vitest", "run", "--silent=passed-only", "test/bot/environnement.test.ts"],
                cwd=JEU, env=env, stdout=journal, stderr=subprocess.STDOUT,
            ))

        self.simulateurs: list[Simulateur] = []
        for _ in range(nombre):
            connexion, _ = self.serveur.accept()
            connexion.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.simulateurs.append(Simulateur(connexion))
        self.simulateurs.sort(key=lambda s: s.id)
        pret = self.simulateurs[0].pret

        # Ce que le jeu impose au cerveau : taille de l'observation, nombre d'actions, versions.
        self.taille_entree: int = pret["tailleEntree"]
        self.nombre_actions: int = pret["nombreActions"]
        self.versions = {"versionObservation": pret["versionObservation"], "versionEncodage": pret["versionEncodage"]}

    def fermer(self) -> None:
        for simulateur in self.simulateurs:
            simulateur.fermer()
        for processus in self.processus:
            try:
                processus.wait(timeout=30)
            except subprocess.TimeoutExpired:
                processus.kill()
        self.serveur.close()

    def __enter__(self) -> "Pont":
        return self

    def __exit__(self, *_: object) -> None:
        self.fermer()
