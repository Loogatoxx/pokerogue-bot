/**
 * Prévoir le coup de l'IA adverse (idée de Carlos : « anticiper l'IA adverse, comme aux échecs :
 * elle ne bluffe jamais, c'est à nous de prédire »).
 *
 * L'IA de PokeRogue suit une formule publique (jeu/docs/enemy-ai.md, EnemyPokemon.getNextMove) :
 *   1. si une de ses attaques peut mettre K.O. le Pokémon visé, elle ne considère que celles-là ;
 *   2. chaque attaque reçoit un score : (±2 × bonus de statistique + puissance / 5) × efficacité du
 *      type × 1,5 si l'attaque est de son type. Le « ±2 » vaut +2 si l'attaque est super efficace :
 *      elle adore le super efficace ;
 *   3. dresseurs et boss prennent presque toujours la meilleure (la 2e d'autant plus souvent que
 *      les scores sont proches) ; un sauvage prend la meilleure 5 fois sur 8, sinon la suivante…
 *
 * Et surtout : elle choisit APRÈS ton ordre, mais contre le Pokémon qui est en face d'elle à ce
 * moment-là. Si tu changes de Pokémon, son attaque, choisie pour l'ancien, frappe le nouveau.
 *
 * On reproduit ce calcul avec ce qu'un joueur voit : ses attaques déjà vues, celles qu'il peut
 * connaître à son niveau (Pokédex, observateur/especes.ts), et des statistiques estimées (IV
 * moyens, nature neutre) — jamais son vrai jeu d'attaques ni ses vrais IVs.
 */
import { attaquesPossibles } from "./especes";
import { EFFICACITE_TYPES } from "./noms";
import type { Observation, PokemonAdverse, PokemonAllie } from "./types";

export const NB_TYPES_PREVUS = 19;
const CATEGORIE_PHYSIQUE = 0;
const CATEGORIE_STATUT = 2;
/** Moyenne du tirage aléatoire des dégâts (entre 85 et 100 %). */
const TIRAGE_MOYEN = 0.925;

export interface AttaqueCandidate {
  /** Identifiant de l'attaque dans le jeu. */
  id: number;
  nom: string;
  type: number;
  categorie: number;
  puissance: number;
  /** Déjà utilisée par l'adversaire (sinon seulement possible d'après le Pokédex). */
  vue: boolean;
}

export interface CoupPrevu {
  attaque: AttaqueCandidate;
  probabilite: number;
  /** Dégâts moyens sur le Pokémon visé, en fraction de ses PV max. */
  degats: number;
}

/** Ce qu'un combattant apporte au calcul des dégâts. */
export interface Combattant {
  niveau: number;
  types: readonly number[];
  /** PV, Att, Déf, Att. Spé., Déf. Spé., Vit (valeurs réelles ou estimées). */
  stats: readonly number[];
  /** Crans de combat : Att, Déf, Att. Spé., Déf. Spé., Vit, Précision, Esquive. */
  crans: readonly number[];
}

export interface Prevision {
  /** Ses coups probables (attaques offensives), du plus au moins probable. */
  coups: CoupPrevu[];
  /** Probabilité, par type, que son attaque soit de ce type. */
  probabiliteParType: number[];
  /** Probabilité que son attaque soit super efficace sur le Pokémon visé. */
  superEfficace: number;
  /** Dégâts moyens attendus sur le Pokémon visé, en fraction de ses PV max. */
  degatsSurCible: number;
  /** Probabilité qu'il mette K.O. le Pokémon visé ce tour-ci. */
  koCible: number;
  /** Pour chaque membre de l'équipe : dégâts moyens (fraction de ses PV max) s'il entrait et
   * recevait cette attaque — le cœur du jeu de prédiction. */
  degatsSiEntre: number[];
  /** Mes attaques (celles du Pokémon visé) : dégâts moyens rapportés aux PV restants de
   * l'adversaire (1 = il tombe). */
  mesDegats: number[];
  /** Le Pokémon visé agit-il avant lui (Vitesse estimée, crans compris) ? */
  plusRapide: boolean;
}

