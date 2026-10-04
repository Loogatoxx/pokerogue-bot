from __future__ import annotations

import json
import math
import statistics
from collections import Counter
from pathlib import Path

FICHIER_VAGUES = Path(__file__).resolve().parent.parent / "donnees" / "vagues-classique.json"
DONNEES_VAGUES = json.loads(FICHIER_VAGUES.read_text(encoding="utf-8"))
VAGUE_FINALE = DONNEES_VAGUES["vague_finale"]
COMBATS_FIXES = {int(vague): genre for vague, genre in DONNEES_VAGUES["combats_fixes"].items()}
VAGUES_RIVAL = sorted(vague for vague, genre in COMBATS_FIXES.items() if genre == "rival")
RIVAUX = {vague: f"rival {numero + 1}" for numero, vague in enumerate(VAGUES_RIVAL)}


def est_valide(resultat: dict) -> bool:
    return not resultat.get("erreur")


def type_de_mort(resultat: dict) -> str:
    vague = resultat["vague"]
    defaite = resultat.get("defaite") or {}
    dresseur = defaite.get("dresseur")
    if resultat.get("victoire") or vague > VAGUE_FINALE:
        return "victoire"
    if defaite.get("typeCombat") == "MYSTERY_ENCOUNTER":
        return "rencontre mystère"
    if vague in COMBATS_FIXES:
        return COMBATS_FIXES[vague]
    if vague == VAGUE_FINALE:
        return "boss final"
    if vague % 10 == 0 and dresseur:
        return "champion d'arène"
    boss = defaite.get("boss", vague % 10 == 0 and not dresseur)
    if boss:
        return "boss sauvage"
    if dresseur:
        return "dresseur"
    return "sauvage"


def deciles(valeurs: list[float]) -> tuple[float, float]:
    if len(valeurs) < 2:
        return valeurs[0], valeurs[0]
    coupures = statistics.quantiles(valeurs, n=10, method="inclusive")
    return coupures[0], coupures[8]


def tranche_de(vague: int) -> int:
    return (vague - 1) // 10 * 10 + 1


def histogramme(vagues: list[int]) -> list[str]:
    compte = Counter(tranche_de(vague) for vague in vagues)
    plus_grand = max(compte.values())
    lignes = []
    for debut in sorted(compte):
        barre = "█" * max(1, round(30 * compte[debut] / plus_grand))
        lignes.append(f"  {debut:3d}-{debut + 9:3d} {compte[debut]:4d} {barre}")
    return lignes


def taux_de_passage_des_rivaux(vagues: list[int]) -> list[str]:
    morts = Counter(vagues)
    restants = len(vagues)
    taux = []
    for vague in sorted(morts):
        if vague in RIVAUX:
            taux.append(f"{RIVAUX[vague]} {100 * (1 - morts[vague] / max(restants, 1)):.0f} %")
        restants -= morts[vague]
    return taux


def morts_par_type(resultats: list[dict]) -> list[str]:
    compte = Counter(type_de_mort(r) for r in resultats)
    total = len(resultats)
    return [f"{genre} {nombre} ({100 * nombre / total:.0f} %)" for genre, nombre in compte.most_common()]


def argent_et_objets_a_la_mort(resultats: list[dict]) -> list[str]:
    morts = [r for r in resultats if type_de_mort(r) != "victoire"]
    if not morts:
        return []
    argents = [(r.get("bilan") or {}).get("argent", 0) for r in morts]
    objets_par_mort = [(r.get("defaite") or {}).get("objets") or {} for r in morts]
    piles = [sum(objets.values()) for objets in objets_par_mort]
    presence = Counter(cle for objets in objets_par_mort for cle in objets)
    frequents = ", ".join(f"{cle} {100 * n / len(morts):.0f} %" for cle, n in presence.most_common(5))
    return [
        f"argent à la mort : moyenne {statistics.mean(argents):.0f} ₽ · médiane {statistics.median(argents):.0f} ₽",
        f"objets à la mort : {statistics.mean(piles):.1f} en moyenne · les plus fréquents : {frequents}",
    ]


