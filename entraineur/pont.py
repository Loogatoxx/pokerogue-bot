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
import signal
import socket
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent.parent
JEU = RACINE / "jeu"
JOURNAUX = RACINE / ".journaux"
# Fichiers du simulateur copiés dans le jeu : ses raccourcis d'import (#app, #enums…)
# ne fonctionnent que depuis l'intérieur du jeu.
FICHIERS_SIMULATEUR = ["environnement.test.ts", "outils-partie.ts"]
# Chaque copie du jeu perdait de la mémoire à chaque partie, et ralentissait avec elle. Les fuites
# de l'outil de test sont colmatées entre deux parties (menageEntreParties dans
# simulateur/environnement.test.ts) ; il en reste une petite (textes retenus par la réserve de
# canevas de Phaser, ~5-10 Mo par longue partie). On redémarre donc chaque copie au bout de ce
# nombre de parties (~8 s de démarrage, sans gêner les autres depuis la collecte asynchrone).
PARTIES_AVANT_REDEMARRAGE = int(os.environ.get("PONT_REDEMARRAGE", 30))
# Une copie du jeu qui ne répond plus du tout pendant ce délai est considérée comme figée (côté
# jeu, un écran bloqué est déjà signalé au bout de 60 s : ceci est le dernier filet de sécurité).
# 600 → 120 s le 01/10 : la collecte attend chaque copie avant d'apprendre, une copie figée
# immobilisait donc tout l'entraînement 10 minutes (entrainement-6, mise à jour 225).
SILENCE_MAX_S = 120


@dataclass
class Etat:
    """Une décision à prendre : ce que voit le cerveau et ce que le jeu permet."""
    observation: np.ndarray  # float32, taille tailleEntree
    masque: np.ndarray       # bool, taille nombreActions
    info: dict               # vague, PV de l'équipe… (pour calculer la récompense)
    # Valeur de chaque action selon le planificateur (observateur/planificateur.ts), ou None.
    plan: np.ndarray | None = None


@dataclass
class Fin:
    """Fin de partie : vague atteinte, victoire, erreur éventuelle."""
    info: dict


