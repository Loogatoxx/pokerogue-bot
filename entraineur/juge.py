"""Le juge de coups : pour chaque décision du cerveau, quel coup aurait été le meilleur ?

Suite du professeur (entraineur/professeur.py). Imiter un essai gagnant en bloc apprenait surtout
du bruit : on ne savait pas lequel de ses coups avait fait gagner (l'élève de la v1 n'a pas
progressé : 36,1 contre 37,2). Ici, chaque décision est jugée séparément :

1. le cerveau joue la vague normalement (meilleur coup, guidé par le planificateur) ;
2. à chaque décision des combats contre un dresseur ou un boss (et une sur quatre ailleurs), on
   prend ses 3 coups les plus probables — même quand il est sûr de lui : guidé par le planificateur,
   il l'est presque toujours, et c'est là qu'il faut le corriger ; pour chacun, on
   rejoue la vague **à l'identique** jusqu'à cette décision (le combat garde le hasard du jeu :
   mêmes coups, même résultat), on joue ce coup, puis on finit la vague avec 3 avenirs différents
   (nouvelle graine du combat à ce moment-là) ;
3. le coup qui laisse en moyenne l'équipe la plus forte en fin de vague est la bonne réponse.

Juger sur plusieurs avenirs, c'est juger le coup et non la chance (un coup critique tombé une fois).
Les situations viennent des parties du cerveau lui-même : l'élève apprend là où il se trompe vraiment
(méthode « DAgger »). La triche (rejouer) ne sert qu'à l'entraînement.

Usage :
  .venv/bin/python -m entraineur.juge [cerveau] --parties 100 --processus 8
Sorties : /Volumes/Lexar/pokerogue-bot/juge/<date>/ (mêmes fichiers que le professeur :
entraineur/imitation.py les lit tels quels).
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

os.environ.setdefault("PONT_REDEMARRAGE", "150")

import numpy as np  # noqa: E402
import torch  # noqa: E402

from .ensemble import STARTERS_COMPTE_NEUF  # noqa: E402
from .format_cerveau import lire  # noqa: E402
from .pont import Etat, Pont  # noqa: E402
from .entrainer import Entrainement  # noqa: E402
from .professeur import note_equipe  # noqa: E402

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V5 = LEXAR / "cerveaux" / "v5-2026-10-01.cerveau"
CANDIDATS = 3        # coups jugés à chaque décision
AVENIRS = 3          # graines différentes pour finir la vague après le coup jugé
PART_ORDINAIRE = 0.25  # hors dresseurs et boss, une décision sur quatre est jugée (tirée au hasard)
PERDUE = -5.0        # valeur d'une vague perdue


def scores_de(cerveau, etat: Etat) -> torch.Tensor:
    plan = None if etat.plan is None else torch.from_numpy(etat.plan).unsqueeze(0)
    with torch.no_grad():
        scores, _ = cerveau(torch.from_numpy(etat.observation).unsqueeze(0), torch.from_numpy(etat.masque).unsqueeze(0), plan)
    return scores[0]


class Parcours:
    """Une vague jouée depuis sa photo : situations, actions, et comment elle finit."""

    def __init__(self) -> None:
        self.etats: list[Etat] = []
        self.actions: list[int] = []
        self.valeur = PERDUE
        self.gagne = False
        self.photo_suivante: str | None = None
        self.info: dict = {}


def jouer(simulateur, cerveau, vague: int, graine: str, depart: str | None, especes: list[int] | None,
          prefixe: list[int] = (), coup: int | None = None, hasard: str | None = None) -> Parcours:
    """Joue la vague : d'abord les actions du préfixe (rejouées à l'identique), puis `coup` avec la
    graine `hasard` (s'il est donné), puis le meilleur coup du cerveau jusqu'à la fin de la vague."""
    p = Parcours()
    partie = {"depart": depart} if depart else {"especes": especes}
    etat = simulateur.nouvelle_partie(graine=graine, photos=[vague, vague + 1], vague_max=vague, style_combat="changer",
                                      hasard_du_jeu=True, **partie)
    while isinstance(etat, Etat):
        k = len(p.actions)
        nouvelle_graine = None
        if k < len(prefixe):
            action = prefixe[k]
        elif k == len(prefixe) and coup is not None:
            action, nouvelle_graine = coup, hasard
        else:
            action = int(scores_de(cerveau, etat).argmax())
        p.etats.append(etat)
        p.actions.append(action)
        etat = simulateur.agir(action, hasard=nouvelle_graine)
    p.info = etat.info
    photos = etat.info.get("photos", {})
    p.photo_suivante = photos.get(str(vague + 1))
    p.gagne = bool(etat.info.get("tronquee")) and p.photo_suivante is not None and "erreur" not in etat.info
    p.valeur = note_equipe(etat.info.get("bilan", {})) if p.gagne else PERDUE
    return p


def partie_jugee(pont: Pont, i: int, cerveau, vague_max: int, especes: list[int], graine: str) -> dict:
    exemples: dict[str, list] = {"observations": [], "masques": [], "plans": [], "aPlan": [], "actions": [], "vagues": [], "poids": [], "habituels": []}
    jugees = corrigees = 0
    tirage = random.Random(graine)
    depart: str | None = None
    vague = 1
    while vague <= vague_max:
        simulateur = pont.entretenir(i)
        try:
            if depart is None:
                # Vague 1 : une première fois depuis le début pour obtenir sa photo, puis tout depuis la photo.
                debut = jouer(simulateur, cerveau, vague, graine, None, especes)
                depart = debut.info.get("photos", {}).get(str(vague))
                if depart is None:
                    break
            reel = jouer(simulateur, cerveau, vague, graine, depart, None)
            for d, etat in enumerate(reel.etats):
                scores = scores_de(cerveau, etat)
                probas = torch.softmax(scores, -1)
                permis = [a for a in range(len(etat.masque)) if etat.masque[a]]
                if len(permis) < 2 or (not etat.info.get("important") and tirage.random() > PART_ORDINAIRE):
                    continue
                candidats = [int(a) for a in torch.topk(probas, min(CANDIDATS, len(permis))).indices if etat.masque[int(a)]]
                q = {}
                for a in candidats:
                    valeurs = []
                    for r in range(AVENIRS):
                        simulateur = pont.entretenir(i)
                        essai = jouer(simulateur, cerveau, vague, graine, depart, None, reel.actions[:d], a, f"{graine}-{vague}-{d}-{r}")
                        valeurs.append(essai.valeur)
                    q[a] = float(np.mean(valeurs))
                meilleur = max(q, key=q.get)
                habituel = reel.actions[d]
                ecart = q[meilleur] - q.get(habituel, q[meilleur])
                jugees += 1
                corrigees += meilleur != habituel
                exemples["observations"].append(etat.observation.astype(np.float16))
                exemples["masques"].append(etat.masque.copy())
                exemples["plans"].append(np.zeros(len(etat.masque), np.float16) if etat.plan is None else etat.plan.astype(np.float16))
                exemples["aPlan"].append(etat.plan is not None)
                exemples["actions"].append(meilleur)
                exemples["vagues"].append(vague)
                exemples["habituels"].append(habituel)
                # Un coup qui change le résultat compte beaucoup ; confirmer le coup habituel, peu.
                exemples["poids"].append(min(1.0, max(0.1, ecart / 0.5)) if meilleur != habituel else 0.1)
        except (TimeoutError, ConnectionError, OSError):
            pont.redemarrer(i)
            break
        if not reel.gagne:
            break
        depart = reel.photo_suivante
        vague += 1
    return {"vague": vague, "jugees": jugees, "corrigees": corrigees, "exemples": exemples}


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path, nargs="?", default=V5)
    parametres.add_argument("--parties", type=int, default=100)
    parametres.add_argument("--vague-max", type=int, default=200)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--sortie", type=Path)
    args = parametres.parse_args()
    torch.set_num_threads(1)
    cerveau, entete = lire(args.cerveau)
    cerveau.eval()
    sortie = args.sortie or LEXAR / "juge" / datetime.now().strftime("%Y-%m-%d-%Hh%M")
    sortie.mkdir(parents=True, exist_ok=True)
    print(f"Juge : {entete['nom']} — {args.parties} parties, {CANDIDATS} coups × {AVENIRS} avenirs par décision")
    print(f"Sorties : {sortie}", flush=True)
    hasard = random.Random(int(time.time()))
    verrou = threading.Lock()
    restantes = [args.parties]

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
            r = partie_jugee(pont, i, cerveau, args.vague_max, especes, graine)
            ex = r.pop("exemples")
            # Le Lexar peut se déconnecter un instant (02/10, 20 h 45) : on réessaie au lieu de planter.
            if ex["actions"]:
                Entrainement.patienter_disque(lambda: np.savez_compressed(
                    sortie / f"partie-{numero:04d}.npz", observations=np.stack(ex["observations"]), masques=np.stack(ex["masques"]),
                    plans=np.stack(ex["plans"]), aPlan=np.array(ex["aPlan"]), actions=np.array(ex["actions"], np.int16),
                    vagues=np.array(ex["vagues"], np.int16), poids=np.array(ex["poids"], np.float32),
                    habituels=np.array(ex["habituels"], np.int16)))
            ligne = {"partie": numero, "starters": especes, "graine": graine, **r, "minutes": round((time.time() - debut) / 60, 1)}
            with verrou:
                def noter() -> None:
                    with open(sortie / "parties.jsonl", "a", encoding="utf-8") as f:
                        f.write(json.dumps(ligne) + "\n")
                Entrainement.patienter_disque(noter)
                print(f"  partie {numero} : vague {r['vague']}, {r['jugees']} décisions jugées, "
                      f"{r['corrigees']} corrigées, {ligne['minutes']} min", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()


if __name__ == "__main__":
    main()
