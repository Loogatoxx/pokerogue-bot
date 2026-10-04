import { describe, expect, it } from "vitest";
import RENCONTRES from "../donnees/rencontres-mysteres.json";
import { optionRencontre } from "../pilote/pilote";

const AN_OFFER_YOU_CANT_REFUSE = 14;
const WEIRD_DREAM = 23;
const A_TRAINERS_TEST = 17;
const DARK_DEAL = 2;
const THE_EXPERT_POKEMON_BREEDER = 30;

describe("rencontres mystères", () => {
  it("ne vend jamais le Pokémon le plus fort", () => {
    expect(optionRencontre(AN_OFFER_YOU_CANT_REFUSE, [0, 2])).toBe(2);
    expect(optionRencontre(AN_OFFER_YOU_CANT_REFUSE, [0, 1, 2])).toBe(1);
  });

  it("ne part pas d'un rêve étrange (perte de 10 % des niveaux)", () => {
    expect(optionRencontre(WEIRD_DREAM, [0, 1, 2])).toBe(0);
  });

  it("refuse les combats brutaux quand refuser soigne", () => {
    expect(optionRencontre(A_TRAINERS_TEST, [0, 1])).toBe(1);
    expect(optionRencontre(DARK_DEAL, [0, 1])).toBe(1);
  });

  it("prend la première option permise pour une rencontre inconnue", () => {
    expect(optionRencontre(undefined, [1, 2])).toBe(1);
    expect(optionRencontre(999, [2])).toBe(2);
  });

  it("combat l'éleveur avec le Pokémon de plus haut niveau", () => {
    expect(optionRencontre(THE_EXPERT_POKEMON_BREEDER, [0, 1, 2], [12, 30, 18])).toBe(1);
    expect(optionRencontre(THE_EXPERT_POKEMON_BREEDER, [0, 2], [12, 30, 18])).toBe(2);
  });

  it("couvre les 31 rencontres du jeu", () => {
    expect(Object.keys(RENCONTRES.rencontres)).toHaveLength(31);
  });
});