class Simulateur:
    """Une copie du jeu, qui joue une partie à la fois."""

    def __init__(self, connexion: socket.socket):
        self.connexion = connexion
        self.connexion.settimeout(SILENCE_MAX_S)  # une lecture muette lève une erreur au lieu d'attendre toujours
        self.fichier = connexion.makefile("rwb")
        # Premier message du simulateur : il se présente (numéro, tailles, versions).
        self.pret: dict = json.loads(self.fichier.readline())
        self.id: int = self.pret["id"]
        self.parties = 0

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
            plan=np.array(message["plan"], dtype=np.float32) if message.get("plan") else None,
        )

    def nouvelle_partie(self, graine: str | None = None, especes: list[int] | None = None,
                        style_combat: str = "fixe", vague_max: int | None = None, recit: bool = False,
                        depart: str | None = None, photos: list[int] | None = None,
                        plan_capture: bool = False, mysteres: str | int | None = None) -> Etat | Fin:
        """style_combat : « fixe » ou « changer » (le jeu propose alors de changer après chaque K.O.).
        vague_max : la partie s'arrête au-delà (info « tronquee »), pour le programme progressif.
        recit : la fin de partie contient aussi le récit (forces en présence à chaque vague, et l'état
        des deux équipes en cas de défaite), pour l'analyse.
        depart : repartir d'une photo (sauvegarde du début d'une vague) au lieu d'une nouvelle partie.
        photos : vagues dont la fin de partie renverra la photo du début (« photos » : vague → texte)."""
        self.parties += 1
        demande: dict = {"type": "nouvelle-partie", "styleCombat": style_combat}
        if vague_max:
            demande["vagueMax"] = vague_max
        if graine:
            demande["graine"] = graine
        if especes:
            demande["especes"] = especes
        if recit:
            demande["recit"] = True
        if depart:
            demande["depart"] = depart
        if photos:
            demande["photos"] = photos
        if plan_capture:
            demande["planCapture"] = True
        if mysteres is not None:
            demande["mysteres"] = mysteres
        self._envoyer(demande)
        return self._recevoir()

    def agir(self, action: int) -> Etat | Fin:
        self._envoyer({"type": "action", "action": int(action)})
        return self._recevoir()

    def fermer(self) -> None:
        try:
            self._envoyer({"type": "fin"})
        except (OSError, ValueError):
            pass
        try:
            self.connexion.close()
        except OSError:
            pass


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
        self.port = self.serveur.getsockname()[1]
        self.processus: list[subprocess.Popen] = [self._lancer(i) for i in range(nombre)]
        # Connexions arrivées, rangées par numéro de simulateur : plusieurs copies peuvent
        # redémarrer en même temps, chacune récupère la sienne.
        self._arrivees: dict[int, Simulateur] = {}
        self._condition = threading.Condition()
        self._accepteur_occupe = False

        self.simulateurs: list[Simulateur] = [self._connexion_de(i) for i in range(nombre)]
        pret = self.simulateurs[0].pret

        # Ce que le jeu impose au cerveau : taille de l'observation, nombre d'actions, versions.
        self.taille_entree: int = pret["tailleEntree"]
        self.nombre_actions: int = pret["nombreActions"]
        self.versions = {"versionObservation": pret["versionObservation"], "versionEncodage": pret["versionEncodage"]}

    def _lancer(self, i: int) -> subprocess.Popen:
        env = dict(os.environ, PONT_PORT=str(self.port), PONT_ID=str(i),
                   NODE_OPTIONS="--no-experimental-webstorage")
        journal = open(JOURNAUX / f"simulateur-{i}.log", "wb")
        return subprocess.Popen(
            ["pnpm", "exec", "vitest", "run", "--silent=passed-only", "test/bot/environnement.test.ts"],
            cwd=JEU, env=env, stdout=journal, stderr=subprocess.STDOUT,
            # Session à part : un Ctrl+C dans le terminal ne tue pas les copies du jeu en pleine
            # collecte ; c'est le Python qui les ferme proprement après la sauvegarde.
            start_new_session=True,
        )

    @staticmethod
    def _arreter(processus: subprocess.Popen) -> None:
        """Laisse la copie du jeu s'arrêter seule, sinon arrête tout son groupe de processus
        (pnpm, vitest et le processus de travail qui fait tourner le jeu)."""
        try:
            processus.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        for signal_ in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(processus.pid, signal_)
            except (ProcessLookupError, PermissionError):
                return
            try:
                processus.wait(timeout=5)
                return
            except subprocess.TimeoutExpired:
                continue

    def _accepter(self) -> Simulateur:
        connexion, _ = self.serveur.accept()
        connexion.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        return Simulateur(connexion)

    def _connexion_de(self, i: int) -> Simulateur:
        """Attend la connexion du simulateur n° i (un seul fil accepte à la fois, les autres
        attendent que leur numéro arrive)."""
        with self._condition:
            while i not in self._arrivees:
                if self._accepteur_occupe:
                    self._condition.wait()
                    continue
                self._accepteur_occupe = True
                self._condition.release()
                try:
                    simulateur = self._accepter()
                finally:
                    self._condition.acquire()
                    self._accepteur_occupe = False
                self._arrivees[simulateur.id] = simulateur
                self._condition.notify_all()
            return self._arrivees.pop(i)

    def entretenir(self, i: int) -> Simulateur:
        """Le simulateur n° i, redémarré s'il a joué trop de parties (fuite de mémoire du jeu).
        Les seuils sont échelonnés (50, 55, 60… ou 10, 11, 12…) pour que les copies ne redémarrent
        pas toutes en même temps."""
        simulateur = self.simulateurs[i]
        if simulateur.parties < PARTIES_AVANT_REDEMARRAGE + i * max(1, PARTIES_AVANT_REDEMARRAGE // 10):
            return simulateur
        return self.redemarrer(i)

    def redemarrer(self, i: int) -> Simulateur:
        """Remplace la copie du jeu n° i par une neuve (fuite de mémoire, ou copie figée)."""
        self.simulateurs[i].fermer()
        self._arreter(self.processus[i])
        self.processus[i] = self._lancer(i)
        self.simulateurs[i] = self._connexion_de(i)
        return self.simulateurs[i]

    def fermer(self) -> None:
        for simulateur in self.simulateurs:
            simulateur.fermer()
        for processus in self.processus:
            self._arreter(processus)
        self.serveur.close()

    def __enter__(self) -> "Pont":
        return self

    def __exit__(self, *_: object) -> None:
        self.fermer()
