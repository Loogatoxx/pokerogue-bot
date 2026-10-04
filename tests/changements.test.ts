/**
 * Séries de changements (remarque de Carlos, 04/10 : « au moment de choisir l'attaque, il change de
 * Pokémon et perd un tour »). On tire 2 000 combats au hasard (graine fixe) et on rejoue le choix du
 * plan tour après tour : un changement fait entrer le remplaçant, qui encaisse le coup prévu contre
 * celui qui part. Avant le correctif : des allers-retours 0 → 1 → 0 → 1 dans les combats perdus.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planifier } from "../observateur/planificateur";
import { combattantAdverse, combattantAllie, degats, prevoir } from "../observateur/prevision";
import type { Observation } from "../observateur/types";

let graine = 12345;
const rnd = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const T = (id: number) => ({ id, nom: String(id) });
const ATT = [
  { id: 33, type: 0, cat: 0, p: 40 }, { id: 52, type: 9, cat: 1, p: 40 }, { id: 55, type: 10, cat: 1, p: 40 },
  { id: 22, type: 11, cat: 0, p: 45 }, { id: 84, type: 12, cat: 1, p: 40 }, { id: 93, type: 13, cat: 1, p: 50 },
  { id: 44, type: 16, cat: 0, p: 60 }, { id: 45, type: 0, cat: 2, p: -1 }, { id: 150, type: 0, cat: 2, p: -1 },
];
const attaque = (a: typeof ATT[number]) => ({ id: a.id, nom: "", type: T(a.type), categorie: T(a.cat), puissance: a.p, precision: 100, pp: 20, ppMax: 20 });

function scenario(base: Observation): Observation {
  const obs: Observation = structuredClone(base);
  obs.partie.double = false;
  obs.partie.dresseur = { nom: "D", pokemonRestants: 1 + Math.floor(rnd() * 4) };
  const n = 2 + Math.floor(rnd() * 4);
  const modele = obs.equipe[0]!;
  obs.equipe = Array.from({ length: n }, (_, i) => {
    const niveau = 10 + Math.floor(rnd() * 20);
    const stats = [0, 1, 2, 3, 4, 5].map(() => 15 + Math.floor(rnd() * 40));
    const pvMax = stats[0]! + 10;
    return {
      ...structuredClone(modele), uid: 1000 + i, niveau, stats, pvMax, pv: Math.max(1, Math.round(pvMax * (0.2 + 0.8 * rnd()))),
      types: [T(Math.floor(rnd() * 18))], modifStats: [0, 0, 0, 0, 0, 0, 0],
      attaques: Array.from({ length: 4 }, () => attaque(ATT[Math.floor(rnd() * ATT.length)]!)),
      surTerrain: i === 0, position: i === 0 ? 0 : null, ko: false,
    };
  });
  const a = ATT[Math.floor(rnd() * 7)]!;
  obs.adversaires = [{
    ...obs.adversaires[0]!, position: 0, niveau: 10 + Math.floor(rnd() * 20), types: [T(Math.floor(rnd() * 18))],
    statsDeBase: [0, 1, 2, 3, 4, 5].map(() => 30 + Math.floor(rnd() * 70)), pvPourcent: 20 + Math.floor(rnd() * 81),
    attaquesVues: [{ id: a.id, nom: "", type: T(a.type), categorie: T(a.cat), puissance: a.p, precision: 100 }], modifStats: [0, 0, 0, 0, 0, 0, 0],
  }];
  obs.banc = [];
  return obs;
}

function masque(obs: Observation): boolean[] {
  const m = new Array<boolean>(19).fill(false);
  const actif = obs.equipe.find(p => p.surTerrain)!;
  actif.attaques.forEach((x, i) => { m[i * 2] = x.pp > 0; });
  obs.equipe.forEach((p, i) => { m[8 + i] = !p.surTerrain && !p.ko; });
  return m;
}

function plusLongueSerie(options: Parameters<typeof planifier>[1], sauvage: boolean): number {
  graine = 12345;
  const base: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  let max = 0;
  for (let k = 0; k < 2000; k++) {
    const obs = scenario(base);
    if (sauvage) {
      obs.partie.dresseur = null;
    }
    let serie = 0;
    for (let tour = 0; tour < 30; tour++) {
      obs.decision = { ...obs.decision, type: "combat", masque: masque(obs), acteur: obs.equipe.find(p => p.surTerrain)!.uid };
      const v = planifier(obs, options)!;
      const m = obs.decision.masque!;
      const choix = v.reduce((b, x, i) => (m[i] && (b < 0 || x > v[b]!) ? i : b), -1);
      if (choix < 8 || choix >= 14) {
        break;
      }
      max = Math.max(max, ++serie);
      const partant = obs.equipe.find(p => p.surTerrain)!;
      const entrant = obs.equipe[choix - 8]!;
      const lui = obs.adversaires[0]!;
      const coup = prevoir(obs, lui, partant)!.coups[0]!.attaque;
      partant.surTerrain = false;
      partant.position = null;
      entrant.surTerrain = true;
      entrant.position = 0;
      entrant.pv = Math.max(0, Math.round(entrant.pv - degats(combattantAdverse(lui), combattantAllie(entrant), coup) * entrant.pvMax));
      if (entrant.pv <= 0) {
        entrant.ko = true;
        break;
      }
    }
  }
  return max;
}

describe("Pas de changements à la chaîne", () => {
  it("contre un dresseur (combat d'équipe simulé)", () => {
    expect(plusLongueSerie({}, false)).toBeLessThanOrEqual(1);
  });
  it("contre un dresseur, par duels", () => {
    expect(plusLongueSerie({ combatEquipe: false }, false)).toBeLessThanOrEqual(1);
  });
  it("contre un sauvage", () => {
    expect(plusLongueSerie({}, true)).toBeLessThanOrEqual(1);
  });
});
