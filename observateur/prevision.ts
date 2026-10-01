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

function combattantAllie(p: PokemonAllie): Combattant {
  return { niveau: p.niveau, types: ids(p.types), stats: p.stats, crans: p.modifStats };
}

function combattantAdverse(a: PokemonAdverse): Combattant {
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
function cibleDe(obs: Observation): PokemonAllie | undefined {
  return obs.equipe.find(p => p.uid === obs.decision.acteur && p.surTerrain)
    ?? obs.equipe.find(p => p.surTerrain && !p.ko);
}

export function prevoir(obs: Observation, adversaire: PokemonAdverse): Prevision | null {
  const cible = cibleDe(obs);
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
