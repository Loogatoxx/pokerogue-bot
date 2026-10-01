"""Analyse des défaites : pourquoi le cerveau perd-il contre le rival (vagues 8 et 25) et le boss
de la vague 20 ?

Fait jouer un cerveau (meilleur coup, comme le mode auto de l'extension) avec des starters tirés
au hasard, en demandant au simulateur le récit de chaque partie : les forces en présence au début
de chaque vague (niveaux des deux camps, PV, objets) et l'état exact des équipes à la défaite.
Puis compare, pour chaque combat fixe, les parties qui le passent à celles qui y perdent.

Usage :
  .venv/bin/python -m entraineur.analyse_defaites <fichier.cerveau> [--parties 240] [--sans-balls]
  --sans-balls : expérience, le cerveau n'a pas le droit de lancer de Ball (aucune capture).
Les données brutes vont sur le Lexar (analyses/), le rapport s'affiche.
"""
from __future__ import annotations

import argparse
import json
import random
import threading
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean

import torch

from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .pont import Etat, Pont

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
COMBATS = {8: "rival n° 1", 20: "boss de la vague 20", 25: "rival n° 2"}
PREMIER_CHANGEMENT, PREMIERE_BALL = 8, 14


def type_action(action: int) -> str:
    return "attaque" if action < PREMIER_CHANGEMENT else "changement" if action < PREMIERE_BALL else "ball"


def jouer(pont: Pont, cerveau, nombre: int, sans_balls: bool = False, plan: float = 0.0, vague_max: int = 50,
          plan_capture: bool = False) -> list[dict]:
    """Joue `nombre` parties ; chacune renvoie sa fin (avec le récit) et ses actions par vague."""
    parties: list[dict] = []
    verrou = threading.Lock()
    restantes = [nombre]
    hasard = random.Random(2026)

    def boucle(simulateur) -> None:
        while True:
            with verrou:
                if restantes[0] <= 0:
                    return
                restantes[0] -= 1
                especes = hasard.sample(STARTERS_COMPTE_NEUF, 3)
            actions: dict[int, Counter] = defaultdict(Counter)
            tours: dict[int, int] = {}
            etat = simulateur.nouvelle_partie(especes=especes, vague_max=vague_max, recit=True, plan_capture=plan_capture)
            while isinstance(etat, Etat):
                masque = etat.masque.copy()
                if sans_balls and masque[:PREMIERE_BALL].any():
                    masque[PREMIERE_BALL:] = False
                action = choisir(cerveau, etat.observation, masque, etat.plan, plan)
                vague = etat.info["vague"]
                # Seulement les vrais choix (attaquer OU changer OU lancer une Ball).
                if etat.masque[:PREMIER_CHANGEMENT].any():
                    actions[vague][type_action(action)] += 1
                tours[vague] = max(tours.get(vague, 0), etat.info["tour"])
                etat = simulateur.agir(action)
            with verrou:
                # Clés en texte : c'est ce que redonne le JSON enregistré (--relire).
                parties.append({**etat.info, "starters": especes,
                                "actions": {str(v): dict(c) for v, c in actions.items()},
                                "tours": {str(v): t for v, t in tours.items()}})
                if len(parties) % 20 == 0:
                    print(f"  {len(parties)}/{nombre} parties", flush=True)

    fils = [threading.Thread(target=boucle, args=(s,)) for s in pont.simulateurs]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    return parties


def choisir(cerveau, observation, masque, valeurs_plan, poids_plan: float) -> int:
    """Le meilleur coup du cerveau, éventuellement guidé par le planificateur : on ajoute
    poids_plan × (valeur du plan) à ses scores. 0 = le cerveau seul ; très grand = le plan décide
    (sauf la capture, que le plan laisse neutre)."""
    with torch.no_grad():
        scores, _ = cerveau(torch.from_numpy(observation), torch.from_numpy(masque))
    if poids_plan and valeurs_plan is not None:
        scores = scores + poids_plan * torch.from_numpy(valeurs_plan)
    scores = scores.masked_fill(~torch.from_numpy(masque), -1e9)
    return int(torch.argmax(scores))


def etape(partie: dict, vague: int) -> dict | None:
    return next((e for e in partie.get("recit", []) if e["vague"] == vague), None)


