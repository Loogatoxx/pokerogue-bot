/**
 * Le planificateur : jouer la suite à l'avance (coup prévu de l'IA adverse + formule des dégâts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planifier } from "../observateur/planificateur";
import type { Observation } from "../observateur/types";

// Bulbizarre (Plante/Poison) en face d'un Salamèche de dresseur qui a déjà lancé Flammèche ;
// au banc : Salamèche (Feu) et Carapuce (Eau, qui résiste au Feu).
function situation(pvAdverse = 100): Observation {
  const obs: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  obs.partie.double = false;
  obs.partie.dresseur = { nom: "Rival", pokemonRestants: 2 };
  obs.equipe[1]!.surTerrain = false;
  const flammeche = { id: 52, nom: "Flammèche", type: { id: 9, nom: "Feu" }, categorie: { id: 1, nom: "Spéciale" }, puissance: 40, precision: 100 };
  obs.adversaires = [{
    ...obs.adversaires[0]!, position: 0, espece: 4, nom: "Salamèche", niveau: 13, types: [{ id: 9, nom: "Feu" }],
    statsDeBase: [39, 52, 43, 60, 50, 65], attaquesVues: [flammeche], pvPourcent: pvAdverse,
  }];
  // Attaques de Bulbizarre (places 0 à 3, cible 0) ; changer pour Salamèche (9) ou Carapuce (10).
  obs.decision = { ...obs.decision, type: "combat", masque: [true, false, true, false, true, false, true, false, false, true, true, false, false, false, false, false, false, false, false] };
  return obs;
}

const meilleure = (valeurs: number[], masque: boolean[]) =>
  valeurs.reduce((m, v, i) => (masque[i] && v > valeurs[m]! ? i : m), masque.indexOf(true));

describe("Planificateur", () => {
  it("change pour Carapuce, qui résiste au Feu prévu, plutôt que de laisser tomber Bulbizarre", () => {
    const obs = situation();
    const valeurs = planifier(obs)!;
    expect(meilleure(valeurs, obs.decision.masque!)).toBe(10);
    expect(valeurs[10]!).toBeGreaterThan(valeurs[9]!); // Salamèche, lui, ne résiste pas mieux
  });

  it("achève un adversaire qui tombe ce tour-ci", () => {
    const obs = situation(5);
    const valeurs = planifier(obs)!;
    expect(meilleure(valeurs, obs.decision.masque!)).toBeLessThan(8); // une attaque, pas un changement
    expect(Math.max(...valeurs.slice(0, 8))).toBeGreaterThanOrEqual(1.5);
  });
});
