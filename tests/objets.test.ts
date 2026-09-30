/**
 * Note des objets : chaque récompense est jugée d'après l'état de l'équipe.
 */
import { describe, expect, it } from "vitest";
import { type ContexteObjets, evaluerObjets, type MembreObjets, meilleurObjet, type ObjetPropose } from "../observateur/objets";

const membre = (nom: string, niveau: number, types: number[], pv: number, pvMax: number, extra: Partial<MembreObjets> = {}): MembreObjets => ({
  nom, espece: 1, niveau, types, stats: [pvMax, 30, 25, 20, 25, 30], pv, pvMax, ko: pv === 0, statut: false,
  attaques: [{ nom: "Charge", type: 0, categorie: 0, puissance: 40, precision: 100 }], ppRatios: [1], ...extra,
});

const potion: ObjetPropose = { id: "POTION", nom: "Potion", cout: 0, soin: { points: 20, pourcent: 10, statut: false } };
const rappel: ObjetPropose = { id: "REVIVE", nom: "Rappel", cout: 0, ranime: { pourcent: 50 } };
const balls: ObjetPropose = { id: "POKEBALL", nom: "5 Poké Balls", cout: 0, ball: { type: 0, nombre: 5 } };
const charbon: ObjetPropose = { id: "ATTACK_TYPE_BOOSTER", nom: "Charbon", cout: 0, boosterType: { type: 9 } };

describe("Note des objets", () => {
  it("ne prend pas de Potion quand tout le monde est en pleine forme", () => {
    const ctx: ContexteObjets = { equipe: [membre("Salamèche", 10, [9], 30, 30)], balls: [5, 0, 0, 0, 0] };
    const options = evaluerObjets([potion, balls], ctx);
    expect(options[0]!.note).toBe(0);
    expect(options[0]!.contre).toContain("tout le monde est en pleine forme");
    expect(meilleurObjet(options)!.nom).toBe("5 Poké Balls");
  });

  it("préfère le Rappel quand un membre important est K.O.", () => {
    const ctx: ContexteObjets = {
      equipe: [membre("Carapuce", 12, [10], 0, 32), membre("Rattata", 5, [0], 10, 18)],
      balls: [5, 0, 0, 0, 0],
    };
    const choix = meilleurObjet(evaluerObjets([potion, rappel, balls], ctx))!;
    expect(choix.nom).toBe("Rappel");
    expect(choix.cible).toBe(0);
  });

  it("donne le Charbon à celui qui a des attaques Feu", () => {
    const flammeche = { nom: "Flammèche", type: 9, categorie: 1, puissance: 40, precision: 100 };
    const ctx: ContexteObjets = {
      equipe: [membre("Rattata", 12, [0], 20, 20), membre("Salamèche", 11, [9], 25, 25, { attaques: [flammeche] })],
      balls: [0, 0, 0, 0, 0],
    };
    const [option] = evaluerObjets([charbon], ctx);
    expect(option!.cible).toBe(1);
    expect(option!.note).toBeGreaterThan(0);
  });

  it("écarte un objet que le jeu refuse à tout le monde", () => {
    const ctx: ContexteObjets = { equipe: [membre("Salamèche", 10, [9], 5, 30)], balls: [5, 0, 0, 0, 0] };
    const refusee = { ...potion, ciblesPossibles: [] };
    const options = evaluerObjets([refusee], ctx);
    expect(options[0]!.note).toBeLessThan(0);
    expect(meilleurObjet(options)).toBeNull(); // mieux vaut passer que s'entêter
  });
});
