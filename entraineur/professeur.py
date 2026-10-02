"""Le professeur : des parties quasi parfaites, obtenues en « trichant », pour que le cerveau les imite.

Idée de Carlos (02/10) : « une chose que j'autorise pour l'entraînement, c'est de tricher : lui
montrer des runs parfaites, qu'elle essaiera de reproduire ; on peut recommencer une même partie à
l'infini ». La triche ne sert qu'à l'entraînement : en jeu, le cerveau ne voit toujours que ce
qu'un humain voit.

Comment : le simulateur photographie le début de chaque vague (la sauvegarde du jeu) et sait en
repartir. Pour chaque vague, le professeur la rejoue `--essais` fois depuis sa photo — un essai
avec le meilleur coup du cerveau (guidé par le planificateur), les autres en tirant au sort selon
ses probabilités — puis garde le meilleur (vague gagnée, avec le plus de PV et de niveaux) et repart
de là. Les décisions de l'essai gardé sont enregistrées : ce sont les exemples à imiter
(observation → action), pour entraineur/imitation.py.

Limite connue : chaque essai a son propre hasard ; garder le meilleur, c'est aussi garder un peu de
chance (un coup critique). Sur des milliers de vagues, ce qui reste surtout, ce sont les bonnes
décisions ; on pourra juger chaque essai sur plusieurs tirages si l'imitation en souffre.

Mesure aussi l'idée de Carlos : « chaque partie est gagnable, sauf de rares cas au rival 1 ».

Usage :
  .venv/bin/python -m entraineur.professeur [cerveau] --parties 40 --essais 8 --vague-max 200 --processus 8
Sorties : /Volumes/Lexar/pokerogue-bot/professeur/<date>/ (une partie = un .npz d'exemples,
plus une ligne dans parties.jsonl).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import string
import threading
import time
from datetime import datetime
from pathlib import Path

# Une partie du professeur enchaîne des centaines de reprises courtes : redémarrer la copie du jeu
# toutes les 30 « parties » (réglage de l'entraînement) coûterait plus que la fuite de mémoire.
os.environ.setdefault("PONT_REDEMARRAGE", "150")

import numpy as np  # noqa: E402
import torch  # noqa: E402

from .ensemble import STARTERS_COMPTE_NEUF  # noqa: E402
from .format_cerveau import lire  # noqa: E402
from .pont import Etat, Pont  # noqa: E402

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V5 = LEXAR / "cerveaux" / "v5-2026-10-01.cerveau"


def note_equipe(bilan: dict) -> float:
    """Note de l'état de l'équipe au début de la vague suivante : chaque membre compte selon son
    niveau (le porteur compte le plus) et ses PV restants ; un peu pour les niveaux gagnés."""
    equipe = bilan.get("equipe", [])
    if not equipe:
        return 0.0
    porteur = max(m["niveau"] for m in equipe)
    vie = sum((m["niveau"] / porteur) * (0 if m["ko"] else m["pv"] / max(m["pvMax"], 1)) for m in equipe)
    return vie + 0.02 * sum(m["niveau"] for m in equipe)


class Essai:
    """Une vague jouée une fois : ses décisions, et comment elle finit."""

    def __init__(self) -> None:
        self.observations: list[np.ndarray] = []
        self.masques: list[np.ndarray] = []
        self.plans: list[np.ndarray | None] = []
        self.actions: list[int] = []
        self.gagne = False
        self.photo_suivante: str | None = None
        self.note = float("-inf")
        self.info: dict = {}


def jouer_essai(simulateur, cerveau, depart: str | None, vague: int, tirage: bool, **partie) -> Essai:
    essai = Essai()
    etat = simulateur.nouvelle_partie(depart=depart, photos=[vague, vague + 1], vague_max=vague, style_combat="changer", **partie)
    while isinstance(etat, Etat):
        plan = None if etat.plan is None else torch.from_numpy(etat.plan)
        action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=tirage, plan=plan)
        essai.observations.append(etat.observation.astype(np.float16))
        essai.masques.append(etat.masque.copy())
        essai.plans.append(None if etat.plan is None else etat.plan.astype(np.float16))
        essai.actions.append(int(action))
        etat = simulateur.agir(action)
    essai.info = etat.info
    photos = etat.info.get("photos", {})
    essai.photo_suivante = photos.get(str(vague + 1))
    essai.gagne = bool(etat.info.get("tronquee")) and essai.photo_suivante is not None and "erreur" not in etat.info
    essai.note = note_equipe(etat.info.get("bilan", {})) if essai.gagne else float("-inf")
    return essai


def partie_du_professeur(pont: Pont, i: int, cerveau, essais: int, vague_max: int, especes: list[int], graine: str) -> dict:
    """Une partie entière, vague par vague, en gardant à chaque fois le meilleur des essais."""
    exemples: dict[str, list] = {"observations": [], "masques": [], "plans": [], "aPlan": [], "actions": [], "vagues": []}
    reussites: list[int] = []
    depart: str | None = None
    vague = 1
    while vague <= vague_max:
        meilleur: Essai | None = None
        gagnes = 0
        for k in range(essais):
            simulateur = pont.entretenir(i)
            try:
                essai = jouer_essai(simulateur, cerveau, depart, vague, tirage=k > 0,
                                    **({"especes": especes, "graine": graine} if depart is None else {"graine": graine}))
            except (TimeoutError, ConnectionError, OSError):
                pont.redemarrer(i)
                continue
            if depart is None and vague == 1:
                # La photo du début de la vague 1 : les essais suivants repartent de là.
                depart_v1 = essai.info.get("photos", {}).get("1")
                if depart_v1:
                    depart = depart_v1
            gagnes += essai.gagne
            if essai.gagne and (meilleur is None or essai.note > meilleur.note):
                meilleur = essai
        reussites.append(gagnes)
        if meilleur is None:
            return {"vague": vague, "mur": vague, "reussitesParVague": reussites, "exemples": exemples}
        n = len(meilleur.actions)
        exemples["observations"] += meilleur.observations
        exemples["masques"] += meilleur.masques
        exemples["plans"] += [p if p is not None else np.zeros(len(meilleur.masques[0]), np.float16) for p in meilleur.plans]
        exemples["aPlan"] += [p is not None for p in meilleur.plans]
        exemples["actions"] += meilleur.actions
        exemples["vagues"] += [vague] * n
        depart = meilleur.photo_suivante
        vague += 1
    return {"vague": vague, "mur": None, "reussitesParVague": reussites, "exemples": exemples}


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path, nargs="?", default=V5)
    parametres.add_argument("--parties", type=int, default=40)
    parametres.add_argument("--essais", type=int, default=8, help="essais par vague (le 1er : meilleur coup ; les autres : tirage)")
    parametres.add_argument("--vague-max", type=int, default=200)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--sortie", type=Path, help="dossier (par défaut : professeur/<date> sur le Lexar)")
    args = parametres.parse_args()
    torch.set_num_threads(1)
    cerveau, entete = lire(args.cerveau)
    cerveau.eval()
    sortie = args.sortie or LEXAR / "professeur" / datetime.now().strftime("%Y-%m-%d-%Hh%M")
    sortie.mkdir(parents=True, exist_ok=True)
    print(f"Professeur : {entete['nom']} — {args.parties} parties, {args.essais} essais par vague, jusqu'à la vague {args.vague_max}")
    print(f"Sorties : {sortie}", flush=True)

    hasard = random.Random(int(time.time()))
    verrou = threading.Lock()
    restantes = [args.parties]
    faites: list[dict] = []

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if restantes[0] <= 0:
                    return
                restantes[0] -= 1
                numero = args.parties - restantes[0]
                especes = hasard.sample(STARTERS_COMPTE_NEUF, 3)
                graine = "".join(hasard.choices(string.ascii_lowercase + string.digits, k=10))
            debut = time.time()
            resultat = partie_du_professeur(pont, i, cerveau, args.essais, args.vague_max, especes, graine)
            ex = resultat.pop("exemples")
            fichier = sortie / f"partie-{numero:04d}.npz"
            if ex["actions"]:
                np.savez_compressed(
                    fichier, observations=np.stack(ex["observations"]), masques=np.stack(ex["masques"]),
                    plans=np.stack(ex["plans"]), aPlan=np.array(ex["aPlan"]), actions=np.array(ex["actions"], np.int16),
                    vagues=np.array(ex["vagues"], np.int16))
            ligne = {"partie": numero, "starters": especes, "graine": graine, **resultat, "exemples": len(ex["actions"]),
                     "minutes": round((time.time() - debut) / 60, 1)}
            with verrou:
                faites.append(ligne)
                with open(sortie / "parties.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps(ligne) + "\n")
                mur = f"bloqué à la vague {ligne['mur']}" if ligne["mur"] else "arrivé au bout"
                print(f"  partie {numero} : vague {ligne['vague']} ({mur}), {ligne['exemples']} exemples, {ligne['minutes']} min", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    if faites:
        vagues = [p["vague"] for p in faites]
        murs = [p["mur"] for p in faites if p["mur"]]
        print(f"\n{len(faites)} parties : vague moyenne {np.mean(vagues):.1f}, "
              f"passent le rival 1 : {100 * np.mean([v > 8 for v in vagues]):.0f} %, le rival 2 : {100 * np.mean([v > 25 for v in vagues]):.0f} %")
        if murs:
            print("Murs (vague où même le meilleur des essais perd) :", sorted(murs))


if __name__ == "__main__":
    main()