def statut(e: dict | None) -> float | None:
    """Part des attaques de statut parmi celles choisies quand il pouvait frapper."""
    if not e or e["attaquesStatut"] + e["attaquesOffensives"] == 0:
        return None
    return 100 * e["attaquesStatut"] / (e["attaquesStatut"] + e["attaquesOffensives"])


def rapport(parties: list[dict]) -> None:
    valides = [p for p in parties if "erreur" not in p]
    fins = Counter(p["vague"] for p in valides if not p.get("tronquee"))
    perdues = sum(fins.values())
    print(f"\n{len(valides)} parties ({len(parties) - len(valides)} erreurs), "
          f"{sum(1 for p in valides if p.get('tronquee'))} arrivées à la vague 50, vague moyenne "
          f"{mean(p['vague'] for p in valides):.1f}")
    total_statut = sum(e["attaquesStatut"] for p in valides for e in p.get("recit", []))
    total = total_statut + sum(e["attaquesOffensives"] for p in valides for e in p.get("recit", []))
    print(f"Attaques de statut choisies alors qu'il pouvait frapper : {100 * total_statut / max(total, 1):.1f} % "
          f"({total_statut} sur {total})")
    previsions = [p["prediction"] for p in valides if p.get("prediction")]
    if previsions:
        somme = {k: sum(x[k] for x in previsions) for k in previsions[0]}
        offensifs = max(1, somme["tours"] - somme["changements"] - somme["statut"])
        print(f"\nPrédiction de l'IA adverse ({somme['tours']} coups adverses) :")
        print(f"  attaque exacte (1er choix annoncé) : {100 * somme['exacts'] / offensifs:.1f} % des attaques offensives")
        print(f"  bon type (1er choix annoncé)       : {100 * somme['memeType'] / offensifs:.1f} %")
        print(f"  probabilité donnée au vrai coup    : {100 * somme['probabilite'] / offensifs:.1f} % en moyenne")
        print(f"  attaque jamais envisagée           : {100 * somme['horsPrevision'] / offensifs:.1f} %")
        print(f"  changements de Pokémon adverses    : {100 * somme['changements'] / max(1, somme['tours']):.1f} % des coups ; "
              f"attaques de statut : {100 * somme['statut'] / max(1, somme['tours']):.1f} %")
    print("\nOù il perd :")
    for v, n in sorted(fins.items(), key=lambda x: -x[1])[:8]:
        print(f"  vague {v:3d} : {n:4d} défaites ({100 * n / perdues:4.1f} %)  {COMBATS.get(v, '')}")

    for vague, nom in COMBATS.items():
        arrivees = [p for p in valides if p["vague"] >= vague and etape(p, vague)]
        if not arrivees:
            continue
        perdants = [p for p in arrivees if p["vague"] == vague and not p.get("tronquee")]
        gagnants = [p for p in arrivees if p not in perdants]
        print(f"\n── Vague {vague} ({nom}) : {len(arrivees)} parties y arrivent, "
              f"{100 * len(gagnants) / len(arrivees):.0f} % passent ──")
        print(f"{'':28}{'passent':>10}{'perdent':>10}")

        def ligne(titre: str, mesure) -> None:
            valeurs = []
            for groupe in (gagnants, perdants):
                donnees = [mesure(p) for p in groupe]
                donnees = [d for d in donnees if d is not None]
                valeurs.append(f"{mean(donnees):10.1f}" if donnees else f"{'-':>10}")
            print(f"  {titre:26}{''.join(valeurs)}")

        ligne("niveau max de l'équipe", lambda p: max(etape(p, vague)["equipe"]))
        ligne("niveau moyen de l'équipe", lambda p: mean(etape(p, vague)["equipe"]))
        ligne("taille de l'équipe", lambda p: len(etape(p, vague)["equipe"]))
        ligne("PV de l'équipe au départ %", lambda p: etape(p, vague)["pvEquipe"])
        ligne("objets portés", lambda p: etape(p, vague)["objets"])
        ligne("niveau max adverse", lambda p: max(etape(p, vague)["adversaires"] or [0]))
        ligne("écart (adverse − équipe)", lambda p: max(etape(p, vague)["adversaires"] or [0]) - max(etape(p, vague)["equipe"]))
        ligne("captures avant", lambda p: len(etape(p, vague)["equipe"]) - 3)
        ligne("tours du combat", lambda p: p["tours"].get(str(vague)))
        ligne("attaques de statut %", lambda p: statut(etape(p, vague)))
        for genre in ("attaque", "changement", "ball"):
            ligne(f"part « {genre} » %", lambda p, g=genre: (
                100 * p["actions"].get(str(vague), {}).get(g, 0) / max(1, sum(p["actions"].get(str(vague), {}).values()))))

        if perdants:
            pv_restants = [mean(a["pv"] for a in p["defaite"]["adversaires"]) for p in perdants if p.get("defaite")]
            ko_adverses = [sum(1 for a in p["defaite"]["adversaires"] if a["pv"] == 0) for p in perdants if p.get("defaite")]
            print(f"  à la défaite : PV adverses restants {mean(pv_restants):.0f} % en moyenne, "
                  f"{mean(ko_adverses):.1f} adversaire(s) K.O. sur {mean(len(p['defaite']['adversaires']) for p in perdants if p.get('defaite')):.1f}")
            exemple = next(p for p in perdants if p.get("defaite"))
            d = exemple["defaite"]
            print("  exemple de défaite :")
            print("    équipe      :", ", ".join(f"{m['nom']} N.{m['niveau']} ({' / '.join(m['attaques'])})" for m in d["equipe"]))
            print("    adversaires :", ", ".join(f"{m['nom']} N.{m['niveau']} {m['pv']} %" for m in d["adversaires"]))
            print("    objets      :", d["objets"])

    print("\nCourbe des niveaux (moyenne sur les parties qui y arrivent) :")
    print(f"  {'vague':>6}{'niv. max équipe':>17}{'niv. max adverse':>18}{'parties':>9}")
    for vague in (1, 3, 5, 7, 8, 10, 12, 15, 18, 20, 22, 24, 25, 30):
        etapes = [etape(p, vague) for p in valides]
        etapes = [e for e in etapes if e and e["adversaires"]]
        if etapes:
            print(f"  {vague:6d}{mean(max(e['equipe']) for e in etapes):17.1f}"
                  f"{mean(max(e['adversaires']) for e in etapes):18.1f}{len(etapes):9d}")


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path)
    parametres.add_argument("--parties", type=int, default=240)
    parametres.add_argument("--processus", type=int, default=8)
    parametres.add_argument("--relire", type=Path, help="refaire le rapport d'une analyse déjà enregistrée")
    parametres.add_argument("--sans-balls", action="store_true", help="expérience : aucune Ball permise")
    parametres.add_argument("--plan", type=float, help="poids du planificateur (par défaut : celui du cerveau ; 0 = cerveau seul)")
    parametres.add_argument("--vague-max", type=int, default=50, help="arrêt des parties au-delà (200 = sans limite)")
    parametres.add_argument("--plan-capture", action="store_true", help="le planificateur juge aussi les Poké Balls")
    args = parametres.parse_args()
    torch.set_num_threads(2)

    if args.relire:
        rapport(json.loads(args.relire.read_text())["parties"])
        return
    cerveau, entete = lire(args.cerveau)
    cerveau.eval()
    print(f"Cerveau : {entete['nom']} — {args.parties} parties, meilleur coup, starters au hasard"
          + (", SANS Balls" if args.sans_balls else "")
          + (f", planificateur × {args.plan if args.plan is not None else cerveau.poids_plan:g}" if (args.plan or cerveau.poids_plan) else ""))
    with Pont(args.processus) as pont:
        poids = args.plan if args.plan is not None else cerveau.poids_plan
        parties = jouer(pont, cerveau, args.parties, args.sans_balls, poids, args.vague_max, args.plan_capture)
    dossier = LEXAR / "analyses"
    dossier.mkdir(exist_ok=True)
    fichier = dossier / f"defaites-{datetime.now():%Y-%m-%d-%Hh%M}{'-sans-balls' if args.sans_balls else ''}{f'-plan{args.plan:g}' if args.plan else ''}.json"
    fichier.write_text(json.dumps({"cerveau": str(args.cerveau), "parties": parties}, ensure_ascii=False))
    print(f"Données : {fichier}")
    rapport(parties)


if __name__ == "__main__":
    main()
