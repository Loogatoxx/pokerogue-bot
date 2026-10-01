#!/usr/bin/env python3
"""Régénère observateur/donnees-especes.ts depuis la copie locale du jeu : la connaissance « Pokédex »
(attaques possibles par niveau, talents possibles, évolutions, totaux de statistiques).

À relancer après chaque mise à jour du jeu :  python3 observateur/generer-especes.py
Idée de Carlos : que le cerveau sache d'avance ce qu'un adversaire PEUT avoir (attaques, talent
caché…) et de quoi se méfier, et qu'il reconnaisse un bon Pokémon à capturer. Les données viennent
du jeu lui-même (exactes pour PokeRogue, qui modifie certaines listes d'attaques), sans API en ligne.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
JEU = RACINE / "jeu"
FR = JEU / "locales" / "fr"


def camel(cle: str) -> str:
    mots = cle.lower().split("_")
    return mots[0] + "".join(m.capitalize() for m in mots[1:])


def exporter() -> dict:
    sortie = Path(tempfile.mkdtemp()) / "especes.json"
    (JEU / "test" / "bot").mkdir(parents=True, exist_ok=True)
    shutil.copy(RACINE / "simulateur" / "exporter-especes.test.ts", JEU / "test" / "bot")
    env = dict(os.environ, SORTIE=str(sortie), NODE_OPTIONS="--no-experimental-webstorage")
    subprocess.run(
        ["pnpm", "exec", "vitest", "run", "--silent=passed-only", "test/bot/exporter-especes.test.ts"],
        cwd=JEU, env=env, check=True, capture_output=True,
    )
    return json.loads(sortie.read_text())


def main() -> None:
    export = exporter()
    noms_especes = json.loads((FR / "pokemon.json").read_text())
    noms_attaques = json.loads((FR / "move.json").read_text())
    noms_talents = json.loads((FR / "ability.json").read_text())
    especes = {e["id"]: e for e in export["especes"]}

    # Total de statistiques de la forme la plus évoluée (le « potentiel » d'une espèce).
    memo: dict[int, int] = {}

    def total_final(id_: int, chemin: frozenset = frozenset()) -> int:
        if id_ in memo:
            return memo[id_]
        e = especes.get(id_)
        if not e or id_ in chemin:
            return e["total"] if e else 0
        suite = [total_final(v, chemin | {id_}) for v in e["evolutions"] if v in especes]
        memo[id_] = max([e["total"], *suite])
        return memo[id_]

    def texte(s: str) -> str:
        return s.replace("\\", "\\\\").replace('"', '\\"')

    lignes = [
        "// Fichier GÉNÉRÉ par observateur/generer-especes.py — ne pas modifier à la main.",
        f"// Source : copie locale du jeu (version {json.loads((JEU / 'package.json').read_text())['version']}).",
        "// Connaissance « Pokédex » : ce qu'une espèce PEUT avoir, jamais ce qu'un adversaire a réellement.",
        "",
        "/** [nom, types, total des stats, total de la forme finale, talents [1, 2, caché], attaques [niveau, id, niveau, id…]] */",
        "export type DonneesEspece = readonly [string, readonly number[], number, number, readonly number[], readonly number[]];",
        "/** [nom, type, catégorie (0 physique, 1 spéciale, 2 statut), puissance, précision] */",
        "export type DonneesAttaque = readonly [string, number, number, number, number];",
        "/** [nom, types annulés] */",
        "export type DonneesTalent = readonly [string, readonly number[]];",
        "",
        "export const ESPECES: Readonly<Record<number, DonneesEspece>> = {",
    ]
    for e in sorted(export["especes"], key=lambda e: e["id"]):
        nom = noms_especes.get(camel(e["cle"]), e["cle"])
        attaques = ",".join(f"{n},{a}" for n, a in e["attaques"])
        lignes.append(f'  {e["id"]}: ["{texte(nom)}", [{",".join(map(str, e["types"]))}], {e["total"]}, '
                      f'{total_final(e["id"])}, [{",".join(map(str, e["talents"]))}], [{attaques}]],')
    lignes += ["};", "", "export const ATTAQUES: Readonly<Record<number, DonneesAttaque>> = {"]
    for a in export["attaques"]:
        nom = noms_attaques.get(camel(a["cle"]), {}).get("name", a["cle"])
        lignes.append(f'  {a["id"]}: ["{texte(nom)}", {a["type"]}, {a["categorie"]}, {a["puissance"]}, {a["precision"]}],')
    lignes += ["};", "", "export const TALENTS: Readonly<Record<number, DonneesTalent>> = {"]
    for t in export["talents"]:
        nom = noms_talents.get(camel(t["cle"]), {}).get("name", t["cle"])
        lignes.append(f'  {t["id"]}: ["{texte(nom)}", [{",".join(map(str, sorted(set(t["immunites"]))))}]],')
    lignes += ["};", ""]
    (RACINE / "observateur" / "donnees-especes.ts").write_text("\n".join(lignes))
    taille = (RACINE / "observateur" / "donnees-especes.ts").stat().st_size
    print(f"observateur/donnees-especes.ts régénéré : {len(export['especes'])} espèces, "
          f"{len(export['attaques'])} attaques, {len(export['talents'])} talents ({taille // 1024} Ko)")


if __name__ == "__main__":
    main()
