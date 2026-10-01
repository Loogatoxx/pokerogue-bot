/**
 * Exporte les énumérations du jeu utiles à l'observateur (id numérique ↔ clé) et la table
 * des types, en JSON.
 * Utilisé par observateur/generer-noms.py pour régénérer observateur/noms.ts
 * après une mise à jour du jeu. Lancé depuis jeu/test/bot/ (voir generer-noms.py).
 */
import { TerrainType } from "#data/terrain";
import { getTypeDamageMultiplier } from "#data/type";
import { BattleType } from "#enums/battle-type";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { ClassicFixedBossWaves } from "#enums/fixed-boss-waves";
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
import { PartyOption } from "#ui/party-ui-handler";
import { GameManager } from "#test/framework/game-manager";
import fs from "node:fs";
import Phaser from "phaser";
import { it } from "vitest";

const paires = (e: object) => Object.entries(e).filter(([, v]) => typeof v === "number");

it("exporte les énumérations", () => {
  // La table des types consulte les défis de la partie en cours : il en faut une (sans défi).
  new GameManager(new Phaser.Game({ type: Phaser.HEADLESS }));
  const enums = {
    BattleType: paires(BattleType),
    BattlerIndex: paires(BattlerIndex),
    Button: paires(Button),
    ClassicFixedBossWaves: paires(ClassicFixedBossWaves),
    Command: paires(Command),
    BiomeId: paires(BiomeId),
    MoveCategory: paires(MoveCategory),
    MoveTarget: paires(MoveTarget),
    MoveUseMode: paires(MoveUseMode),
    Nature: paires(Nature),
    PokeballType: paires(PokeballType),
    PartyOption: paires(PartyOption),
    PokemonType: paires(PokemonType),
    StatusEffect: paires(StatusEffect),
    TerrainType: paires(TerrainType),
    UiMode: paires(UiMode),
    WeatherType: paires(WeatherType),
  };
  // Table des types (18 × 18) : multiplicateur d'une attaque du type ligne contre le type colonne.
  const types = Array.from({ length: 18 }, (_, i) => i);
  const efficaciteTypes = types.map(attaque => types.map(defense => getTypeDamageMultiplier(attaque, defense)));
  fs.writeFileSync(process.env.SORTIE ?? "enums.json", JSON.stringify({ enums, efficaciteTypes }));
});
