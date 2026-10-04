"""Génère observateur/contraintes-attaques.ts depuis la copie locale du jeu (jeu/src/data/moves/move.ts).

Les attaques dont la puissance affichée trompe : celles qui mettent le lanceur K.O. (Explosion,
Destruction), celles qui l'obligent à se recharger le tour d'après (Ultralaser) ou à se charger le
tour d'avant (Lance-Soleil, Piqué), et quelques attaques à condition (Mitra-Poing, Dévorêve).
Pour chacune, un facteur : la part de sa puissance qu'elle rapporte vraiment, tour pour tour.

Usage : .venv/bin/python observateur/generer-attaques.py
"""
from __future__ import annotations

import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MOVE = RACINE / "jeu/src/data/moves/move.ts"
ENUM = RACINE / "jeu/src/enums/move-id.ts"
SORTIE = RACINE / "observateur/contraintes-attaques.ts"

# Facteurs : un tour sur deux (recharge, charge), le lanceur sacrifié, une condition rarement remplie.
FACTEURS = {
    "sacrifice": 0.15,  # le lanceur tombe K.O. : on perd un membre pour un coup
    "recharge": 0.55,   # le tour suivant est perdu
    "charge": 0.6,      # le tour d'avant est perdu (ou le lanceur est exposé)
    "condition": 0.3,   # Mitra-Poing (raté si touché), Dévorêve (cible endormie)
}
CONDITIONNELLES = {"FOCUS_PUNCH", "DREAM_EATER"}


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


def main() -> None:
    ids = ids_des_attaques()
    texte = MOVE.read_text(encoding="utf-8")
    # Chaque attaque commence par « new XxxMove(MoveId.NOM, … » ; ses attributs suivent jusqu'à la suivante.
    debuts = list(re.finditer(r"new (\w*Move)\(MoveId\.([A-Z0-9_]+)", texte))
    contraintes: dict[int, tuple[float, str, str]] = {}
    for k, d in enumerate(debuts):
        fin = debuts[k + 1].start() if k + 1 < len(debuts) else len(texte)
        bloc = texte[d.start():fin]
        classe, nom = d.group(1), d.group(2)
        if classe not in ("AttackMove", "ChargingAttackMove") or nom not in ids:
            continue
        if re.search(r"\bSacrificialAttr(OnHit)?\b", bloc):
            genre = "sacrifice"
        elif "RechargeAttr" in bloc:
            genre = "recharge"
        elif classe == "ChargingAttackMove":
            genre = "charge"
        elif nom in CONDITIONNELLES:
            genre = "condition"
        else:
            continue
        contraintes[ids[nom]] = (FACTEURS[genre], genre, nom)
    lignes = [
        "// Fichier GÉNÉRÉ par observateur/generer-attaques.py depuis la copie locale du jeu — ne pas modifier à la main.",
        "/**",
        " * Attaques dont la puissance affichée trompe (identifiant → part de la puissance vraiment utile,",
        " * tour pour tour) : le lanceur sacrifié (Explosion), un tour de recharge (Ultralaser) ou de charge",
        " * (Lance-Soleil), une condition rarement remplie (Mitra-Poing, Dévorêve). Absentes : 1.",
        " */",
        "export const CONTRAINTES_ATTAQUES: Readonly<Record<number, number>> = {",
    ]
    for i in sorted(contraintes):
        facteur, genre, nom = contraintes[i]
        lignes.append(f"  {i}: {facteur}, // {nom} ({genre})")
    lignes += ["};", "", "/** La part de sa puissance qu'une attaque rapporte vraiment (1 pour une attaque ordinaire). */",
               "export const facteurAttaque = (id: number | undefined): number => (id === undefined ? 1 : CONTRAINTES_ATTAQUES[id] ?? 1);", ""]
    SORTIE.write_text("\n".join(lignes), encoding="utf-8")
    print(f"{len(contraintes)} attaques → {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
