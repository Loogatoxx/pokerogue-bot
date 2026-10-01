"""Rapport sur les défaites contre le rival, avec la reproduction des combats tour par tour.

Demande de Carlos : « avoir des rapports avec une reproduction de la partie pour analyser
pourquoi il n'arrive pas à passer le rival de la vague 8 ». Le simulateur tient, en mode récit,
le journal de chaque décision pendant les combats contre le rival (état des deux camps, options et
valeurs du planificateur, choix du cerveau, coup prévu et coup réel du rival).

Usage :
  .venv/bin/python -m entraineur.rapport_rival [cerveau] [--parties 200] [--ouvrir]
Le rapport (HTML) va sur le Lexar (analyses/) ; --ouvrir l'affiche dans Safari.
"""
from __future__ import annotations

import argparse
import html
import random
import subprocess
import threading
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import mean

import torch

from .ensemble import STARTERS_COMPTE_NEUF
from .format_cerveau import lire
from .pont import Etat, Pont

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
V4 = LEXAR / "cerveaux" / "v4-2026-10-01.cerveau"
RIVAUX = (8, 25)


def jouer(pont: Pont, cerveau, nombre: int) -> list[dict]:
    parties: list[dict] = []
    verrou = threading.Lock()
    restantes = [nombre]
    hasard = random.Random(7)

    def boucle(simulateur) -> None:
        while True:
            with verrou:
                if restantes[0] <= 0:
                    return
                restantes[0] -= 1
                especes = hasard.sample(STARTERS_COMPTE_NEUF, 3)
            etat = simulateur.nouvelle_partie(especes=especes, vague_max=26, recit=True)
            while isinstance(etat, Etat):
                action, _ = cerveau.choisir(torch.from_numpy(etat.observation), torch.from_numpy(etat.masque), tirage=False,
                                            plan=None if etat.plan is None else torch.from_numpy(etat.plan))
                etat = simulateur.agir(action)
            with verrou:
                parties.append({**etat.info, "starters": especes})
                if len(parties) % 25 == 0:
                    print(f"  {len(parties)}/{nombre} parties", flush=True)

    fils = [threading.Thread(target=boucle, args=(s,)) for s in pont.simulateurs]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    return parties


def e(texte) -> str:
    return html.escape(str(texte))


def tableau_combat(partie: dict, vague: int) -> str:
    tours = [t for t in partie.get("journalCombat", []) if t["vague"] == vague]
    lignes = []
    for t in tours:
        options = "<br>".join(f"{e(o['action'])} <span class=n>{o['plan']}</span>" for o in t["options"])
        choix = e(t.get("choix", "?"))
        meilleur = t["options"][0]["action"] if t["options"] else None
        suivi = "" if t.get("choix") == meilleur else " <span class=alerte>(pas le 1er du plan)</span>"
        lignes.append(
            f"<tr><td>{t['tour']}{' · remplaçant' if t['decision'] == 'remplacement' else ''}</td>"
            f"<td><b>{e(t['moi'])}</b><div class=petit>{'<br>'.join(e(x) for x in t['equipe'])}</div></td>"
            f"<td>{'<br>'.join(e(x) for x in t['adversaires'])}</td>"
            f"<td>{'<br>'.join(e(x) for x in t['prevu'])}</td>"
            f"<td class=petit>{options}</td>"
            f"<td><b>{choix}</b>{suivi}</td>"
            f"<td>{'<br>'.join(e(x) for x in t.get('rivalJoue', [])) or '—'}</td></tr>")
    return ("<table><tr><th>Tour</th><th>Mon Pokémon (et l'équipe)</th><th>Rival</th><th>Coup prévu du rival</th>"
            "<th>Options (valeur du plan)</th><th>Choix du bot</th><th>Le rival a joué</th></tr>"
            + "".join(lignes) + "</table>") if lignes else "<p>(pas de journal)</p>"


def causes(partie: dict) -> list[str]:
    """Indices lisibles d'une défaite, tirés de l'état au début et à la fin du combat."""
    d = partie.get("defaite") or {}
    equipe, adversaires = d.get("equipe", []), d.get("adversaires", [])
    raisons = []
    if equipe and adversaires:
        porteur = max(equipe, key=lambda m: m["niveau"])
        rival_max = max(a["niveau"] for a in adversaires)
        if rival_max > porteur["niveau"]:
            raisons.append(f"le rival a un niveau d'avance ({rival_max} contre {porteur['niveau']} pour {porteur['nom']})")
        faibles = [m for m in equipe if m["niveau"] <= porteur["niveau"] - 4]
        if len(faibles) >= 3:
            raisons.append(f"{len(faibles)} membres ont 4 niveaux ou plus de retard sur {porteur['nom']} : seul le porteur peut tenir")
        sans_degats = [m["nom"] for m in equipe if m["attaques"] and all(a in STATUT_CONNUS for a in m["attaques"])]
        if sans_degats:
            raisons.append("sans attaque offensive : " + ", ".join(sans_degats))
        restant = [f"{a['nom']} {a['pv']} %" for a in adversaires if a["pv"] > 0]
        if restant:
            raisons.append("il restait au rival : " + ", ".join(restant))
    tours = [t for t in partie.get("journalCombat", []) if t["vague"] == partie["vague"]]
    changements = sum(1 for t in tours if str(t.get("choix", "")).startswith("Envoyer") and t["decision"] == "combat")
    if tours and changements == 0:
        raisons.append("aucun changement de Pokémon pendant le combat")
    return raisons


