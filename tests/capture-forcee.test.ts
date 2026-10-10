import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { etapeCapture, nouveauPlan, type PlanCapture } from "../extension/src/capture-forcee";
import type { ScenePokerogue } from "../observateur/jeu";
import type { Observation } from "../observateur/types";
import { ECRAN } from "../observateur/valeurs";

function situation(): Observation {
  const obs: Observation = JSON.parse(readFileSync("extension/apercu-observation.json", "utf8"));
  obs.partie.double = false;
  obs.partie.dresseur = null;
  obs.partie.vague = 60;
  obs.equipe[1]!.surTerrain = false;
  obs.adversaires = [{ ...obs.adversaires[0]!, position: 0, espece: 718, nom: "Zygarde", pvPourcent: 100 }];
  obs.decision = { ...obs.decision, type: "combat", masque: [true, false, true, false, true, false, true, false, false, true, true, false, false, false, true, false, false, false, false] };
  return obs;
}

function scene(ko = false, mode = 0, phase = "CommandPhase", options = 0, membres = 2): ScenePokerogue {
  const autres = Array.from({ length: membres - 1 }, (_, i) => ({ species: { speciesId: 4 + i }, isFainted: () => false }));
  return {
    currentBattle: { waveIndex: 60 },
    gameMode: { isDaily: false },
    getPlayerParty: () => [{ species: { speciesId: 1 }, isFainted: () => ko }, ...autres],
    getEnemyField: () => [{ species: { speciesId: 718 }, isFainted: () => false }],
    phaseManager: { getCurrentPhase: () => ({ phaseName: phase }) },
    ui: { getMode: () => mode, getHandler: () => ({ config: { options: new Array(options) } }) },
  } as unknown as ScenePokerogue;
}

const plan = (tentative: number): PlanCapture => ({ vague: 60, espece: 718, nom: "Zygarde", tentative, max: 100, dansEquipe: 0, koAuDepart: 0 });

describe("Capture forcée", () => {
  it("refuse le Daily Run", () => {
    const obs = situation();
    obs.partie.quotidien = true;
    expect(typeof nouveauPlan(scene(), obs, 100)).toBe("string");
  });

  it("à la tentative 1, lance la Ball tout de suite", () => {
    const etape = etapeCapture(scene(), situation(), plan(0), { toursAttendus: 0, ballLancee: false }, "combat");
    expect(etape).toMatchObject({ genre: "action", action: 14 });
  });

  it("à la tentative 3, attend d'abord avec une attaque de statut", () => {
    const obs = situation();
    const etape = etapeCapture(scene(), obs, plan(2), { toursAttendus: 0, ballLancee: false }, "combat");
    expect(etape.genre).toBe("action");
    const action = (etape as { action: number }).action;
    expect(obs.equipe[0]!.attaques[Math.floor(action / 2)]!.categorie.id).toBe(2);
  });

  it("après un K.O., envoie un remplaçant tant qu'il en reste au moins deux debout", () => {
    const obs = situation();
    obs.equipe[0]!.ko = true;
    obs.decision = { ...obs.decision, type: "remplacement", masque: obs.decision.masque!.map((_, i) => i === 9 || i === 10) };
    const etape = etapeCapture(scene(true, 0, "SwitchPhase", 0, 3), obs, plan(1), { toursAttendus: 0, ballLancee: false }, "remplacement");
    expect(etape).toMatchObject({ genre: "action" });
    expect([9, 10]).toContain((etape as { action: number }).action);
  });

  it("recharge quand il ne reste qu'un Pokémon debout", () => {
    expect(etapeCapture(scene(true), situation(), plan(1), { toursAttendus: 0, ballLancee: false }, "combat").genre).toBe("recharger");
  });

  it("s'arrête sur le choix de remplacement quand l'équipe est pleine", () => {
    const s = scene(false, ECRAN.CONFIRM, "AttemptCapturePhase", 4);
    expect(etapeCapture(s, situation(), plan(5), { toursAttendus: 5, ballLancee: true }, null).genre).toBe("fini");
  });
});
