import { speciesDataRegistry } from "#app/global-species-data-registry";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import fs from "node:fs";
import Phaser from "phaser";
import { it } from "vitest";

it("exporte les évolutions par niveau", () => {
  new GameManager(new Phaser.Game({ type: Phaser.HEADLESS }));
  const evolutions: Record<string, { nom: string; niveau: number; vers: string; gainStats: number }> = {};
  for (const espece of speciesDataRegistry.getAllSpecies()) {
    const parNiveau = speciesDataRegistry
      .getEvolutions(espece.speciesId)
      .filter(evolution => !evolution.item && !evolution.condition && evolution.level > 1);
    if (parNiveau.length !== 1) {
      continue;
    }
    const evolution = parNiveau[0]!;
    const cible = speciesDataRegistry.getSpecies(evolution.speciesId);
    evolutions[espece.speciesId] = {
      nom: SpeciesId[espece.speciesId] ?? String(espece.speciesId),
      niveau: evolution.level,
      vers: SpeciesId[evolution.speciesId] ?? String(evolution.speciesId),
      gainStats: cible.baseTotal - espece.baseTotal,
    };
  }
  const donnees = {
    source: "PokéRogue v1.12.0.11 : speciesDataRegistry.getEvolutions (src/data/balance/pokemon-evolutions.ts), évolutions par niveau seulement, sans objet ni condition, une seule possible",
    evolutions,
  };
  fs.writeFileSync(process.env.SORTIE ?? "evolutions.json", `${JSON.stringify(donnees, null, 1)}\n`);
});