const multiplicateurCran = (cran: number) => (cran >= 0 ? (2 + cran) / 2 : 2 / (2 - cran));

export function efficacite(typeAttaque: number, typesDefenseur: readonly number[]): number {
  return typesDefenseur.reduce((m, t) => m * (EFFICACITE_TYPES[typeAttaque]?.[t] ?? 1), 1);
}

/** Statistiques estimées d'un adversaire : stats de base, niveau, IV moyens (15), nature neutre. */
export function statsEstimees(statsDeBase: readonly number[], niveau: number): number[] {
  return statsDeBase.map((base, i) =>
    i === 0
      ? Math.floor(((2 * base + 15) * niveau) / 100) + niveau + 10
      : Math.floor(((2 * base + 15) * niveau) / 100) + 5,
  );
}

/** Dégâts moyens d'une attaque, en fraction des PV max du défenseur (formule du jeu, sans coup
 * critique, objet ni talent). */
export function degats(
  attaquant: Combattant,
  defenseur: Combattant,
  attaque: { type: number; categorie: number; puissance: number },
): number {
  if (attaque.categorie === CATEGORIE_STATUT || attaque.puissance <= 0) {
    return 0;
  }
  const physique = attaque.categorie === CATEGORIE_PHYSIQUE;
  const a = (attaquant.stats[physique ? 1 : 3] ?? 1) * multiplicateurCran(attaquant.crans[physique ? 0 : 2] ?? 0);
  const d = (defenseur.stats[physique ? 2 : 4] ?? 1) * multiplicateurCran(defenseur.crans[physique ? 1 : 3] ?? 0);
  const base = ((((2 * attaquant.niveau) / 5 + 2) * attaque.puissance * a) / Math.max(d, 1) / 50) + 2;
  const memeType = attaquant.types.includes(attaque.type) ? 1.5 : 1;
  return (base * memeType * efficacite(attaque.type, defenseur.types) * TIRAGE_MOYEN) / Math.max(defenseur.stats[0] ?? 1, 1);
}

const ids = (libelles: { id: number }[]) => libelles.map(l => l.id);

export function combattantAllie(p: PokemonAllie): Combattant {
  return { niveau: p.niveau, types: ids(p.types), stats: p.stats, crans: p.modifStats };
}

export function combattantAdverse(a: PokemonAdverse): Combattant {
  return { niveau: a.niveau, types: ids(a.types), stats: statsEstimees(a.statsDeBase, a.niveau), crans: a.modifStats };
}

/**
 * Ses attaques probables : celles déjà vues, complétées (jusqu'à 4) par les plus fortes qu'il
 * peut connaître à son niveau — le jeu donne surtout aux adversaires leurs attaques les plus fortes.
 */
export function candidates(a: PokemonAdverse): AttaqueCandidate[] {
  const vues: AttaqueCandidate[] = a.attaquesVues
    .filter(x => x.categorie.id !== CATEGORIE_STATUT && x.puissance > 0)
    .map(x => ({ id: x.id, nom: x.nom, type: x.type.id, categorie: x.categorie.id, puissance: x.puissance, vue: true }));
  const place = 4 - a.attaquesVues.length;
  if (place <= 0) {
    return vues;
  }
  const types = ids(a.types);
  const possibles = attaquesPossibles(a.espece, a.niveau)
    .filter(p => !vues.some(v => v.id === p.id))
    .sort((x, y) => y.puissance * (types.includes(y.type) ? 1.5 : 1) - x.puissance * (types.includes(x.type) ? 1.5 : 1))
    .slice(0, place)
    .map(p => ({ id: p.id, nom: p.nom, type: p.type, categorie: p.categorie, puissance: p.puissance, vue: false }));
  return [...vues, ...possibles];
}

