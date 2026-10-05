"""Génère observateur/effets-attaques.ts depuis la copie locale du jeu (jeu/src/data/moves/move.ts).

Usage : .venv/bin/python observateur/generer-effets-attaques.py
"""
from __future__ import annotations

import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MOVE = RACINE / "jeu/src/data/moves/move.ts"
ENUM = RACINE / "jeu/src/enums/move-id.ts"
SORTIE = RACINE / "observateur/effets-attaques.ts"

STATS = {"ATK": 0, "DEF": 1, "SPATK": 2, "SPDEF": 3, "SPD": 4, "ACC": 5, "EVA": 6}
STATUTS = {"POISON": 1, "TOXIC": 2, "PARALYSIS": 3, "BURN": 6}
ENTETE_ATTAQUE = re.compile(
    r"new (AttackMove|ChargingAttackMove)\(MoveId\.([A-Z0-9_]+),\s*PokemonType\.\w+,\s*MoveCategory\.\w+,\s*"
    r"(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)")
ENTETE_STATUT = re.compile(r"new StatusMove\(MoveId\.([A-Z0-9_]+),\s*PokemonType\.\w+,\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)")
RECUL = re.compile(r"\.attr\(RecoilAttr(?:,\s*(true|false))?(?:,\s*([\d.]+))?(?:,\s*(?:true|false))?\)")
DRAIN = re.compile(r"\.attr\(HitHealAttr(?:,\s*([\d.]+))?\)")
CRANS = re.compile(r"\.attr\(StatStageChangeAttr,\s*\[([^\]]*)\],\s*(-?\d+)(?:,\s*(true|false))?(?:,\s*\{([^}]*)\})?\s*\)")
STATUT = re.compile(r"\.attr\(StatusEffectAttr,\s*StatusEffect\.([A-Z]+)\)")


def ids_des_attaques() -> dict[str, int]:
    ids: dict[str, int] = {}
    suivant = 0
    for ligne in ENUM.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*(?:=\s*(\d+))?\s*,", ligne)
        if m:
            valeur = int(m.group(2)) if m.group(2) else suivant
            ids[m.group(1)] = valeur
            suivant = valeur + 1
    return ids


def crans_de(liste: str) -> list[int]:
    return [STATS[s] for s in re.findall(r"Stat\.([A-Z]+)", liste) if s in STATS]


def effets_attaque(bloc: str, chance: float) -> dict[str, object]:
    effets: dict[str, object] = {}
    m = RECUL.search(bloc)
    if m:
        effets["reculPv" if m.group(1) == "true" else "recul"] = float(m.group(2) or 0.25)
    m = DRAIN.search(bloc)
    if m:
        effets["drain"] = float(m.group(1) or 0.5)
    soi: list[tuple[list[int], int]] = []
    cible: list[tuple[list[int], int, float]] = []
    for m in CRANS.finditer(bloc):
        options = m.group(4) or ""
        if "condition" in options:
            continue
        crans = crans_de(m.group(1))
        if not crans:
            continue
        surcharge = re.search(r"effectChanceOverride:\s*(\d+)", options)
        p = int(surcharge.group(1)) / 100 if surcharge else chance
        if m.group(3) == "true":
            soi.append((crans, int(m.group(2)), p))
        else:
            cible.append((crans, int(m.group(2)), p))
    if soi:
        effets["soi"] = soi
    if cible:
        effets["cible"] = cible
    statuts = [s for s in STATUT.findall(bloc) if s in STATUTS]
    if len(statuts) == 1:
        effets["statut"] = (STATUTS[statuts[0]], chance)
    if ".attr(FlinchAttr)" in bloc:
        effets["peur"] = chance
    return effets


def ts(effets: dict[str, object]) -> str:
    morceaux = []
    for cle, valeur in effets.items():
        if cle in ("soi", "cible"):
            liste = ", ".join(f"[[{', '.join(map(str, c))}], {e}, {p:g}]" for c, e, p in valeur)  # type: ignore[misc]
            morceaux.append(f"{cle}: [{liste}]")
        elif cle == "statut":
            effet, p = valeur  # type: ignore[misc]
            morceaux.append(f"statut: [{effet}, {p:g}]")
        else:
            morceaux.append(f"{cle}: {valeur:g}")  # type: ignore[str-format]
    return "{ " + ", ".join(morceaux) + " }"


def main() -> None:
    ids = ids_des_attaques()
    texte = MOVE.read_text(encoding="utf-8")
    debuts = list(re.finditer(r"new \w*Move\(MoveId\.", texte))
    table: dict[int, tuple[str, dict[str, object]]] = {}
    for k, d in enumerate(debuts):
        fin = debuts[k + 1].start() if k + 1 < len(debuts) else len(texte)
        bloc = texte[d.start():fin]
        m = ENTETE_ATTAQUE.match(bloc)
        if m:
            nom, chance = m.group(2), int(m.group(6))
            effets = effets_attaque(bloc, 1.0 if chance < 0 else chance / 100)
        else:
            m = ENTETE_STATUT.match(bloc)
            if not m:
                continue
            nom = m.group(1)
            statuts = [s for s in STATUT.findall(bloc) if s in STATUTS]
            effets = {"statut": (STATUTS[statuts[0]], 1.0)} if len(statuts) == 1 else {}
        if effets and nom in ids:
            table[ids[nom]] = (nom, effets)
    lignes = [
        "// Fichier GÉNÉRÉ par observateur/generer-effets-attaques.py depuis la copie locale du jeu — ne pas modifier à la main.",
        "export interface EffetsAttaque {",
        "  recul?: number;",
        "  reculPv?: number;",
        "  drain?: number;",
        "  soi?: readonly (readonly [readonly number[], number, number])[];",
        "  cible?: readonly (readonly [readonly number[], number, number])[];",
        "  statut?: readonly [number, number];",
        "  peur?: number;",
        "}",
        "",
        "export const EFFETS_ATTAQUES: Readonly<Record<number, EffetsAttaque>> = {",
    ]
    for i in sorted(table):
        nom, effets = table[i]
        lignes.append(f"  {i}: {ts(effets)}, // {nom}")
    lignes += ["};", ""]
    SORTIE.write_text("\n".join(lignes), encoding="utf-8")
    print(f"{len(table)} attaques → {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
