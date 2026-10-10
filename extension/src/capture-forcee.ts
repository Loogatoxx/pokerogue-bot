import { PREMIER_CHANGEMENT, PREMIERE_BALL } from "../../observateur/actions";
import type { ScenePokerogue } from "../../observateur/jeu";
import { cibleDe, combattantAdverse, combattantAllie, degats } from "../../observateur/prevision";
import type { Observation } from "../../observateur/types";
import { BOUTON, ECRAN } from "../../observateur/valeurs";

const CLE = "pokerogue-cerveau-capture";
const MASTER_BALL = 4;
const CATEGORIE_STATUT = 2;
const MARGE_KO = 1.6;

export interface PlanCapture {
  vague: number;
  espece: number;
  nom: string;
  tentative: number;
  max: number;
  dansEquipe: number;
  koAuDepart: number;
}

export interface MemoireCapture {
  toursAttendus: number;
  ballLancee: boolean;
}

export type Etape =
  | { genre: "rien" }
  | { genre: "titre"; texte: string }
  | { genre: "action"; action: number; texte: string }
  | { genre: "recharger"; texte: string }
  | { genre: "fini"; texte: string };

export function lirePlan(): PlanCapture | null {
  try {
    const texte = window.localStorage.getItem(CLE);
    return texte ? (JSON.parse(texte) as PlanCapture) : null;
  } catch {
    return null;
  }
}

export function ecrirePlan(plan: PlanCapture | null): void {
  try {
    if (plan) {
      window.localStorage.setItem(CLE, JSON.stringify(plan));
    } else {
      window.localStorage.removeItem(CLE);
    }
  } catch {
    return;
  }
}

const nombreDansEquipe = (scene: ScenePokerogue, espece: number) =>
  scene.getPlayerParty().filter(p => p.species.speciesId === espece).length;

const nombreKo = (scene: ScenePokerogue) => scene.getPlayerParty().filter(p => p.isFainted()).length;

const nombreDebout = (scene: ScenePokerogue) => scene.getPlayerParty().filter(p => !p.isFainted()).length;

function meilleurRemplacant(obs: Observation): number | null {
  const masque = obs.decision.masque ?? [];
  const places = obs.equipe.flatMap((m, place) =>
    masque[PREMIER_CHANGEMENT + place] && !m.ko ? [{ place, solidite: (m.pv / Math.max(m.pvMax, 1)) * m.niveau }] : []);
  if (!places.length) {
    return null;
  }
  return PREMIER_CHANGEMENT + places.reduce((m, x) => (x.solidite > m.solidite ? x : m)).place;
}

export function nouveauPlan(scene: ScenePokerogue, obs: Observation, max: number): PlanCapture | string {
  if (obs.partie.quotidien) {
    return "Jamais en Daily Run.";
  }
  const sauvages = obs.adversaires.filter(a => !a.ko);
  if (obs.partie.dresseur || sauvages.length !== 1) {
    return "Seulement contre un Pokémon sauvage seul.";
  }
  const lui = sauvages[0]!;
  return {
    vague: obs.partie.vague,
    espece: lui.espece,
    nom: lui.nom,
    tentative: 0,
    max,
    dansEquipe: nombreDansEquipe(scene, lui.espece),
    koAuDepart: nombreKo(scene),
  };
}

function meilleureBall(obs: Observation): number | null {
  const permises = [0, 1, 2, 3, 4].filter(b => obs.decision.masque?.[PREMIERE_BALL + b]);
  const normales = permises.filter(b => b !== MASTER_BALL);
  if (normales.length) {
    return Math.max(...normales);
  }
  return permises.length ? MASTER_BALL : null;
}

function degatsDesAttaques(obs: Observation): { action: number; degats: number; statut: boolean }[] {
  const moi = cibleDe(obs);
  const lui = obs.adversaires.find(a => !a.ko);
  const masque = obs.decision.masque ?? [];
  if (!moi || !lui) {
    return [];
  }
  return moi.attaques.flatMap((a, i) => {
    const action = 2 * i + lui.position;
    if (!masque[action] || a.pp <= 0) {
      return [];
    }
    const statut = a.categorie.id === CATEGORIE_STATUT;
    const d = statut ? 0 : degats(combattantAllie(moi), combattantAdverse(lui), { type: a.type.id, categorie: a.categorie.id, puissance: a.puissance });
    return [{ action, degats: d, statut }];
  });
}

function actionPourAffaiblir(obs: Observation): number | null {
  const offensives = degatsDesAttaques(obs).filter(a => !a.statut && a.degats > 0);
  if (!offensives.length) {
    return null;
  }
  return offensives.reduce((m, a) => (a.degats < m.degats ? a : m)).action;
}

