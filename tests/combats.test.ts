/**
 * Combats importants du Classique : ceux qu'un joueur voit venir.
 */
import { describe, expect, it } from "vitest";
import { combatDeLaVague, prochainCombatImportant } from "../observateur/combats";

describe("Combats importants", () => {
  it("reconnaît le rival, le Gamin et les boss toutes les 10 vagues", () => {
    expect(combatDeLaVague(8)?.genre).toBe("rival");
    expect(combatDeLaVague(25)?.genre).toBe("rival");
    expect(combatDeLaVague(5)?.nom).toBe("Gamin");
    expect(combatDeLaVague(20)?.genre).toBe("boss");
    expect(combatDeLaVague(190)?.nom).toBe("Maître de la Ligue");
    expect(combatDeLaVague(7)).toBeNull();
  });

  it("compte les vagues jusqu'au prochain", () => {
    expect(prochainCombatImportant(6)).toMatchObject({ vague: 8, dans: 2, genre: "rival" });
    expect(prochainCombatImportant(8)).toMatchObject({ vague: 8, dans: 0 });
    expect(prochainCombatImportant(21)).toMatchObject({ vague: 25, dans: 4 });
  });
});
