from __future__ import annotations

import argparse
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from .banc_complet import BANC, lire_resultats

RACINE = Path(__file__).resolve().parent.parent
FIXES = {5: 1, 8: 3, 25: 3, 35: 2, 55: 3, 62: 2, 64: 2, 66: 3, 95: 3, 112: 2, 114: 3, 115: 3, 145: 3, 164: 3, 165: 3,
         182: 3, 184: 3, 186: 3, 188: 3, 190: 3, 195: 3}
RANGS = json.loads((RACINE / "donnees" / "importance-combats.json").read_text(encoding="utf-8"))["rangs"]


def serie_champions(r: dict) -> int:
    vague20 = (r.get("sauvages") or {}).get("20")
    return 30 if vague20 and vague20.get("especes") else 20


def rang(vague: int, serie: int) -> int:
    if vague in FIXES:
        return FIXES[vague]
    if vague % 10:
        return 0
    if vague == 200 or vague % 30 == serie % 30:
        return RANGS["CHAMPION_ARENE"]
    return RANGS["BOSS_SAUVAGE"]


def prochain(vague: int, serie: int) -> tuple[int, int]:
    v = vague + 1
    while rang(v, serie) == 0:
        v += 1
    return v, rang(v, serie)


def analyser(resultats: dict[int, dict]) -> dict:
    achats = Counter()
    potions_hautes = Counter()
    par_rang = defaultdict(Counter)
    argent_avant = defaultdict(lambda: {"survit": [], "meurt": []})
    for r in resultats.values():
        serie = serie_champions(r)
        eco = r.get("economie") or {}
        for v, e in eco.items():
            vague = int(v)
            vise, rang_vise = prochain(vague, serie)
            for a in e.get("achats") or []:
                achats[a["objet"]] += 1
                par_rang[rang_vise][a["objet"]] += 1
                if "Potion" in a["objet"] and a["pvEquipe"] >= 85:
                    potions_hautes[a["objet"]] += 1
            if rang(vague, serie) == 3:
                argent_avant[vague]["meurt" if r["vague"] == vague else "survit"].append(e.get("argent") or 0)
    return {
        "parties": len(resultats),
        "achatsParPartie": {k: round(n / len(resultats), 2) for k, n in achats.most_common()},
        "potionsAchetéesÀ85%OuPlus": {k: f"{n} sur {achats[k]}" for k, n in potions_hautes.items()},
        "achatsSelonLeRangDuProchainCombat": {str(k): dict(v.most_common(6)) for k, v in sorted(par_rang.items())},
        "argentAvantLesCombatsDeRang3": {
            str(v): {cle: (round(statistics.median(x)) if x else None, len(x)) for cle, x in d.items()}
            for v, d in sorted(argent_avant.items()) if d["meurt"]
        },
        "argentÀLaMort": statistics.median([(r.get("bilan") or {}).get("argent", 0) for r in resultats.values()]),
    }


def main() -> None:
    parametres = argparse.ArgumentParser(description="Bilan de l'économie d'un banc : achats, Potions inutiles, argent avant les combats importants")
    parametres.add_argument("banc")
    parametres.add_argument("--dossier", default=str(BANC))
    args = parametres.parse_args()
    print(json.dumps(analyser(lire_resultats(args.banc, Path(args.dossier))), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
