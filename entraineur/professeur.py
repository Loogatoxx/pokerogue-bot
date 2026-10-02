"""Le professeur : des parties quasi parfaites, obtenues en « trichant », pour que le cerveau les imite.

Idée de Carlos (02/10) : « une chose que j'autorise pour l'entraînement, c'est de tricher : lui
montrer des runs parfaites, qu'elle essaiera de reproduire ; on peut recommencer une même partie à
l'infini ». La triche ne sert qu'à l'entraînement : en jeu, le cerveau ne voit toujours que ce
qu'un humain voit.

Comment : le simulateur photographie le début de chaque vague (la sauvegarde du jeu) et sait en
repartir. Pour chaque vague, le professeur la rejoue `--essais` fois depuis sa photo — un essai
avec le meilleur coup du cerveau (guidé par le planificateur), les autres en tirant au sort parmi
les coups proches du meilleur (température 3, 5 ou 10) — puis garde le meilleur (vague gagnée, avec le plus de PV et de niveaux) et repart
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
        self.temperature = 0.0
        # Ce que ses décisions valent comme exemples : 1 = décisives (le meilleur coup du cerveau
        # perdait, ou il a fallu reculer), 0,1 = le meilleur coup du cerveau, gardé tel quel.
        self.poids = 0.1


def choisir(cerveau, etat: Etat, temperature: float) -> int:
    """Le meilleur coup (température 0), ou un tirage parmi des coups proches du meilleur. Le
    planificateur pèse 30 fois ses valeurs : sans température, le tirage reprendrait presque
    toujours le même coup, et les essais ne différeraient que par la chance."""
    plan = None if etat.plan is None else torch.from_numpy(etat.plan).unsqueeze(0)
    with torch.no_grad():
        scores, _ = cerveau(torch.from_numpy(etat.observation).unsqueeze(0), torch.from_numpy(etat.masque).unsqueeze(0), plan)
    if temperature <= 0:
        return int(scores[0].argmax())
    return int(torch.multinomial(torch.softmax(scores[0] / temperature, dim=-1), 1).item())


TEMPERATURES = (0.0, 3.0, 5.0, 10.0)  # essai 1 : meilleur coup ; puis de plus en plus d'audace


def jouer_essai(simulateur, cerveau, depart: str | None, vague: int, temperature: float, **partie) -> Essai:
    essai = Essai()
    essai.temperature = temperature
    etat = simulateur.nouvelle_partie(depart=depart, photos=[vague, vague + 1], vague_max=vague, style_combat="changer", **partie)
    while isinstance(etat, Etat):
        action = choisir(cerveau, etat, temperature)
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


CANDIDATS_GARDES = 3   # essais gagnants gardés par vague, pour pouvoir y revenir
RECUL_MAX = 8          # face à un mur, on peut revenir jusqu'à 8 vagues en arrière
RETOURS_PAR_MUR = 10   # retours en arrière au plus pour franchir un même mur…
RETOURS_MAX = 40       # … et au plus, par partie
ESSAIS_MUR = 2         # sur une vague qui vient de faire mur, deux fois plus d'essais


def jouer_vague(pont: Pont, i: int, cerveau, essais: int, vague: int, depart: str | None,
                partie: dict) -> tuple[list[Essai], list[dict], str | None, int]:
    """Joue la vague `essais` fois ; renvoie les essais gagnants gardés (du meilleur au moins bon),
    un résumé des échecs, la photo du début de la vague (utile pour la vague 1) et le nombre
    d'essais gagnants."""
    gagnants: list[Essai] = []
    reference: float | None = None  # note du meilleur coup du cerveau (essai sans température), s'il gagne
    echecs: list[dict] = []
    for k in range(essais):
        simulateur = pont.entretenir(i)
        try:
            essai = jouer_essai(simulateur, cerveau, depart, vague, TEMPERATURES[k % len(TEMPERATURES)] if k else 0.0,
                                **(partie if depart is None else {"graine": partie["graine"]}))
        except (TimeoutError, ConnectionError, OSError):
            pont.redemarrer(i)
            continue
        if depart is None:
            # Vague 1 : la photo de son début ; les essais suivants repartent de là.
            depart = essai.info.get("photos", {}).get(str(vague)) or depart
        if essai.gagne:
            gagnants.append(essai)
            if essai.temperature == 0:
                reference = essai.note
        else:
            echecs.append({"vague": essai.info.get("vague"), "victoire": essai.info.get("victoire"), "erreur": essai.info.get("erreur")})
    gagnants.sort(key=lambda e: e.note, reverse=True)
    for essai in gagnants:
        if essai.temperature == 0:
            essai.poids = 0.1
        elif reference is None:
            essai.poids = 1.0  # le meilleur coup du cerveau perdait cette vague : celui-ci la gagne
        else:
            essai.poids = min(1.0, max(0.1, (essai.note - reference) / 0.5))
    return gagnants[:CANDIDATS_GARDES], echecs, depart, len(gagnants)


