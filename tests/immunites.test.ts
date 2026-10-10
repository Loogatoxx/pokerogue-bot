import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { combattantAdverse, combattantAllie, degats } from "../observateur/prevision";
import type { Observation } from "../observateur/types";

const ARCHEODONG = 437;
const LEVITATION = 26;
const FORCE_CHTONIENNE = { type: 4, categorie: 0, puissance: 90 };

function situation(talentRevele: boolean) {
  const obs: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  const lui = {
    ...obs.adversaires[0]!, espece: ARCHEODONG, nom: "Archéodong", niveau: 69,
    types: [{ id: 8, nom: "Acier" }, { id: 13, nom: "Psy" }], statsDeBase: [67, 89, 116, 79, 116, 33],
    talentRevele: talentRevele ? { id: LEVITATION, nom: "Lévitation" } : null,
  };
  return { moi: combattantAllie(obs.equipe[0]!), lui: combattantAdverse(lui) };
}

describe("Talents qui annulent un type", () => {
  it("une attaque Sol ne fait rien à un Archéodong dont on a vu Lévitation", () => {
    const { moi, lui } = situation(true);
    expect(degats(moi, lui, FORCE_CHTONIENNE)).toBe(0);
  });

  it("tant que son talent n'est pas montré, Lévitation n'est pas certaine (il a aussi Ignifugé, Heavy Metal)", () => {
    const { moi, lui } = situation(false);
    expect(degats(moi, lui, FORCE_CHTONIENNE)).toBeGreaterThan(0);
  });
});
