import { allBiomes } from "#data/data-lists";
import { BiomeId } from "#enums/biome-id";
import { BiomePoolTier } from "#enums/biome-pool-tier";
import { TrainerType } from "#enums/trainer-type";
import { GameManager } from "#test/framework/game-manager";
import { trainerConfigs } from "#trainers/trainer-config";
import { enumValueToKey } from "#utils/enums";
import { toCamelCase } from "#utils/strings";
import fs from "node:fs";
import Phaser from "phaser";
import { it } from "vitest";

const RANGS = ["COMMON", "UNCOMMON", "RARE", "SUPER_RARE", "ULTRA_RARE", "BOSS", "BOSS_RARE", "BOSS_SUPER_RARE", "BOSS_ULTRA_RARE"] as const;

it("exporte les biomes", () => {
  new GameManager(new Phaser.Game({ type: Phaser.HEADLESS }));
  const en = JSON.parse(fs.readFileSync("locales/en/biomes.json", "utf8")) as Record<string, string>;
  const fr = JSON.parse(fs.readFileSync("locales/fr/biomes.json", "utf8")) as Record<string, string>;
  const biomes: Record<string, unknown> = {};
  for (const [id, biome] of allBiomes) {
    const cle = toCamelCase(enumValueToKey(BiomeId, id));
    const sauvages = Object.fromEntries(RANGS.map(rang => {
      const parMoment = biome.pokemonPool[BiomePoolTier[rang]] ?? {};
      return [rang, [...new Set(Object.values(parMoment).flat())]];
    }));
    const champions = (biome.trainerPool[BiomePoolTier.BOSS] ?? []).map(t => ({
      nom: enumValueToKey(TrainerType, t),
      type: trainerConfigs[t]?.specialtyType ?? -1,
    }));
    biomes[id] = {
      nom: enumValueToKey(BiomeId, id),
      en: en[cle] ?? null,
      fr: fr[cle] ?? null,
      liens: biome.biomeLinks.map(l => (Array.isArray(l) ? [l[0], l[1]] : [l, 1])),
      sauvages,
      champions,
    };
  }
  const donnees = {
    source: "PokéRogue v1.12.0.11 : allBiomes (src/data/balance/biomes/*.ts) : sauvages par rang (toutes heures), liens (poids n : proposé 1 fois sur n), champions = dresseurs du rang BOSS et leur type (trainerConfigs.specialtyType) ; noms : locales/en et locales/fr biomes.json",
    biomes,
  };
  fs.writeFileSync(process.env.SORTIE ?? "biomes.json", `${JSON.stringify(donnees, null, 1)}\n`);
});
