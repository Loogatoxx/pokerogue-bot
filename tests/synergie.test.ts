/**
 * Note de synergie des attaques : elle doit juger le jeu d'attaques dans son ensemble.
 */
import { describe, expect, it } from "vitest";
import { type AttaqueNotee, evaluerApprentissage, meilleureOption } from "../observateur/synergie";

// Valeurs du jeu : PokemonType (Normal 0, Eau 10, Plante 11, Électrik 12, Ténèbres 16),
// MoveCategory (physique 0, spéciale 1, statut 2).
const attaque = (nom: string, type: number, categorie: number, puissance: number, precision = 100): AttaqueNotee => ({
  nom, type, categorie, puissance, precision,
});
const charge = attaque("Charge", 0, 0, 40);
const mimiQueue = attaque("Mimi-Queue", 0, 2, 0);
const pistolet = attaque("Pistolet à O", 10, 1, 40);
const ecume = attaque("Écume", 10, 1, 40);
const morsure = attaque("Morsure", 16, 0, 60);
const tonnerre = attaque("Tonnerre", 12, 1, 90);

// Carapuce : type Eau, Attaque et Attaque Spé. proches.
const carapuce = { types: [10], stats: [44, 48, 65, 50, 64, 43] };

describe("Note de synergie des attaques", () => {
  it("remplace une attaque en double plutôt qu'une attaque qui couvre d'autres types", () => {
    const options = evaluerApprentissage(carapuce, [charge, mimiQueue, pistolet, ecume], tonnerre);
    const choix = meilleureOption(options);
    // Tonnerre (Électrik) touche l'Eau et le Vol : il doit prendre la place d'une des deux
    // attaques Eau identiques, pas celle de Charge ni de la seule attaque de statut.
    expect([2, 3]).toContain(choix.oublier);
    expect(choix.pour.join(" ")).toMatch(/touche super efficacement/);
  });

  it("refuse une attaque qui n'apporte rien", () => {
    const faible = attaque("Tunnel mou", 0, 0, 20);
    const choix = meilleureOption(evaluerApprentissage(carapuce, [charge, morsure, pistolet, tonnerre], faible));
    expect(choix.oublier).toBeNull();
  });

  it("explique le pour et le contre de chaque option", () => {
    const options = evaluerApprentissage(carapuce, [charge, mimiQueue, pistolet, ecume], tonnerre);
    expect(options).toHaveLength(5);
    const oublierPistolet = options.find(o => o.oublier === 2)!;
    expect(oublierPistolet.pour.some(p => p.includes("Eau"))).toBe(true); // Tonnerre touche l'Eau
    const oublierMimiQueue = options.find(o => o.oublier === 1)!;
    expect(oublierMimiQueue.contre.some(c => c.includes("Mimi-Queue"))).toBe(true);
  });
});