def partie_du_professeur(pont: Pont, i: int, cerveau, essais: int, vague_max: int, especes: list[int], graine: str) -> dict:
    """Une partie entière, vague par vague, en gardant le meilleur des essais. Face à un mur (tous
    les essais perdent), on revient en arrière comme un joueur qui recharge une sauvegarde plus
    ancienne : la vague d'avant avec son 2e ou 3e meilleur essai, puis encore avant si besoin."""
    partie = {"especes": especes, "graine": graine}
    # Le chemin suivi : pour chaque vague jouée, ses candidats gagnants et celui qu'on a pris.
    chemin: list[dict] = []
    depart: str | None = None
    vague = 1
    retours = 0
    murs: list[int] = []
    retours_par_mur: dict[int, int] = {}
    mur_actuel: int | None = None
    reussites: dict[int, int] = {}
    while vague <= vague_max:
        essais_ici = essais * (ESSAIS_MUR if vague == mur_actuel else 1)
        gagnants, echecs, photo_depart, nb_gagnants = jouer_vague(pont, i, cerveau, essais_ici, vague, depart, partie)
        reussites[vague] = nb_gagnants
        if gagnants:
            chemin.append({"vague": vague, "depart": photo_depart, "candidats": gagnants, "choisi": 0})
            depart = gagnants[0].photo_suivante
            vague += 1
            continue
        # Un mur : revenir en arrière vers une vague qui a encore un autre candidat.
        murs.append(vague)
        mur = vague
        mur_actuel = mur
        retours_par_mur[mur] = retours_par_mur.get(mur, 0) + 1
        repris = False
        while (retours < RETOURS_MAX and retours_par_mur[mur] <= RETOURS_PAR_MUR
               and chemin and chemin[-1]["vague"] >= mur - RECUL_MAX):
            etape = chemin[-1]
            if etape["choisi"] + 1 < len(etape["candidats"]):
                etape["choisi"] += 1
                etape["decisif"] = True  # ce choix-là a servi à franchir un mur
                retours += 1
                depart = etape["candidats"][etape["choisi"]].photo_suivante
                vague = etape["vague"] + 1
                repris = True
                break
            chemin.pop()  # plus d'autre candidat ici : on recule encore
        if not repris:
            break
    exemples: dict[str, list] = {"observations": [], "masques": [], "plans": [], "aPlan": [], "actions": [], "vagues": [], "poids": []}
    for etape in chemin:
        essai = etape["candidats"][etape["choisi"]]
        n = len(essai.actions)
        exemples["poids"] += [1.0 if etape.get("decisif") else essai.poids] * n
        exemples["observations"] += essai.observations
        exemples["masques"] += essai.masques
        exemples["plans"] += [p if p is not None else np.zeros(len(essai.masques[0]), np.float16) for p in essai.plans]
        exemples["aPlan"] += [p is not None for p in essai.plans]
        exemples["actions"] += essai.actions
        exemples["vagues"] += [etape["vague"]] * n
    arrivee = vague if vague > vague_max else (chemin[-1]["vague"] + 1 if chemin else 1)
    # L'équipe au début de chaque vague du chemin gardé (pour comparer avec celle du cerveau seul).
    equipes = {etape["vague"] + 1: etape["candidats"][etape["choisi"]].info.get("bilan", {}).get("equipe", []) for etape in chemin}
    return {"vague": arrivee, "mur": None if vague > vague_max else vague, "murs": murs, "retours": retours,
            "reussitesParVague": [reussites.get(v, 0) for v in range(1, arrivee + 1)], "equipes": equipes,
            "exemples": exemples}


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
            resultat.pop("equipes", None)
            fichier = sortie / f"partie-{numero:04d}.npz"
            if ex["actions"]:
                np.savez_compressed(
                    fichier, observations=np.stack(ex["observations"]), masques=np.stack(ex["masques"]),
                    plans=np.stack(ex["plans"]), aPlan=np.array(ex["aPlan"]), actions=np.array(ex["actions"], np.int16),
                    vagues=np.array(ex["vagues"], np.int16), poids=np.array(ex["poids"], np.float32))
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