STATUT_CONNUS = {"Growl", "Tail Whip", "Leer", "Sand Attack", "String Shot", "Harden", "Defense Curl", "Withdraw",
                 "Splash", "Smokescreen", "Sweet Scent", "Growth", "Focus Energy", "Baby-Doll Eyes", "Play Nice"}


def rapport(parties: list[dict], nom_cerveau: str) -> str:
    valides = [p for p in parties if "erreur" not in p]
    blocs = []
    for vague in RIVAUX:
        arrives = [p for p in valides if p["vague"] >= vague]
        perdus = [p for p in arrives if p["vague"] == vague and not p.get("tronquee")]
        if not arrives:
            continue
        taux = 100 * (len(arrives) - len(perdus)) / len(arrives)
        compo = Counter(a["nom"] for p in perdus for a in (p.get("defaite") or {}).get("adversaires", []))
        toutes_causes = Counter(c.split(" (")[0].split(" :")[0] for p in perdus for c in causes(p))
        blocs.append(f"<h2>Rival de la vague {vague} : {len(arrives)} parties y arrivent, {taux:.0f} % passent ({len(perdus)} défaites)</h2>")
        if perdus:
            blocs.append("<p><b>Rivaux qui nous battent :</b> " + ", ".join(f"{e(n)} ×{c}" for n, c in compo.most_common(10)) + "</p>")
            blocs.append("<p><b>Causes repérées :</b></p><ul>" + "".join(f"<li>{e(c)} — {n} défaites</li>" for c, n in toutes_causes.most_common()) + "</ul>")
            for i, p in enumerate(perdus[:6], 1):
                d = p.get("defaite") or {}
                equipe = "<br>".join(f"{e(m['nom'])} N.{m['niveau']} ({e(' / '.join(m['attaques']))})" for m in d.get("equipe", []))
                rival = "<br>".join(f"{e(a['nom'])} N.{a['niveau']} — {a['pv']} % ({e(' / '.join(a['attaques']))})" for a in d.get("adversaires", []))
                blocs.append(f"<details{' open' if i == 1 else ''}><summary>Défaite n° {i} — {len(d.get('equipe', []))} Pokémon, "
                             f"{d.get('tours', '?')} tours</summary>"
                             f"<div class=deux><div><h4>Notre équipe à la fin</h4>{equipe}</div><div><h4>Le rival à la fin</h4>{rival}</div></div>"
                             f"<p><b>Pourquoi :</b> {e(' ; '.join(causes(p)) or 'à lire dans le combat')}</p>"
                             f"{tableau_combat(p, vague)}</details>")
    moyenne = mean(p["vague"] for p in valides) if valides else 0
    return f"""<!doctype html><html lang=fr><head><meta charset=utf-8><title>Défaites contre le rival</title>
<style>
body {{ font: 14px system-ui, sans-serif; margin: 24px; background: #fbfaf7; color: #222; }}
h1 {{ margin-bottom: 4px; }} h2 {{ margin-top: 32px; border-bottom: 2px solid #c73625; }}
table {{ border-collapse: collapse; width: 100%; margin: 8px 0 20px; }}
th, td {{ border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; text-align: left; }}
th {{ background: #f0ece4; }} .petit {{ font-size: 12px; color: #555; }} .n {{ color: #888; font-variant-numeric: tabular-nums; }}
.alerte {{ color: #b3261e; }} details {{ margin: 12px 0; padding: 8px 12px; background: white; border: 1px solid #e5e0d6; border-radius: 6px; }}
summary {{ cursor: pointer; font-weight: 600; }} .deux {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
@media (prefers-color-scheme: dark) {{ body {{ background: #1c1b1a; color: #eee; }} th {{ background: #2b2926; }}
  td, th {{ border-color: #3a3835; }} details {{ background: #242220; border-color: #3a3835; }} .petit {{ color: #aaa; }} }}
</style></head><body>
<h1>Défaites contre le rival</h1>
<p>{e(nom_cerveau)} · {len(valides)} parties jusqu'à la vague 26 (starters au hasard) · vague moyenne {moyenne:.1f} ·
{datetime.now():%d/%m/%Y %H:%M}</p>
<p class=petit>Chaque tableau rejoue le combat décision par décision : l'état des deux camps, ce que le bot prévoyait du rival,
ses options avec la valeur que leur donnait le planificateur (plus haut = mieux), son choix, et ce que le rival a vraiment joué.</p>
{''.join(blocs)}
</body></html>"""


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parametres.add_argument("cerveau", type=Path, nargs="?", default=V4)
    parametres.add_argument("--parties", type=int, default=200)
    parametres.add_argument("--processus", type=int, default=10)
    parametres.add_argument("--ouvrir", action="store_true", help="ouvrir le rapport dans Safari")
    args = parametres.parse_args()
    torch.set_num_threads(2)
    cerveau, entete = lire(args.cerveau)
    cerveau.eval()
    print(f"Cerveau : {entete['nom']} — {args.parties} parties jusqu'à la vague 26")
    with Pont(args.processus) as pont:
        parties = jouer(pont, cerveau, args.parties)
    fichier = LEXAR / "analyses" / f"rapport-rival-{datetime.now():%Y-%m-%d-%Hh%M}.html"
    fichier.parent.mkdir(exist_ok=True)
    fichier.write_text(rapport(parties, entete["nom"]), encoding="utf-8")
    print(f"Rapport : {fichier}")
    if args.ouvrir:
        subprocess.run(["open", "-a", "Safari", str(fichier)], check=False)


if __name__ == "__main__":
    main()
