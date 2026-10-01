/**
 * Le planificateur (idée de Carlos : « comme aux échecs, on analyse aussi les positions futures et
 * on cherche le meilleur chemin ; parfois la meilleure attaque n'est pas celle de la situation
 * actuelle mais celle de la suivante »).
 *
 * Pour chaque action possible de combat, il joue la suite à l'avance avec ce qu'un joueur sait :
 * le coup prévu de l'IA adverse (observateur/prevision.ts) et la formule des dégâts.
 *   - Attaquer : qui frappe en premier ; si l'adversaire tombe ce tour-ci ; sinon, la « course au
 *     K.O. » qui suit (combien de tours il me faut pour le mettre K.O., combien il lui en faut).
 *   - Changer de Pokémon : l'IA a choisi son attaque contre celui qui part ; le remplaçant la
 *     reçoit en entrant, puis on joue sa course au K.O. contre l'adversaire.
 *   - Remplacer un Pokémon K.O. : pas de coup à l'entrée, seulement la course au K.O.
 * Chaque chemin reçoit une valeur : environ +1 si on gagne le duel (plus les PV qui restent),
 * environ −1 si on le perd (moins ce qu'on a infligé). C'est une recherche courte et lisible, pas
 * une boule de cristal : les attaques de statut, objets et talents ne sont pas simulés.
 *
 * Les Poké Balls (option `capture`) : chance de capture (observateur/capture.ts) × gain de la
 * capture + chance d'échec × le coup qu'on encaisse pendant ce temps. Contre un Pokémon en pleine
 * forme et difficile à attraper, mieux vaut l'affaiblir d'abord (remarque de Carlos, 01/10). Sans
 * cette option, elles reçoivent la valeur de la meilleure attaque (neutres : le cerveau décide).
 */
import { NOMBRE_ACTIONS, PREMIER_CHANGEMENT, PREMIERE_BALL } from "./actions";
import { chanceCapture } from "./capture";
import { connaissance } from "./especes";
import { cibleDe, combattantAdverse, combattantAllie, type Combattant, degats, prevoir } from "./prevision";
import type { Observation, PokemonAdverse, PokemonAllie } from "./types";

const TOURS_MAX = 8;

interface Duel {
  /** Tours qu'il me faut pour le mettre K.O. (avec ma meilleure attaque). */
  mesTours: number;
  /** Tours qu'il lui faut pour me mettre K.O. (avec son coup prévu). */
  sesTours: number;
  plusRapide: boolean;
  /** Dégâts par tour, en fraction des PV restants de chacun. */
  parTourMoi: number;
  parTourLui: number;
}

const vitesse = (c: Combattant) => (c.stats[5] ?? 0) * ((c.crans[4] ?? 0) >= 0 ? (2 + (c.crans[4] ?? 0)) / 2 : 2 / (2 - (c.crans[4] ?? 0)));
const tours = (parTour: number) => (parTour <= 0 ? TOURS_MAX + 1 : Math.min(TOURS_MAX + 1, Math.ceil(1 / parTour)));

/** Ce que mes attaques font à cet adversaire, en fraction de ses PV restants. */
function mesDegats(moi: PokemonAllie, lui: PokemonAdverse, pvLui: number): number[] {
  const a = combattantAllie(moi);
  const d = combattantAdverse(lui);
  return moi.attaques.map(x =>
    x.pp > 0 ? degats(a, d, { type: x.type.id, categorie: x.categorie.id, puissance: x.puissance }) / Math.max(pvLui, 0.01) : 0);
}

/** Ses dégâts attendus par tour sur `cible`, en fraction des PV restants de la cible. */
function sesDegats(obs: Observation, lui: PokemonAdverse, cible: PokemonAllie, pvCible: number): number {
  const p = prevoir(obs, lui, cible);
  if (!p) {
    return 0;
  }
  const c = combattantAllie(cible);
  const d = combattantAdverse(lui);
  const parCoup = p.coups.reduce((s, coup) => s + coup.probabilite * degats(d, c, coup.attaque), 0);
  return parCoup / Math.max(pvCible, 0.01);
}

function duel(obs: Observation, moi: PokemonAllie, pvMoi: number, lui: PokemonAdverse, pvLui: number): Duel {
  const parTourMoi = Math.max(0, ...mesDegats(moi, lui, pvLui));
  const parTourLui = sesDegats(obs, lui, moi, pvMoi);
  return {
    mesTours: tours(parTourMoi),
    sesTours: tours(parTourLui),
    plusRapide: vitesse(combattantAllie(moi)) > vitesse(combattantAdverse(lui)),
    parTourMoi,
    parTourLui,
  };
}

/** Valeur d'un duel joué jusqu'au bout : ~+1 gagné (+ PV restants), ~−1 perdu (+ dégâts infligés). */
function valeurDuel(d: Duel): number {
  const gagne = d.plusRapide ? d.mesTours <= d.sesTours : d.mesTours < d.sesTours;
  if (gagne) {
    const coupsRecus = d.plusRapide ? d.mesTours - 1 : d.mesTours;
    return 1 + 0.5 * Math.max(0, 1 - coupsRecus * d.parTourLui);
  }
  const coupsDonnes = d.plusRapide ? d.sesTours : d.sesTours - 1;
  return -1 + 0.5 * Math.min(1, coupsDonnes * d.parTourMoi);
}

