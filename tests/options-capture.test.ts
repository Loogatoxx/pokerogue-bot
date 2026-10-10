import { describe, expect, it } from "vitest";
import { masqueSansBalls } from "../extension/src/options-capture";
import { PREMIERE_BALL } from "../observateur/actions";
import { membreARelacher, optionsSansVerrou } from "../pilote/pilote";

describe("Options de capture de l'extension", () => {
  it("« Bloquer les Balls » retire toutes les Balls des actions permises, et seulement elles", () => {
    const masque = new Array<boolean>(PREMIERE_BALL + 5).fill(true);
    const bloque = masqueSansBalls(masque, true);
    expect(bloque.slice(PREMIERE_BALL).every(p => !p)).toBe(true);
    expect(bloque.slice(0, PREMIERE_BALL).every(p => p)).toBe(true);
    expect(masqueSansBalls(masque, false)).toEqual(masque);
  });

  it("« Équipe intouchable » ne relâche jamais un membre quand l'équipe est pleine", () => {
    expect(membreARelacher(3, true)).toBeNull();
    expect(membreARelacher(3, false)).toBe(3);
  });

  it("un Pokémon verrouillé n'est jamais proposé au remplacement ; « ne pas garder » reste possible", () => {
    const option = (remplacer: number | null) => ({ remplacer, nom: "", note: 0, pour: [], contre: [] });
    const options = [option(null), option(0), option(1), option(2)];
    const gardees = optionsSansVerrou(options, [11, 22, 33], new Set([22]));
    expect(gardees.map(o => o.remplacer)).toEqual([null, 0, 2]);
  });
});
