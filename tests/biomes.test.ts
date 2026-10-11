import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { biomeDuNom, choisirBiome } from "../observateur/biomes";
import type { Observation } from "../observateur/types";

const FONDS_MARINS = 10;
const GROTTE = 13;
const VOLCAN = 18;

const equipePlante = () => {
  const obs: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  return [obs.equipe[0]!];
};

describe("Choix du biome avec la Carte", () => {
  it("reconnaît un biome par son nom affiché, en français ou en anglais", () => {
    expect(biomeDuNom("Volcan", FONDS_MARINS)).toBe(VOLCAN);
    expect(biomeDuNom("Volcano", FONDS_MARINS)).toBe(VOLCAN);
    expect(biomeDuNom("Grotte", FONDS_MARINS)).toBe(GROTTE);
  });

  it("une équipe Plante va à la Grotte (Roche, Sol) plutôt qu'au Volcan (Feu), champion compris", () => {
    expect(choisirBiome(["Volcan", "Grotte"], equipePlante(), 10, FONDS_MARINS, 20)).toBe(1);
  });

  it("prend la première option si un nom est inconnu", () => {
    expect(choisirBiome(["Ailleurs", "Grotte"], equipePlante(), 10, FONDS_MARINS, 20)).toBe(0);
  });
});