/** Attaquer avec l'attaque `i` cet adversaire ce tour-ci, puis jouer au mieux. */
function valeurAttaque(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, i: number): number {
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  const ceTour = mesDegats(moi, lui, pvLui)[i] ?? 0;
  const d = duel(obs, moi, pvMoi, lui, pvLui);
  if (ceTour >= 1 && (d.plusRapide || d.parTourLui < 1)) {
    return 1.5 + 0.5 * (d.plusRapide ? 1 : 1 - d.parTourLui); // il tombe ce tour-ci
  }
  if (!d.plusRapide && d.parTourLui >= 1) {
    return -1; // il me met K.O. avant que je frappe
  }
  if (d.plusRapide && d.parTourLui >= 1) {
    return -1 + 0.5 * Math.min(1, ceTour); // je frappe, puis je tombe
  }
  // Les deux encaissent ; la suite est une course au K.O. avec ma meilleure attaque.
  const pvLuiApres = pvLui * (1 - ceTour);
  const pvMoiApres = pvMoi * (1 - d.parTourLui);
  return valeurDuel(duel(obs, moi, pvMoiApres, lui, pvLuiApres)) - 0.1 * (1 - ceTour / Math.max(d.parTourMoi, 0.01));
}

/** Changer pour `remplacant` : il reçoit le coup prévu contre celui qui part, puis la course. */
function valeurChangement(obs: Observation, partant: PokemonAllie, remplacant: PokemonAllie, lui: PokemonAdverse): number {
  const pvR = remplacant.pv / Math.max(remplacant.pvMax, 1);
  const p = prevoir(obs, lui, partant); // son attaque est choisie contre celui qui est en face
  if (!p) {
    return 0;
  }
  const r = combattantAllie(remplacant);
  const d = combattantAdverse(lui);
  const recu = p.coups.reduce((s, c) => s + c.probabilite * degats(d, r, c.attaque), 0) / Math.max(pvR, 0.01);
  if (recu >= 1) {
    return -1.5; // il tomberait en entrant
  }
  return valeurDuel(duel(obs, remplacant, pvR * (1 - recu), lui, lui.pvPourcent / 100)) - 0.15;
}

/** Lancer la Ball n° `ball` : capture (combat gagné sans un coup de plus) ou échec (il frappe). */
function valeurBall(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, ball: number): number {
  const p = chanceCapture(lui, ball);
  // Une capture vaut un K.O. (combat gagné, expérience donnée) plus un membre : utile tant que
  // l'équipe n'est pas pleine, ensuite seulement si l'espèce promet plus que le plus faible des six.
  const potentiel = (espece: number) => connaissance(espece)?.totalFinal ?? 0;
  const plusFaible = Math.min(...obs.equipe.map(m => potentiel(m.espece)));
  const membre = obs.equipe.length < 6 ? 0.5 : Math.max(0, Math.min(0.5, (potentiel(lui.espece) - plusFaible) / 300));
  const gain = 2 + membre;
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  const d = duel(obs, moi, pvMoi, lui, pvLui);
  const echec = d.parTourLui >= 1 ? -1 : valeurDuel(duel(obs, moi, pvMoi * (1 - d.parTourLui), lui, pvLui)) - 0.1;
  return p * gain + (1 - p) * echec;
}

export interface OptionsPlan {
  /** Juger aussi les Poké Balls par la chance de capture (sinon elles restent neutres). */
  capture?: boolean;
}

/**
 * La valeur de chaque action de combat (index = action du cerveau, observateur/actions.ts) ; null
 * hors combat. Les actions interdites par le masque gardent une valeur sans importance.
 */
export function planifier(obs: Observation, options: OptionsPlan = {}): number[] | null {
  const masque = obs.decision.masque;
  const adversaires = obs.adversaires.filter(a => !a.ko);
  if (!masque || !adversaires.length) {
    return null;
  }
  const valeurs = new Array<number>(NOMBRE_ACTIONS).fill(0);
  if (obs.decision.type === "remplacement") {
    // Après un K.O. : le remplaçant entre sans recevoir de coup ; seul compte le duel qui suit.
    for (let action = PREMIER_CHANGEMENT; action < PREMIERE_BALL; action++) {
      const r = obs.equipe[action - PREMIER_CHANGEMENT];
      if (masque[action] && r && !r.ko) {
        const pvR = r.pv / Math.max(r.pvMax, 1);
        valeurs[action] = Math.min(...adversaires.map(lui => valeurDuel(duel(obs, r, pvR, lui, lui.pvPourcent / 100))));
      }
    }
    return valeurs;
  }
  const moi = cibleDe(obs);
  if (obs.decision.type !== "combat" || !moi) {
    return null;
  }
  for (let action = 0; action < PREMIER_CHANGEMENT; action++) {
    const lui = adversaires.find(a => a.position === action % 2) ?? adversaires[0]!;
    valeurs[action] = masque[action] ? valeurAttaque(obs, moi, lui, Math.floor(action / 2)) : 0;
  }
  for (let action = PREMIER_CHANGEMENT; action < PREMIERE_BALL; action++) {
    const remplacant = obs.equipe[action - PREMIER_CHANGEMENT];
    if (!masque[action] || !remplacant || remplacant.ko) {
      continue;
    }
    // Contre plusieurs adversaires : le pire des duels.
    valeurs[action] = Math.min(...adversaires.map(lui => valeurChangement(obs, moi, remplacant, lui)));
  }
  const meilleureAttaque = Math.max(...valeurs.slice(0, PREMIER_CHANGEMENT).filter((_, i) => masque[i]), -2);
  const sauvage = adversaires.length === 1 ? adversaires[0]! : null;
  for (let action = PREMIERE_BALL; action < NOMBRE_ACTIONS; action++) {
    valeurs[action] = options.capture && sauvage && masque[action]
      ? valeurBall(obs, moi, sauvage, action - PREMIERE_BALL)
      : meilleureAttaque;
  }
  return valeurs;
}
