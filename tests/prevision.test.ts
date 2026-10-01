/**
 * Prévoir le coup de l'IA adverse : sa formule publique, avec ce qu'un joueur voit.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prevoir, statsEstimees } from "../observateur/prevision";
import type { Observation } from "../observateur/types";

// Une vraie observation du simulateur (Bulbizarre, Salamèche, Carapuce), dont on remplace
// l'adversaire par un Salamèche niveau 12 qui a déjà utilisé Flammèche.
function situation(pvBulbizarre = 36): Observation {
  const obs: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  obs.partie.double = false;
  obs.equipe[0]!.pv = pvBulbizarre;
  obs.equipe[1]!.surTerrain = false; // simple : seul Bulbizarre est en face
  const flammeche = { id: 52, nom: "Flammèche", type: { id: 9, nom: "Feu" }, categorie: { id: 1, nom: "Spéciale" }, puissance: 40, precision: 100 };
  obs.adversaires = [{
    ...obs.adversaires[0]!, espece: 4, nom: "Salamèche", niveau: 12, types: [{ id: 9, nom: "Feu" }],
    statsDeBase: [39, 52, 43, 60, 50, 65], attaquesVues: [flammeche], pvPourcent: 100,
  }];
  return obs;
}

describe("Prévision du coup adverse", () => {
  it("estime les statistiques comme le jeu (IV moyens, nature neutre)", () => {
    expect(statsEstimees([45, 49, 49, 65, 65, 45], 50)[0]).toBe(112); // PV de Bulbizarre niveau 50
  });

  it("voit venir le Feu sur Bulbizarre (super efficace)", () => {
    // Sauvage : sa meilleure attaque 5 fois sur 8, comme le jeu.
    const sauvage = prevoir(situation(), situation().adversaires[0]!)!;
    expect(sauvage.probabiliteParType[9]).toBeCloseTo(5 / 8);
    // Dresseur : presque toujours la meilleure.
    const obs = situation();
    obs.partie.dresseur = { nom: "Rival", pokemonRestants: 2 };
    const dresseur = prevoir(obs, obs.adversaires[0]!)!;
    expect(dresseur.probabiliteParType[9]).toBeGreaterThan(0.8);
    expect(dresseur.superEfficace).toBeGreaterThan(0.8);
  });

  it("sait que Carapuce encaisserait bien mieux le même coup (le jeu de prédiction)", () => {
    const p = prevoir(situation(), situation().adversaires[0]!)!;
    const [bulbizarre, , carapuce] = p.degatsSiEntre;
    expect(carapuce!).toBeLessThan(bulbizarre! / 2);
  });

  it("sait quand il va mettre K.O. le Pokémon en face", () => {
    const p = prevoir(situation(2), situation(2).adversaires[0]!)!;
    expect(p.koCible).toBeGreaterThan(0.9);
  });
});
