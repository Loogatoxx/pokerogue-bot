import { describe, expect, it } from "vitest";
import { Carnet } from "../observateur/carnet";
import type { ScenePokerogue } from "../observateur/jeu";

function vague20(dresseur: boolean): ScenePokerogue {
  return {
    currentBattle: { waveIndex: 20, battleType: 0, trainer: dresseur ? { getName: () => "Champion" } : null },
    arena: { biomeId: 0 },
    getEnemyField: () => [{ isOnField: () => false }],
    getPlayerParty: () => [],
  } as unknown as ScenePokerogue;
}

describe("Carnet : série des champions d'arène", () => {
  it("un dresseur à la vague 20 : champions aux vagues 20, 50, 80… ; un sauvage : 30, 60, 90…", () => {
    const avecDresseur = new Carnet();
    avecDresseur.mettreAJour(vague20(true));
    expect(avecDresseur.vagueDesChampions()).toBe(20);
    const sansDresseur = new Carnet();
    sansDresseur.mettreAJour(vague20(false));
    expect(sansDresseur.vagueDesChampions()).toBe(30);
  });
});
