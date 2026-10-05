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

describe("Planificateur par duels (sans le combat d'équipe)", () => {
  const duels = { combatEquipe: false };
  it("change pour Carapuce, qui résiste au Feu prévu, plutôt que de laisser tomber Bulbizarre", () => {
    const obs = situation();
    const valeurs = planifier(obs, duels)!;
    expect(meilleure(valeurs, obs.decision.masque!)).toBe(10);
    expect(valeurs[10]!).toBeGreaterThan(valeurs[9]!); // Salamèche, lui, ne résiste pas mieux
  });

  it("achève un adversaire qui tombe ce tour-ci", () => {
    const obs = situation(5);
    const valeurs = planifier(obs, duels)!;
    expect(meilleure(valeurs, obs.decision.masque!)).toBeLessThan(8); // une attaque, pas un changement
    expect(Math.max(...valeurs.slice(0, 8))).toBeGreaterThanOrEqual(1.5);
  });
});

describe("Combat d'équipe (contre un dresseur)", () => {
  it("Bulbizarre, plus lent, prendrait la Flammèche : il change pour un Pokémon qui résiste au Feu", () => {
    const obs = situation();
    const valeurs = planifier(obs)!;
    expect([9, 10]).toContain(meilleure(valeurs, obs.decision.masque!)); // Salamèche ou Carapuce
    expect(valeurs[10]!).toBeGreaterThan(Math.max(valeurs[0]!, valeurs[2]!, valeurs[4]!, valeurs[6]!));
  });

  it("le remplaçant reçoit l'attaque choisie contre celui qui part (Flammèche), pas Éclair", () => {
    const eclair = { id: 84, nom: "Éclair", type: { id: 12, nom: "Électrik" }, categorie: { id: 1, nom: "Spéciale" }, puissance: 40, precision: 100 };
    const statut = { type: { id: 0, nom: "Normal" }, categorie: { id: 2, nom: "Statut" }, puissance: -1, precision: 100 };
    const rugissement = { ...statut, id: 45, nom: "Rugissement" };
    const grozyeux = { ...statut, id: 43, nom: "Groz'Yeux" };
    const obs = situation();
    obs.adversaires[0]!.attaquesVues = [...obs.adversaires[0]!.attaquesVues, eclair, rugissement, grozyeux];
    const valeurs = planifier(obs)!;
    expect(valeurs[10]!).toBeGreaterThan(valeurs[0]!);
  });

  it("plus rapide, il achève l'adversaire au lieu de changer", () => {
    const obs = situation(5);
    obs.equipe[0]!.stats[5] = 99;
    const valeurs = planifier(obs)!;
    expect(meilleure(valeurs, obs.decision.masque!)).toBeLessThan(8);
  });
});

describe("Planificateur et capture", () => {
  // Un Embrylex sauvage (taux de capture 45) face à Bulbizarre, Poké Balls en stock.
  function sauvage(pv: number): Observation {
    const obs = situation(pv);
    obs.partie.dresseur = null;
    obs.adversaires[0] = { ...obs.adversaires[0]!, espece: 246, nom: "Embrylex", types: [{ id: 5, nom: "Roche" }, { id: 4, nom: "Sol" }], statsDeBase: [50, 64, 50, 45, 50, 41], attaquesVues: [] };
    obs.decision.masque![14] = true;
    return obs;
  }

  it("n'insiste pas avec une Ball sur un Pokémon difficile en pleine forme", () => {
    const valeurs = planifier(sauvage(100), { capture: true })!;
    expect(valeurs[14]!).toBeLessThan(Math.max(...valeurs.slice(0, 8)));
  });

  it("lance la Ball quand il est presque K.O. et qu'on n'a que 3 membres", () => {
    const obs = sauvage(3);
    obs.equipe = obs.equipe.slice(0, 3);
    const valeurs = planifier(obs, { capture: true })!;
    expect(valeurs[14]!).toBeGreaterThan(1);
  });
});
