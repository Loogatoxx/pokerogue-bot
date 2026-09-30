/**
 * Exporte les énumérations du jeu utiles à l'observateur (id numérique ↔ clé), en JSON.
 * Utilisé par observateur/generer-noms.py pour régénérer observateur/noms.ts
 * après une mise à jour du jeu. Lancé depuis jeu/test/bot/ (voir generer-noms.py).
 */
import { TerrainType } from "#data/terrain";
import { BattleType } from "#enums/battle-type";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { BiomeId } from "#enums/biome-id";
import { MoveCategory } from "#enums/move-category";
import { MoveTarget } from "#enums/move-target";
import { MoveUseMode } from "#enums/move-use-mode";
import { Nature } from "#enums/nature";
import { PokeballType } from "#enums/pokeball";
import { PokemonType } from "#enums/pokemon-type";
import { StatusEffect } from "#enums/status-effect";
import { UiMode } from "#enums/ui-mode";
import { WeatherType } from "#enums/weather-type";
import fs from "node:fs";
import { it } from "vitest";

const paires = (e: object) => Object.entries(e).filter(([, v]) => typeof v === "number");

it("exporte les énumérations", () => {
  const enums = {
    BattleType: paires(BattleType),
    BattlerIndex: paires(BattlerIndex),
    Button: paires(Button),
    Command: paires(Command),
    BiomeId: paires(BiomeId),
    MoveCategory: paires(MoveCategory),
    MoveTarget: paires(MoveTarget),
    MoveUseMode: paires(MoveUseMode),
    Nature: paires(Nature),
    PokeballType: paires(PokeballType),
    PokemonType: paires(PokemonType),
    StatusEffect: paires(StatusEffect),
    TerrainType: paires(TerrainType),
    UiMode: paires(UiMode),
    WeatherType: paires(WeatherType),
  };
  fs.writeFileSync(process.env.SORTIE ?? "enums.json", JSON.stringify(enums));
});