function actionPourAttendre(obs: Observation): number | null {
  const lui = obs.adversaires.find(a => !a.ko);
  const pvLui = (lui?.pvPourcent ?? 0) / 100;
  const attaques = degatsDesAttaques(obs);
  const statut = attaques.find(a => a.statut);
  if (statut) {
    return statut.action;
  }
  const changement = (obs.decision.masque ?? []).findIndex((permis, i) => permis && i >= PREMIER_CHANGEMENT && i < PREMIERE_BALL);
  if (changement >= 0) {
    return changement;
  }
  const sures = attaques.filter(a => a.degats * MARGE_KO < pvLui);
  if (sures.length) {
    return sures.reduce((m, a) => (a.degats < m.degats ? a : m)).action;
  }
  return null;
}

type EcranTitre = {
  active?: boolean;
  config?: { options?: { label?: string }[] };
  setCursor(c: number): boolean;
  processInput(b: number): boolean;
};

function ecranTitre(scene: ScenePokerogue): "repris" | "sans-sauvegarde" | null {
  const phase = scene.phaseManager.getCurrentPhase()?.phaseName;
  const handler = scene.ui.getHandler() as EcranTitre | null;
  if (phase !== "TitlePhase" || scene.ui.getMode() !== ECRAN.TITRE || !handler?.active) {
    return null;
  }
  if (!/contin/i.test(handler.config?.options?.[0]?.label ?? "")) {
    return "sans-sauvegarde";
  }
  handler.setCursor(0);
  handler.processInput(BOUTON.ACTION);
  return "repris";
}

function choixEquipePleine(scene: ScenePokerogue): boolean {
  const phase = scene.phaseManager.getCurrentPhase()?.phaseName;
  const handler = scene.ui.getHandler() as { config?: { options?: unknown[] } } | null;
  return phase === "AttemptCapturePhase" && scene.ui.getMode() === ECRAN.CONFIRM && (handler?.config?.options?.length ?? 0) > 2;
}

export function etapeCapture(scene: ScenePokerogue, obs: Observation | null, plan: PlanCapture, memoire: MemoireCapture,
  decision: "combat" | "remplacement" | null): Etape {
  if (!scene.currentBattle) {
    const titre = ecranTitre(scene);
    if (titre === "sans-sauvegarde") {
      return { genre: "fini", texte: "Pas de partie à continuer sur l'écran titre : capture forcée arrêtée." };
    }
    return titre ? { genre: "titre", texte: "Reprise de la partie" } : { genre: "rien" };
  }
  if (choixEquipePleine(scene) || nombreDansEquipe(scene, plan.espece) > plan.dansEquipe) {
    return { genre: "fini", texte: `${plan.nom} capturé à la tentative ${plan.tentative + 1} ! Choisis qui il remplace.` };
  }
  if (scene.currentBattle.waveIndex !== plan.vague) {
    return { genre: "fini", texte: `Vague ${plan.vague} dépassée : capture forcée arrêtée.` };
  }
  if (nombreKo(scene) > plan.koAuDepart && nombreDebout(scene) <= 1) {
    return { genre: "recharger", texte: "Il ne reste qu'un Pokémon debout" };
  }
  const enFace = scene.getEnemyField().filter(p => !p.isFainted());
  if (!enFace.length) {
    return { genre: "recharger", texte: `${plan.nom} est K.O. ou parti` };
  }
  if (!decision || !obs?.decision.masque) {
    return { genre: "rien" };
  }
  if (decision === "remplacement") {
    const remplacant = meilleurRemplacant(obs);
    return remplacant === null ? { genre: "recharger", texte: "Personne pour remplacer" }
      : { genre: "action", action: remplacant, texte: `Envoie ${obs.equipe[remplacant - PREMIER_CHANGEMENT]!.nom}` };
  }
  if (memoire.ballLancee) {
    return { genre: "recharger", texte: "La Ball a échoué" };
  }
  const ball = meilleureBall(obs);
  if (ball === null) {
    const affaiblir = actionPourAffaiblir(obs);
    return affaiblir === null ? { genre: "recharger", texte: "Aucune attaque pour casser ses boucliers" }
      : { genre: "action", action: affaiblir, texte: "Casse ses boucliers avec l'attaque la plus faible" };
  }
  if (memoire.toursAttendus >= plan.tentative) {
    memoire.ballLancee = true;
    return { genre: "action", action: PREMIERE_BALL + ball, texte: `Lance la Ball (tentative ${plan.tentative + 1}, tour d'attente ${memoire.toursAttendus})` };
  }
  const attendre = actionPourAttendre(obs);
  if (attendre === null) {
    memoire.ballLancee = true;
    return { genre: "action", action: PREMIERE_BALL + ball, texte: "Rien pour attendre sans risque : lance la Ball" };
  }
  memoire.toursAttendus++;
  return { genre: "action", action: attendre, texte: `Attend un tour (${memoire.toursAttendus}/${plan.tentative})` };
}