/** Le score que l'IA du jeu donne à une attaque offensive contre une cible (docs/enemy-ai.md). */
function scoreIA(attaquant: Combattant, cible: Combattant, attaque: AttaqueCandidate): number {
  const eff = efficacite(attaque.type, cible.types);
  const physique = attaque.categorie === CATEGORIE_PHYSIQUE;
  const ratio = physique
    ? (attaquant.stats[3] ?? 1) / Math.max(attaquant.stats[1] ?? 1, 1)
    : (attaquant.stats[1] ?? 1) / Math.max(attaquant.stats[3] ?? 1, 1);
  const bonusStat = ratio <= 0.75 ? 2 : ratio <= 0.875 ? 1.5 : 1;
  const score = ((eff >= 2 ? 2 : -2) * bonusStat + Math.floor(attaque.puissance / 5))
    * eff * (attaquant.types.includes(attaque.type) ? 1.5 : 1);
  return score === 0 ? -20 : score;
}

/** Les probabilités de choix, du meilleur score au moins bon, selon le genre d'IA. */
function probabilitesIA(scores: number[], intelligente: boolean): number[] {
  const probas: number[] = [];
  let reste = 1;
  for (let i = 0; i < scores.length; i++) {
    if (i === scores.length - 1) {
      probas.push(reste);
      break;
    }
    // Chance de passer à l'attaque suivante : 3/8 pour un sauvage ; pour un dresseur ou un boss,
    // d'autant plus grande que les deux scores sont proches (rapport × 50 %).
    const rapport = scores[i]! !== 0 ? scores[i + 1]! / scores[i]! : 0;
    const passer = intelligente ? (rapport >= 0 ? Math.min(1, Math.round(rapport * 50) / 100) : 0) : 3 / 8;
    probas.push(reste * (1 - passer));
    reste *= passer;
  }
  return probas;
}

/** Le Pokémon que vise l'adversaire : celui qui décide, sinon le premier sur le terrain. */
export function cibleDe(obs: Observation): PokemonAllie | undefined {
  return obs.equipe.find(p => p.uid === obs.decision.acteur && p.surTerrain)
    ?? obs.equipe.find(p => p.surTerrain && !p.ko);
}

/**
 * Son coup probable contre `cible` (par défaut, le Pokémon qui décide : c'est lui qu'il vise ce
 * tour-ci). Avec une autre cible : ce qu'il ferait au tour suivant si elle était en face de lui.
 */
export function prevoir(obs: Observation, adversaire: PokemonAdverse, cibleImposee?: PokemonAllie): Prevision | null {
  const cible = cibleImposee ?? cibleDe(obs);
  if (!cible || adversaire.ko) {
    return null;
  }
  const lui = combattantAdverse(adversaire);
  const moi = combattantAllie(cible);
  let pool = candidates(adversaire);
  if (!pool.length) {
    return null;
  }
  // 1. Une attaque qui met K.O. passe avant tout.
  const pvCible = cible.pv / Math.max(cible.pvMax, 1);
  const tueuses = pool.filter(c => degats(lui, moi, c) >= pvCible);
  if (tueuses.length) {
    pool = tueuses;
  }
  // 2. Scores et probabilités, comme l'IA du jeu.
  const intelligente = adversaire.boss !== null || obs.partie.dresseur !== null;
  const tries = pool
    .map(attaque => ({ attaque, score: scoreIA(lui, moi, attaque) }))
    .sort((x, y) => y.score - x.score);
  const probas = probabilitesIA(tries.map(t => t.score), intelligente);
  const coups = tries.map((t, i) => ({ attaque: t.attaque, probabilite: probas[i] ?? 0, degats: degats(lui, moi, t.attaque) }));

  const probabiliteParType = new Array<number>(NB_TYPES_PREVUS).fill(0);
  for (const c of coups) {
    if (c.attaque.type >= 0 && c.attaque.type < NB_TYPES_PREVUS) {
      probabiliteParType[c.attaque.type]! += c.probabilite;
    }
  }
  const esperance = (f: (c: CoupPrevu) => number) => coups.reduce((s, c) => s + c.probabilite * f(c), 0);
  const vitesse = (c: Combattant) => (c.stats[5] ?? 0) * multiplicateurCran(c.crans[4] ?? 0);
  const pvAdverse = Math.max(adversaire.pvPourcent / 100, 0.01);
  return {
    coups,
    probabiliteParType,
    superEfficace: esperance(c => (efficacite(c.attaque.type, moi.types) >= 2 ? 1 : 0)),
    degatsSurCible: esperance(c => c.degats),
    koCible: esperance(c => (c.degats >= pvCible ? 1 : 0)),
    // Son attaque est choisie contre la cible actuelle ; si un autre membre entre, c'est lui qui la reçoit.
    degatsSiEntre: obs.equipe.map(p => (p.ko ? 0 : esperance(c => degats(lui, combattantAllie(p), c.attaque)))),
    mesDegats: cible.attaques.map(a =>
      degats(moi, lui, { type: a.type.id, categorie: a.categorie.id, puissance: a.puissance }) / pvAdverse),
    plusRapide: vitesse(moi) > vitesse(lui),
  };
}

