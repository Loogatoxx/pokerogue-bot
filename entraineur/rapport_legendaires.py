from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from .banc_complet import BANC, lire_resultats

CATEGORIES = ("légendaire", "semi-légendaire", "fabuleux")


def rencontres(r: dict) -> list[dict]:
    vues = []
    for vague, v in sorted((r.get("sauvages") or {}).items(), key=lambda x: int(x[0])):
        recrues = set(v.get("recrues") or [])
        for s in v.get("especes") or []:
            if s.get("categorie") in CATEGORIES:
                vues.append({"vague": int(vague), "espece": s["espece"], "categorie": s["categorie"], "boss": s["boss"],
                             "capture": s["espece"] in recrues})
    return vues


def balls_a(r: dict, vague: int) -> list[int]:
    return ((r.get("economie") or {}).get(str(vague)) or {}).get("balls") or [0, 0, 0, 0, 0]


def moyenne_et_erreur(valeurs: list[float]) -> tuple[float, float]:
    if not valeurs:
        return float("nan"), float("nan")
    if len(valeurs) == 1:
        return valeurs[0], float("nan")
    return statistics.mean(valeurs), statistics.stdev(valeurs) / math.sqrt(len(valeurs))


def analyser(resultats: dict[int, dict]) -> dict:
    parties = list(resultats.values())
    par_partie = {r["k"]: rencontres(r) for r in parties}
    toutes = [x | {"k": k, "vagueFinale": resultats[k]["vague"]} for k, xs in par_partie.items() for x in xs]
    stats = {"parties": len(parties), "parCategorie": {}}
    for cat in CATEGORIES:
        xs = [x for x in toutes if x["categorie"] == cat]
        parties_avec = {x["k"] for x in xs}
        stats["parCategorie"][cat] = {
            "rencontres": len(xs),
            "partiesAvecRencontre": len(parties_avec),
            "parPartie": len(xs) / max(len(parties), 1),
            "captures": sum(x["capture"] for x in xs),
            "boss": sum(x["boss"] for x in xs),
            "vagueMediane": statistics.median([x["vague"] for x in xs]) if xs else None,
        }
    prises = [r["vague"] for r in parties if any(x["capture"] for x in par_partie[r["k"]])]
    ratees = [r["vague"] for r in parties if par_partie[r["k"]] and not any(x["capture"] for x in par_partie[r["k"]])]
    sans = [r["vague"] for r in parties if not par_partie[r["k"]]]
    stats["vagueFinale"] = {
        "avecCapture": moyenne_et_erreur(prises) + (len(prises),),
        "rateSansCapture": moyenne_et_erreur(ratees) + (len(ratees),),
        "aucuneRencontre": moyenne_et_erreur(sans) + (len(sans),),
    }
    meme_vague = defaultdict(lambda: {"prise": [], "ratee": []})
    for x in toutes:
        tranche = (x["vague"] - 1) // 20 * 20 + 1
        meme_vague[tranche]["prise" if x["capture"] else "ratee"].append(x["vagueFinale"])
    stats["parTranche"] = {t: {"prise": moyenne_et_erreur(v["prise"]) + (len(v["prise"]),),
                               "ratee": moyenne_et_erreur(v["ratee"]) + (len(v["ratee"]),)}
                           for t, v in sorted(meme_vague.items())}
    raisons = Counter()
    for x in toutes:
        if x["capture"]:
            continue
        b = balls_a(resultats[x["k"]], x["vague"])
        if sum(b) == 0:
            raisons["aucune Ball"] += 1
        elif x["boss"] and b[4] == 0:
            raisons["boss : boucliers à casser, pas de Master Ball"] += 1
        else:
            raisons["Balls disponibles, pas capturé"] += 1
    stats["ratesPourquoi"] = dict(raisons)
    stats["ballsAuMoment"] = {cat: [statistics.mean(balls_a(resultats[x["k"]], x["vague"])[i] for x in toutes if x["categorie"] == cat) if any(x["categorie"] == cat for x in toutes) else 0 for i in range(5)] for cat in CATEGORIES}
    stats["especes"] = Counter(f'{x["espece"]}:{x["categorie"]}' for x in toutes).most_common(25)
    return stats


def main() -> None:
    parametres = argparse.ArgumentParser(description="Rapport : légendaires, semi-légendaires et fabuleux rencontrés, capturés ou ratés")
    parametres.add_argument("banc")
    parametres.add_argument("--dossier", default=str(BANC))
    parametres.add_argument("--sortie", type=Path)
    args = parametres.parse_args()
    stats = analyser(lire_resultats(args.banc, Path(args.dossier)))
    texte = json.dumps(stats, ensure_ascii=False, indent=1)
    if args.sortie:
        args.sortie.write_text(texte, encoding="utf-8")
    print(texte)


if __name__ == "__main__":
    main()
