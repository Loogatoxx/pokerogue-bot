/**
 * Le constructeur d'équipe de départ : budget de 10 points, porteur en tête, trio qui couvre les
 * trois types de starter du rival (Plante, Feu, Eau).
 */
import { describe, expect, it } from "vitest";
import { type CandidatStarter, conseillerEquipes } from "../observateur/constructeur-equipe";

const starter = (espece: number, nom: string, cout: number, types: number[], statsDeBase: number[], extra: Partial<CandidatStarter> = {}): CandidatStarter => ({
  espece, nom, cout, types, statsDeBase, ivs: [15, 15, 15, 15, 15, 15], bonneNature: false, passif: false, talentCache: false,
  attaquesOeuf: 0, chance: 0, ...extra,
});

const bulbizarre = starter(1, "Bulbizarre", 3, [11, 3], [45, 49, 49, 65, 65, 45]);
const salameche = starter(4, "Salamèche", 3, [9], [39, 52, 43, 60, 50, 65]);
const carapuce = starter(7, "Carapuce", 3, [10], [44, 48, 65, 50, 64, 43]);
const chenipan = starter(10, "Chenipan", 2, [6], [45, 30, 35, 20, 20, 45]);
const mewtwo = starter(150, "Mewtwo", 8, [13], [106, 110, 90, 154, 90, 130]);

// Forces fixées pour tester la logique, indépendamment des mesures (observateur/puissance-starters.ts).
const FORCES: Record<number, number> = { 1: 45, 4: 45, 7: 45, 10: 30, 150: 80 };
const force = (espece: number) => FORCES[espece] ?? 40;

describe("Constructeur d'équipe de départ", () => {
  it("reste dans le budget de 10 points et met le porteur en tête", () => {
    const equipes = conseillerEquipes([bulbizarre, salameche, carapuce, chenipan, mewtwo], 3, force);
    for (const e of equipes) {
      expect(e.cout).toBeLessThanOrEqual(10);
    }
    expect(equipes[0]!.membres[0]!.nom).toBe("Mewtwo");
  });

  it("entre trois starters régionaux, prend le trio Plante + Feu + Eau", () => {
    const equipes = conseillerEquipes([bulbizarre, salameche, carapuce, chenipan], 3, force);
    expect(equipes[0]!.membres.map(m => m.nom).sort()).toEqual(["Bulbizarre", "Carapuce", "Salamèche"]);
  });

  it("de meilleurs IV et un passif font passer un starter devant un autre équivalent", () => {
    const carapuceFort = { ...carapuce, espece: 7, ivs: [31, 31, 31, 31, 31, 31], passif: true };
    const equipes = conseillerEquipes([bulbizarre, salameche, carapuceFort], 3, force);
    expect(equipes[0]!.membres[0]!.nom).toBe("Carapuce");
  });
});