// ─── Changements de Pokémon adverses ──────────────────────────────────────────────────────────

/**
 * Le « score de duel » du jeu (Pokemon.getMatchupScore), avec ce qu'un joueur sait : efficacité
 * moyenne de ses attaques (vues ou possibles) contre l'autre, résistance à ses types, et un facteur
 * de PV et de vitesse. Un dresseur s'en sert pour décider de changer de Pokémon.
 */
function scoreDuel(
  source: { types: readonly number[]; attaques: AttaqueCandidate[]; vitesse: number; pv: number; actif: boolean },
  adverse: { types: readonly number[]; vitesse: number; pv: number },
): number {
  let defense = 1 / Math.max(efficacite(adverse.types[0] ?? 0, source.types), 0.25);
  if (adverse.types.length > 1) {
    defense /= Math.max(efficacite(adverse.types[1]!, source.types), 0.25);
  }
  const offensives = source.attaques.filter(a => a.categorie !== CATEGORIE_STATUT && a.puissance > 0);
  const attaque = offensives.length
    ? offensives.reduce((t, a) => t + efficacite(a.type, adverse.types) * (source.types.includes(a.type) ? 1.5 : 1), 0) / offensives.length
    : 0;
  const plusRapide = source.vitesse >= adverse.vitesse;
  let pv = source.pv + (1 - adverse.pv);
  if (source.pv <= 0.2 && source.actif) {
    pv = !plusRapide && attaque < 1.5 && defense < 1.5 ? pv * 0.85 : 1 - source.pv + (plusRapide ? 0.2 : 0.1);
  } else if (plusRapide) {
    pv *= 1.25;
  } else if (source.pv > 0.2 && source.pv <= 0.4) {
    pv *= 0.5;
  }
  return (attaque + defense) * Math.min(pv, 1);
}

/** Vagues où le dresseur est un « boss » (champions, Conseil 4, chefs de la Team, derniers rivaux) :
 * il change dès qu'un Pokémon fait 2 fois mieux, au lieu de 3. */
const VAGUES_BOSS = new Set([95, 115, 145, 165, 182, 184, 186, 188, 190, 195]);

export interface ChangementPrevu {
  /** Le Pokémon qu'il fera entrer s'il est déjà vu ; null = un Pokémon encore jamais vu. */
  vers: PokemonAdverse | null;
  probabilite: number;
}

