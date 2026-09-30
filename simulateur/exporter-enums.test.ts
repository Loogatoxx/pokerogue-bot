/**
 * Exporte les énumérations du jeu utiles à l'observateur (id numérique ↔ clé), en JSON.
 * Utilisé par observateur/generer-noms.py pour régénérer observateur/noms.ts
 * après une mise à jour du jeu. Lancé depuis jeu/test/bot/ (voir generer-noms.py).
 */
import { TerrainType } from "#data/terrain";
import { BattleType } from "#enums/battle-type";
import { BiomeId } from "#enums/biome-id";
import { MoveCategory } from "#enums/move-category";
import { Nature } from "#enums/nature";
import { PokeballType } from "#enums/pokeball";
import { PokemonType } from "#enums/pokemon-type";
import { StatusEffect } from "#enums/status-effect";
import { WeatherType } from "#enums/weather-type";
import fs from "node:fs";
import { it } from "vitest";

const paires = (e: object) => Object.entries(e).filter(([, v]) => typeof v === "number");

it("exporte les énumérations", () => {
  const enums = {
    BattleType: paires(BattleType),
    BiomeId: paires(BiomeId),
    MoveCategory: paires(MoveCategory),
    Nature: paires(Nature),
    PokeballType: paires(PokeballType),
    PokemonType: paires(PokemonType),
    StatusEffect: paires(StatusEffect),
    TerrainType: paires(TerrainType),
    WeatherType: paires(WeatherType),
  };
  fs.writeFileSync(process.env.SORTIE ?? "enums.json", JSON.stringify(enums));
});
