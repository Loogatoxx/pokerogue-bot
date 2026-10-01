/**
 * Connaissance « Pokédex » : ce qu'une espèce peut avoir (attaques par niveau, talents, potentiel).
 */
import { describe, expect, it } from "vitest";
import { attaquesPossibles, connaissance, immunitesPossibles, pireMenace } from "../observateur/especes";

// Pokédex national = SpeciesId du jeu ; types : Feu 9, Plante 11, Sol 4.
describe("Connaissance des espèces", () => {
  it("connaît le potentiel d'une espèce (sa forme finale)", () => {
    expect(connaissance(246)).toMatchObject({ nom: "Embrylex", total: 300, totalFinal: 600 });
    expect(connaissance(1)?.totalFinal).toBe(525); // Bulbizarre → Florizarre
  });

  it("liste les attaques offensives possibles à un niveau donné", () => {
    const noms = attaquesPossibles(1, 10).map(a => a.nom);
    expect(noms).toContain("Fouet Lianes");
    expect(noms).not.toContain("Vampigraine"); // attaque de statut
    expect(attaquesPossibles(1, 3).map(a => a.nom)).not.toContain("Fouet Lianes"); // apprise au niveau 4
  });

  it("sait de quoi se méfier", () => {
    const menace = pireMenace(4, 10, [11]); // Salamèche niveau 10 contre un Pokémon Plante
    expect(menace?.attaque.type).toBe(9);
    expect(menace!.force).toBeGreaterThan(100); // Flammèche 40 × 1,5 (même type) × 2 (efficace)
  });

  it("connaît les immunités des talents possibles", () => {
    expect(immunitesPossibles(92, null)).toContain(4); // Fantominus : Lévitation → Sol
    expect(immunitesPossibles(4, null)).not.toContain(4);
  });
});