/** Les éléments de sa décision de changer, tels qu'un joueur peut les estimer. */
export interface ScoresChangement {
  /** Score de duel du Pokémon actuel contre le mien. */
  actuel: number;
  /** Le meilleur membre du banc déjà vu (null si aucun) et son score. */
  vers: PokemonAdverse | null;
  meilleurVu: number;
  /** Pokémon qui lui restent et qu'on n'a jamais vus (on voit ses Poké Balls, pas ses Pokémon). */
  inconnus: number;
  /** Il change si un membre fait `facteur` fois mieux : 3, ou 2 pour un boss. */
  facteur: number;
}

export function scoresChangement(obs: Observation, adversaire: PokemonAdverse, cibleImposee?: PokemonAllie): ScoresChangement | null {
  const cible = cibleImposee ?? cibleDe(obs);
  if (!obs.partie.dresseur || !cible || adversaire.ko) {
    return null;
  }
  const banc = (obs.banc ?? []).filter(b => !b.ko);
  const moi = combattantAllie(cible);
  const vitesse = (c: Combattant) => (c.stats[5] ?? 0) * multiplicateurCran(c.crans[4] ?? 0);
  const enFace = { types: moi.types, vitesse: vitesse(moi), pv: cible.pv / Math.max(cible.pvMax, 1) };
  const score = (a: PokemonAdverse, actif: boolean) => {
    const c = combattantAdverse(a);
    return scoreDuel({ types: c.types, attaques: candidates(a), vitesse: vitesse(c), pv: a.pvPourcent / 100, actif }, enFace);
  };
  const meilleur = banc.map(b => ({ b, s: score(b, false) })).sort((x, y) => y.s - x.s)[0];
  const presents = obs.adversaires.filter(a => !a.ko).length;
  return {
    actuel: score(adversaire, true),
    vers: meilleur?.b ?? null,
    meilleurVu: meilleur?.s ?? 0,
    inconnus: Math.max(0, obs.partie.dresseur.pokemonRestants - presents - banc.length),
    facteur: obs.partie.vague % 10 === 0 || VAGUES_BOSS.has(obs.partie.vague) ? 2 : 3,
  };
}

/**
 * Chance qu'il change vers un Pokémon jamais vu, selon le score de duel de son Pokémon actuel.
 * Mesurée dans le simulateur (01/10, 3 757 décisions de dresseurs) : sous 0,4 il change 9 fois
 * sur 10 ; vers 1 une fois sur 3 ; au-dessus de 2, presque jamais.
 */
const CHANGEMENT_INCONNU: [number, number][] = [[0.4, 0.92], [0.65, 0.78], [0.85, 0.6], [0.95, 0.35], [1.05, 0.15], [1.4, 0.1], [2, 0.04], [2.5, 0]];

function interpoler(points: [number, number][], x: number): number {
  if (x <= points[0]![0]) {
    return points[0]![1];
  }
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) {
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points.at(-1)![1];
}

/**
 * Va-t-il changer de Pokémon ce tour-ci ? Seuls les dresseurs changent : quand un membre de leur
 * banc a un score de duel 3 fois meilleur (2 fois pour un boss) que le Pokémon actuel, contre
 * celui qui est en face. Un joueur ne connaît que le banc déjà vu ; mais il voit les Poké Balls
 * qui restent au dresseur, et sait qu'un Pokémon en mauvaise posture va sans doute laisser sa place.
 * Mesuré : 89 % des changements se font vers un Pokémon encore jamais vu.
 */
export function prevoirChangement(obs: Observation, adversaire: PokemonAdverse, cibleImposee?: PokemonAllie): ChangementPrevu | null {
  const s = scoresChangement(obs, adversaire, cibleImposee);
  if (!s) {
    return null;
  }
  if (s.vers && s.meilleurVu >= s.facteur * s.actuel) {
    return { vers: s.vers, probabilite: 0.7 }; // mesuré : 39 fois sur 56 (le jeu freine les changements répétés)
  }
  const p = s.inconnus > 0 ? interpoler(CHANGEMENT_INCONNU, s.actuel) : 0;
  return p >= 0.1 ? { vers: null, probabilite: p } : null;
}
