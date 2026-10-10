import { speciesDataRegistry } from "#app/global-species-data-registry";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import {
  RIVAL_1_POOL,
  RIVAL_2_POOL,
  RIVAL_3_POOL,
  RIVAL_4_POOL,
  RIVAL_5_POOL,
  RIVAL_6_POOL,
  type RivalPoolConfig,
} from "#trainers/rival-party-config";
import fs from "node:fs";
import Phaser from "phaser";
import { it } from "vitest";

const VAGUES = [8, 25, 55, 95, 145, 195];

function emplacement(slot: RivalPoolConfig[number]) {
  const especes = slot.pool.flat() as SpeciesId[];
  const stats = especes.map(id => speciesDataRegistry.getSpecies(id).baseStats);
  const moyenne = [0, 1, 2, 3, 4, 5].map(i => Math.round(stats.reduce((t, s) => t + (s[i] ?? 0), 0) / stats.length));
  const essai = { level: 0 } as unknown as Parameters<NonNullable<typeof slot.postProcess>>[0];
  try {
    slot.postProcess?.(essai);
  } catch {
    (essai as unknown as { level: number }).level = 0;
  }
  const niveau = (essai as unknown as { level: number }).level;
  return { niveau: niveau > 0 ? niveau : null, statsDeBase: moyenne, especes: especes.map(id => SpeciesId[id]) };
}

it("exporte les équipes des rivaux", () => {
  new GameManager(new Phaser.Game({ type: Phaser.HEADLESS }));
  const combats = [RIVAL_1_POOL, RIVAL_2_POOL, RIVAL_3_POOL, RIVAL_4_POOL, RIVAL_5_POOL, RIVAL_6_POOL];
  const donnees = {
    source: "PokéRogue v1.12.0.11 : src/data/trainers/rival-party-config.ts (RIVAL_n_POOL : liste de chaque emplacement, niveau fixé par postProcess)",
    rivaux: Object.fromEntries(combats.map((pool, i) => [VAGUES[i], pool.map(emplacement)])),
  };
  fs.writeFileSync(process.env.SORTIE ?? "rivaux.json", `${JSON.stringify(donnees, null, 1)}\n`);
});
