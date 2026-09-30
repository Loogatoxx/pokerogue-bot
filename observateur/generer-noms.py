#!/usr/bin/env python3
"""Régénère observateur/noms.ts depuis la copie locale du jeu (énumérations + traductions françaises).

À relancer après chaque mise à jour du jeu :  python3 observateur/generer-noms.py
Pourquoi une table générée plutôt qu'un import direct des fichiers du jeu : l'extension et
l'observateur restent autonomes (aucune dépendance aux raccourcis d'import internes du jeu),
et le test du simulateur vérifie que la table colle toujours aux énumérations réelles.
"""
import json
import os
import re
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


def exporter_enums() -> dict:
    sortie = Path(tempfile.mkdtemp()) / "enums.json"
    (JEU / "test" / "bot").mkdir(parents=True, exist_ok=True)
    shutil.copy(RACINE / "simulateur" / "exporter-enums.test.ts", JEU / "test" / "bot")
    env = dict(os.environ, SORTIE=str(sortie), NODE_OPTIONS="--no-experimental-webstorage")
    subprocess.run(
        ["pnpm", "exec", "vitest", "run", "--silent=passed-only", "test/bot/exporter-enums.test.ts"],
        cwd=JEU, env=env, check=True, capture_output=True,
    )
    return json.loads(sortie.read_text())


def charger(nom: str) -> dict:
    return json.loads((FR / nom).read_text())


METEO = {
    "NONE": "Aucune", "SUNNY": "Soleil", "RAIN": "Pluie", "SANDSTORM": "Tempête de sable",
    "HAIL": "Grêle", "SNOW": "Neige", "FOG": "Brouillard", "HEAVY_RAIN": "Pluie battante",
    "HARSH_SUN": "Soleil intense", "STRONG_WINDS": "Vent mystérieux",
}
COMBAT = {"WILD": "sauvage", "TRAINER": "dresseur", "CLEAR": "vide", "MYSTERY_ENCOUNTER": "rencontre mystère"}
CATEGORIE = {"PHYSICAL": "Physique", "SPECIAL": "Spéciale", "STATUS": "Statut"}
BALLS = {"POKEBALL": "pokeBall"}  # seule clé qui ne suit pas la règle camelCase


def main() -> None:
    enums = exporter_enums()
    biomes, natures = charger("biomes.json"), charger("nature.json")
    types, statuts = charger("pokemon-info.json")["type"], charger("status-effect.json")
    terrains, balls = charger("terrain.json"), charger("pokeball.json")

    traducteurs = {
        "BiomeId": lambda k: biomes[camel(k)],
        "Nature": lambda k: natures[k.lower()],
        "PokemonType": lambda k: types[k.lower()],
        "StatusEffect": lambda k: "K.O." if k == "FAINT" else statuts[k.lower()]["name"],
        "TerrainType": lambda k: "Aucun" if k == "NONE" else terrains[k.lower()],
        "WeatherType": lambda k: METEO[k],
        "BattleType": lambda k: COMBAT[k],
        "MoveCategory": lambda k: CATEGORIE[k],
        "PokeballType": lambda k: balls[BALLS.get(k, camel(k))],
        # Valeurs techniques utilisées par le pilote (pas de nom français à afficher).
        "BattlerIndex": lambda k: k,
        "Button": lambda k: k,
        "Command": lambda k: k,
        "MoveTarget": lambda k: k,
        "MoveUseMode": lambda k: k,
        "UiMode": lambda k: k,
    }

    lignes = [
        "// Fichier GÉNÉRÉ par observateur/generer-noms.py — ne pas modifier à la main.",
        f"// Source : copie locale du jeu (version {json.loads((JEU / 'package.json').read_text())['version']}).",
        "",
        "/** Une entrée d'énumération du jeu : sa clé technique et son nom français. */",
        "export interface Nom {",
        "  cle: string;",
        "  fr: string;",
        "}",
        "",
    ]
    for enum, paires in sorted(enums.items()):
        lignes.append(f"export const {enum}: Readonly<Record<number, Nom>> = {{")
        for cle, valeur in paires:
            fr = traducteurs[enum](cle).replace('"', '\\"')
            # Une clé négative (ex. -1, type « inconnu ») doit être entre guillemets en JavaScript.
            cle_js = f'"{valeur}"' if valeur < 0 else str(valeur)
            lignes.append(f'  {cle_js}: {{ cle: "{cle}", fr: "{fr}" }},')
        lignes.append("};")
        lignes.append("")
    (RACINE / "observateur" / "noms.ts").write_text("\n".join(lignes))
    print(f"observateur/noms.ts régénéré ({sum(len(p) for p in enums.values())} entrées)")


if __name__ == "__main__":
    main()