def rencontres_mortelles(resultats: list[dict]) -> str | None:
    morts = Counter((r.get("defaite") or {}).get("rencontre") for r in resultats if type_de_mort(r) == "rencontre mystère")
    morts.pop(None, None)
    if not morts:
        return None
    return "rencontres mystères mortelles : " + ", ".join(f"{nom} {nombre}" for nom, nombre in morts.most_common(8))


def changements_consecutifs(resultats: list[dict]) -> str | None:
    avec_compteur = [r["changements"] for r in resultats if r.get("changements")]
    if not avec_compteur:
        return None
    volontaires = statistics.mean(c["volontaires"] for c in avec_compteur)
    serie_max = max(c["serieMax"] for c in avec_compteur)
    parties_avec_serie = sum(1 for c in avec_compteur if c["series3"] > 0)
    return (f"changements volontaires : {volontaires:.1f} par partie · plus longue série {serie_max} · "
            f"parties avec 3 changements de suite ou plus : {parties_avec_serie}")


def strates_de_force(resultats: list[dict]) -> list[str]:
    avec_total = [r for r in resultats if r.get("totalStatsDepart")]
    if len(avec_total) < 3:
        return []
    coupure_basse, coupure_haute = statistics.quantiles([r["totalStatsDepart"] for r in avec_total], n=3)
    strates = {"faibles": [], "moyens": [], "forts": []}
    for r in avec_total:
        total = r["totalStatsDepart"]
        nom = "faibles" if total <= coupure_basse else "moyens" if total <= coupure_haute else "forts"
        strates[nom].append(r["vague"])
    lignes = []
    for nom, vagues in strates.items():
        if vagues:
            lignes.append(f"starters {nom} : {len(vagues)} parties · vague moyenne {statistics.mean(vagues):.1f}")
    lignes.append(f"(coupures du total des stats de base : {coupure_basse:.0f} et {coupure_haute:.0f})")
    return lignes


def resume(resultats: list[dict]) -> str:
    valides = [r for r in resultats if est_valide(r)]
    erreurs = len(resultats) - len(valides)
    if not valides:
        return f"aucune partie valide ({erreurs} en erreur)"
    vagues = [r["vague"] for r in valides]
    moyenne = statistics.mean(vagues)
    ecart_type = statistics.stdev(vagues) if len(vagues) > 1 else 0.0
    erreur_type = ecart_type / math.sqrt(len(vagues))
    p10, p90 = deciles(vagues)
    lignes = [
        f"{len(valides)} parties valides ({erreurs} en erreur, exclues)",
        f"vague moyenne {moyenne:.2f} · médiane {statistics.median(vagues):.0f} · écart-type {ecart_type:.1f} · "
        f"erreur-type {erreur_type:.2f} · p10 {p10:.0f} · p90 {p90:.0f}",
        "passent : " + ", ".join(taux_de_passage_des_rivaux(vagues)),
        "morts par type : " + ", ".join(morts_par_type(valides)),
        *argent_et_objets_a_la_mort(valides),
    ]
    ligne_rencontres = rencontres_mortelles(valides)
    if ligne_rencontres:
        lignes.append(ligne_rencontres)
    ligne_changements = changements_consecutifs(valides)
    if ligne_changements:
        lignes.append(ligne_changements)
    lignes.extend(strates_de_force(valides))
    lignes.append("vagues de mort par tranche de 10 :")
    lignes.extend(histogramme(vagues))
    return "\n".join(lignes)


def comparer_apparie(differences: list[float]) -> tuple[float, float, str]:
    moyenne = statistics.mean(differences)
    erreur_type = statistics.stdev(differences) / math.sqrt(len(differences)) if len(differences) > 1 else 0.0
    if moyenne > 2 * erreur_type:
        verdict = "GARDER : gain supérieur à 2 erreurs-types"
    elif moyenne < -2 * erreur_type:
        verdict = "REVENIR EN ARRIÈRE : perte supérieure à 2 erreurs-types"
    else:
        verdict = "REVENIR EN ARRIÈRE : écart dans le bruit (moins de 2 erreurs-types)"
    return moyenne, erreur_type, verdict
