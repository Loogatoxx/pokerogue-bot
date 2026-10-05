/**
 * Le moteur de combat d'équipe : pour chaque coup possible, simuler le combat entier, équipe contre
 * équipe, et garder celui qui le gagne le mieux.
 *
 * Pourquoi (02/10) : au rival 1, les deux tiers des défaites étaient gagnables en jouant mieux le
 * combat (rejouées par le professeur), et la correction la plus fréquente du juge était « aurait dû
 * changer de Pokémon ». Le planificateur ne voyait qu'un duel à la fois : changer pour un remplaçant
 * plus faible y paraît toujours perdant, alors qu'épargner le porteur pour le Pokémon suivant du
 * rival peut gagner le combat. C'est l'idée « jeu d'échecs » de Carlos, à l'échelle du combat.
 *
 * Ce que le moteur sait — rien de plus qu'un joueur : nos Pokémon (tout), les adversaires vus (types,
 * niveau, PV en %, statistiques estimées du Pokédex), le nombre de Pokémon qui restent au dresseur
 * (ses Poké Balls), et la règle de l'IA adverse (elle frappe fort : le K.O. d'abord, sinon les plus
 * gros dégâts). Les Pokémon pas encore vus sont joués comme des Pokémon de même force, sans type connu.
 *
 * Simplifications : dégâts moyens (tirage 0,925) multipliés par la précision, ordre par la priorité
 * puis la vitesse ; effets des attaques en espérance (contrecoup, drainage, crans, brûlure, paralysie,
 * poison, peur : observateur/effets-attaques.ts) ; les deux camps frappent avec leur meilleure attaque,
 * et remplacent un K.O. par leur meilleur Pokémon. Seulement en combat simple (un contre un).
 */
import { NOMBRE_ACTIONS, PREMIER_CHANGEMENT, PREMIERE_BALL } from "./actions";
import { combatDeLaVague } from "./combats";
import { candidates, combattantAdverse, combattantAllie, type Combattant, degats, statsEstimees } from "./prevision";
import { facteurAttaque } from "./contraintes-attaques";
import { EFFETS_ATTAQUES, type EffetsAttaque } from "./effets-attaques";
import { EFFETS_STATUT } from "./effets-statut";
import { PRIORITES } from "./priorites";
import type { Observation, PokemonAdverse, PokemonAllie } from "./types";

const TOURS_MAX = 40;
/**
 * Prix d'un changement en plein combat (remarque de Carlos, 04/10 : « au moment de choisir l'attaque,
 * il change de Pokémon et perd un tour »). Le remplaçant encaisse un coup sans rien rendre : on ne
 * change que si le combat simulé y gagne nettement. Sans ce prix, dans un combat perdu d'avance (même
 * note pour toutes les actions), le départage poussait à changer, puis à rechanger au tour suivant :
 * des séries de dizaines de changements contre des dresseurs. Il dépasse les départages (≤ 0,001).
 */
const COUT_CHANGEMENT = 0.01;
const CATEGORIE_STATUT = 2;
const CATEGORIE_PHYSIQUE = 0;

interface Coup {
  type: number;
  categorie: number;
  puissance: number;
  /** De 0 à 1 (1 : touche toujours). */
  precision: number;
  /** Priorité (Vive-Attaque : +1) : frappe avant les autres, quelle que soit la vitesse. */
  priorite: number;
  /** Bluff, Escarmouche : ne marchent qu'au premier tour sur le terrain. */
  premierTourSeulement: boolean;
  /** Attaque de statut qui change des crans (Rugissement, Danse-Lames…) : [crans, étapes, sur soi]. */
  effet?: readonly [readonly number[], number, boolean];
  effets?: EffetsAttaque | undefined;
}

const PREMIER_TOUR_SEULEMENT = new Set([252, 660]); // Bluff (Fake Out), Escarmouche (First Impression)
const coupDe = (id: number, type: number, categorie: number, puissance: number, precision: number): Coup => ({
  type, categorie, puissance, precision, priorite: PRIORITES[id] ?? 0, premierTourSeulement: PREMIER_TOUR_SEULEMENT.has(id),
  ...(EFFETS_STATUT[id] ? { effet: EFFETS_STATUT[id] } : {}),
  ...(EFFETS_ATTAQUES[id] ? { effets: EFFETS_ATTAQUES[id] } : {}),
});

/** Multiplicateur de précision selon les crans (Précision de l'attaquant, Esquive du défenseur). */
const multiplicateurPrecision = (cran: number) => (cran >= 0 ? (3 + cran) / 3 : 3 / (3 - cran));

/**
 * Une attaque de statut qui change des crans (table générée du jeu : observateur/effets-statut.ts).
 * Ajouté le 03/10 : les joueurs affaiblissent ou se renforcent contre les boss ; le moteur les
 * comptait pour zéro. Les crans sont bornés à ±6 comme dans le jeu.
 */
function appliquerEffet(att: Acteur, def: Acteur, coup: Coup): void {
  if (!coup.effet || att.pv <= 0) {
    return;
  }
  const [crans, etapes, soi] = coup.effet;
  const cible = soi ? att : def;
  const nouveaux = [...cible.c.crans];
  for (const i of crans) {
    nouveaux[i] = Math.max(-6, Math.min(6, (nouveaux[i] ?? 0) + etapes));
  }
  cible.c = { ...cible.c, crans: nouveaux };
  cible.vitesse = vitesseActeur(cible);
}

interface Acteur {
  c: Combattant;
  /** PV restants, en fraction des PV max. */
  pv: number;
  coups: Coup[];
  vitesse: number;
  /** Poids dans la note finale (niveau rapporté au plus haut de son camp). */
  poids: number;
  /** Barres de PV d'un boss (1 sinon) : un coup ne peut pas en briser plus d'une sans gros surplus. */
  barres: number;
  brulure: number;
  paralysie: number;
  poison: number;
}

const POISON = 1;
const TOXIK = 2;
const PARALYSIE = 3;
const BRULURE = 6;
const TYPE_POISON = 3;
const TYPE_ACIER = 8;
const TYPE_FEU = 9;
const TYPE_ELECTRIK = 12;

const statutsDe = (statut: number) => ({
  brulure: statut === BRULURE ? 1 : 0,
  paralysie: statut === PARALYSIE ? 1 : 0,
  poison: statut === POISON || statut === TOXIK ? 1 : 0,
});

function immunise(a: Acteur, statut: number): boolean {
  const types = a.c.types;
  if (statut === BRULURE) {
    return types.includes(TYPE_FEU);
  }
  if (statut === PARALYSIE) {
    return types.includes(TYPE_ELECTRIK);
  }
  return types.includes(TYPE_POISON) || types.includes(TYPE_ACIER);
}

function changerCrans(cible: Acteur, crans: readonly number[], etapes: number): void {
  const nouveaux = [...cible.c.crans];
  for (const i of crans) {
    nouveaux[i] = Math.max(-6, Math.min(6, (nouveaux[i] ?? 0) + etapes));
  }
  cible.c = { ...cible.c, crans: nouveaux };
  cible.vitesse = vitesseActeur(cible);
}

function infligerStatut(def: Acteur, statut: number, p: number): void {
  if (p <= 0 || def.pv <= 0 || immunise(def, statut)) {
    return;
  }
  const nouveau = (1 - Math.min(1, def.brulure + def.paralysie + def.poison)) * p;
  if (statut === BRULURE) {
    def.brulure += nouveau;
  } else if (statut === PARALYSIE) {
    def.paralysie += nouveau;
    def.vitesse = vitesseActeur(def);
  } else {
    def.poison += nouveau;
  }
}

function effetsDuCoup(att: Acteur, def: Acteur, coup: Coup, touche: number, pvAvant: number): void {
  const e = coup.effets;
  if (!e) {
    return;
  }
  const inflige = Math.max(0, pvAvant - Math.max(def.pv, 0)) * (def.c.stats[0] ?? 1) / Math.max(att.c.stats[0] ?? 1, 1);
  if (e.recul) {
    att.pv -= inflige * e.recul;
  }
  if (e.reculPv) {
    att.pv -= e.reculPv;
  }
  if (e.drain && att.pv > 0) {
    att.pv = Math.min(1, att.pv + inflige * e.drain);
  }
  if (att.pv > 0) {
    for (const [crans, etapes, p] of e.soi ?? []) {
      changerCrans(att, crans, etapes * p * touche);
    }
  }
  if (def.pv > 0) {
    for (const [crans, etapes, p] of e.cible ?? []) {
      changerCrans(def, crans, etapes * p * touche);
    }
  }
  if (e.statut) {
    infligerStatut(def, e.statut[0], e.statut[1] * touche);
  }
}

function finDeTour(a: Acteur): void {
  if (a.pv > 0) {
    a.pv -= a.brulure / 16 + a.poison / 8;
  }
}

/**
 * Les dégâts sur un boss (jeu : calculateBossSegmentDamage) : ses PV sont découpés en barres ; un
 * coup s'arrête au bord de la barre en cours, sauf surplus — sauter n barres de plus demande
 * 2^n fois une barre de dégâts en trop. Sans ça, le moteur croyait abattre un boss d'un coup.
 */
function infliger(def: Acteur, dmg: number): void {
  if (def.barres <= 1 || dmg <= 0) {
    def.pv -= dmg;
    return;
  }
  const barre = 1 / def.barres;
  const index = Math.ceil(def.pv / barre - 1e-9) - 1;
  if (index <= 0) {
    def.pv -= dmg;
    return;
  }
  const seuil = barre * index;
  const surplus = dmg - (def.pv - seuil);
  if (surplus < 0) {
    def.pv -= dmg;
    return;
  }
  const sautees = Math.min(Math.max(Math.floor(Math.log2(Math.max(surplus, 1e-9) / barre)), 0), index);
  def.pv = seuil - barre * sautees;
}

const multiplicateurCran = (cran: number) => (cran >= 0 ? (2 + cran) / 2 : 2 / (2 - cran));
const vitesseDe = (c: Combattant) => (c.stats[5] ?? 0) * multiplicateurCran(c.crans[4] ?? 0);
const vitesseActeur = (a: Acteur) => vitesseDe(a.c) * (1 - 0.5 * a.paralysie);

function allie(p: PokemonAllie, enJeu: boolean): Acteur {
  const c = combattantAllie(p);
  const crans = enJeu ? c.crans : c.crans.map(() => 0);
  const combattant = { ...c, crans };
  return {
    c: combattant,
    pv: p.pv / Math.max(p.pvMax, 1),
    // Mêmes indices que les actions du cerveau : une attaque sans PP reste, mais ne fait rien.
    coups: p.attaques.map(a => coupDe(a.id, a.type.id, a.categorie.id, a.pp > 0 ? a.puissance * facteurAttaque(a.id) : 0, a.precision > 0 ? a.precision / 100 : 1)),
    vitesse: vitesseDe(combattant) * (p.statut.id === PARALYSIE ? 0.5 : 1),
    poids: 1,
    barres: 1,
    ...statutsDe(p.statut.id),
  };
}

function adverse(a: PokemonAdverse): Acteur {
  const c = combattantAdverse(a);
  return {
    c,
    pv: a.pvPourcent / 100,
    coups: candidates(a).map(x => coupDe(x.id, x.type, x.categorie, x.puissance, 1)),
    vitesse: vitesseDe(c) * (a.statut.id === PARALYSIE ? 0.5 : 1),
    poids: 1,
    barres: a.boss ? Math.max(1, a.boss.segments) : 1,
    ...statutsDe(a.statut.id),
  };
}

/**
 * L'oiseau du rival, pas encore sorti. Connaissance publique (jeu : rival-party-config.ts, wiki) :
 * le rival aligne toujours son starter et un oiseau (Roucool, Hoothoot, Étourmi, Nirondelle,
 * Poichigeon, Passerouge, Picassaut, Corvaillus, Wattrel…), un niveau en dessous du starter.
 * Statistiques de base : la moyenne de ces oiseaux (et de leur 1re évolution au rival 2).
 */
function oiseauDuRival(starter: Acteur, evolue: boolean): Acteur {
  const base = evolue ? [60, 70, 55, 50, 50, 80] : [43, 50, 36, 36, 36, 61];
  const niveau = Math.max(1, starter.c.niveau - 1);
  const c: Combattant = { niveau, types: [0, 2], stats: statsEstimees(base, niveau), crans: [0, 0, 0, 0, 0, 0, 0] };
  return {
    c, pv: 1, vitesse: vitesseDe(c), poids: 1, barres: 1, brulure: 0, paralysie: 0, poison: 0,
    coups: [coupDe(-1, 2, 0, evolue ? 60 : 40, 1), coupDe(-1, 0, 0, evolue ? 50 : 40, 1)], // Vol (Picpic, Cru-Ailes…), Normal
  };
}

/**
 * Un Pokémon jamais vu : même force que `modele`, en pleine forme, types inconnus. Chez un champion
 * d'arène (ou un dresseur à spécialité : Conseil 4…), tous ses Pokémon ont son type (connaissance
 * publique) : l'inconnu a ce type et sa plus forte attaque aussi. Les champions des vagues 30 à 90
 * faisaient un quart des défaites ; un inconnu « neutre » laissait le moteur sacrifier le membre qui
 * le battait.
 */
function inconnu(modele: Acteur, specialite?: number): Acteur {
  const plusForte = modele.coups.reduce((m, x, i) => (x.puissance > (modele.coups[m]?.puissance ?? -1) ? i : m), 0);
  return {
    c: { ...modele.c, types: specialite === undefined ? [] : [specialite], crans: modele.c.crans.map(() => 0) },
    pv: 1,
    // type inconnu : efficacité neutre, sans bonus de type
    coups: modele.coups.map((x, i) => ({ ...x, type: specialite !== undefined && i === plusForte ? specialite : -1, effets: undefined })),
    vitesse: vitesseDe(modele.c),
    poids: 1,
    barres: 1,
    brulure: 0,
    paralysie: 0,
    poison: 0,
  };
}

const toucheDe = (att: Acteur, def: Acteur, coup: Coup) =>
  Math.min(1, coup.precision * multiplicateurPrecision((att.c.crans[5] ?? 0) - (def.c.crans[6] ?? 0))) * (1 - att.paralysie / 8);

/** Dégâts attendus d'un coup (fraction des PV max de la cible), précision comprise. */
function attendus(att: Acteur, def: Acteur, coup: Coup): number {
  if (coup.categorie === CATEGORIE_STATUT || coup.puissance <= 0) {
    return 0;
  }
  const brule = coup.categorie === CATEGORIE_PHYSIQUE ? 1 - 0.5 * att.brulure : 1;
  return degats(att.c, def.c, { type: coup.type, categorie: coup.categorie, puissance: coup.puissance }) * toucheDe(att, def, coup) * brule;
}

/** La meilleure attaque : celle qui met K.O. (la plus sûre), sinon les plus gros dégâts attendus. */
function meilleurCoup(att: Acteur, def: Acteur): number {
  let meilleur = -1;
  let valeur = 0;
  att.coups.forEach((coup, i) => {
    const d = attendus(att, def, coup);
    const v = d >= def.pv ? 10 + coup.precision : d;
    if (v > valeur) {
      valeur = v;
      meilleur = i;
    }
  });
  return meilleur;
}

/** Tours pour que `att` mette `def` K.O. avec sa meilleure attaque (Infinity s'il ne fait rien). */
function toursPourKO(att: Acteur, def: Acteur): number {
  const i = meilleurCoup(att, def);
  const d = i < 0 ? 0 : attendus(att, def, att.coups[i]!);
  return d <= 0 ? Infinity : Math.ceil(def.pv / d);
}

/** Le remplaçant : celui qui gagne son duel avec le plus de marge, sinon celui qui tient le plus. */
function remplacant(equipe: Acteur[], enFace: Acteur): number {
  let meilleur = -1;
  let note = -Infinity;
  equipe.forEach((m, i) => {
    if (m.pv <= 0) {
      return;
    }
    const moi = toursPourKO(m, enFace);
    const lui = toursPourKO(enFace, m);
    const gagne = m.vitesse >= enFace.vitesse ? moi <= lui : moi < lui;
    const n = (gagne ? 100 : 0) + Math.min(lui, 50) - Math.min(moi, 50) * 0.5;
    if (n > note) {
      note = n;
      meilleur = i;
    }
  });
  return meilleur;
}

interface Combat {
  nous: Acteur[];
  eux: Acteur[];
  actif: number;
  actifEux: number;
}

const copier = (c: Combat): Combat => ({ ...c, nous: c.nous.map(a => ({ ...a })), eux: c.eux.map(a => ({ ...a })) });

/** Joue le combat jusqu'au bout ; `premier` : l'action du premier tour (attaque i, ou changement), ou
 * le remplaçant qui entre après un K.O. (sans coup reçu). */
function simuler(depart: Combat, premier: { attaque: number } | { changement: number } | { entree: number }): number {
  const c = copier(depart);
  if ("entree" in premier) {
    c.actif = premier.entree;
  }
  for (let tour = 0; tour < TOURS_MAX; tour++) {
    const lui = c.eux[c.actifEux]!;
    let moi = c.nous[c.actif]!;
    let monCoup = -1;
    if (tour === 0 && "changement" in premier) {
      c.actif = premier.changement; // le changement passe avant toute attaque
      moi = c.nous[c.actif]!;
    } else {
      monCoup = tour === 0 && "attaque" in premier ? premier.attaque : meilleurCoup(moi, lui);
      if (monCoup < 0) {
        monCoup = -1; // aucune attaque utile : il ne fait rien ce tour-ci
      }
    }
    const sonCoup = meilleurCoup(lui, moi);
    const frapper = (att: Acteur, def: Acteur, i: number, part = 1): number => {
      if (i < 0 || att.pv <= 0) {
        return 0;
      }
      const coup = att.coups[i]!;
      const pvAvant = def.pv;
      infliger(def, attendus(att, def, coup) * part);
      appliquerEffet(att, def, coup);
      effetsDuCoup(att, def, coup, toucheDe(att, def, coup) * part, pvAvant);
      return def.pv > 0 ? (coup.effets?.peur ?? 0) * toucheDe(att, def, coup) : 0;
    };
    // Bluff et Escarmouche ratent après le premier tour sur le terrain (simplifié : après le tour 0).
    if (tour > 0 && monCoup >= 0 && moi.coups[monCoup]!.premierTourSeulement) {
      monCoup = -1;
    }
    const prioMoi = monCoup >= 0 ? moi.coups[monCoup]!.priorite : 0;
    const prioLui = sonCoup >= 0 ? lui.coups[sonCoup]!.priorite : 0;
    const moiDAbord = prioMoi !== prioLui ? prioMoi > prioLui : moi.vitesse >= lui.vitesse;
    if (monCoup >= 0 && moiDAbord) {
      const peur = frapper(moi, lui, monCoup);
      frapper(lui, moi, sonCoup, 1 - peur);
    } else {
      const peur = frapper(lui, moi, sonCoup);
      frapper(moi, lui, monCoup, 1 - peur);
    }
    finDeTour(moi);
    finDeTour(lui);
    if (lui.pv <= 0) {
      const suivant = c.eux.findIndex(a => a.pv > 0);
      if (suivant < 0) {
        // Gagné : la note dépend des PV qui nous restent, le porteur comptant le plus.
        const total = c.nous.reduce((t, a) => t + a.poids, 0) || 1;
        return 1 + 0.5 * c.nous.reduce((t, a) => t + a.poids * Math.max(0, a.pv), 0) / total;
      }
      c.actifEux = suivant;
    }
    if (moi.pv <= 0) {
      const suivant = remplacant(c.nous, c.eux[c.actifEux]!);
      if (suivant < 0) {
        // Perdu : la note dépend de ce qu'il reste à l'adversaire.
        const restant = c.eux.reduce((t, a) => t + Math.max(0, a.pv), 0) / Math.max(c.eux.length, 1);
        return -1 + 0.5 * (1 - restant);
      }
      c.actif = suivant;
    }
  }
  return 0;
}

/**
 * La valeur de chaque action (attaques et changements) d'après le combat d'équipe simulé, ou null
 * si ce n'est pas un combat simple contre un dresseur. Les autres actions (Balls) gardent 0.
 */
export function valeursCombatEquipe(obs: Observation): number[] | null {
  const masque = obs.decision.masque;
  const enFace = obs.adversaires.filter(a => !a.ko);
  const remplacement = obs.decision.type === "remplacement";
  const surTerrain = obs.equipe.filter(p => p.surTerrain && !p.ko);
  if (!masque || !obs.partie.dresseur || enFace.length !== 1 || obs.partie.double || (!remplacement && surTerrain.length !== 1)) {
    return null;
  }
  const actif = remplacement ? 0 : obs.equipe.indexOf(surTerrain[0]!);
  const nous = obs.equipe.map(p => allie(p, p.surTerrain));
  const niveauMax = Math.max(...obs.equipe.map(p => p.niveau), 1);
  nous.forEach((a, i) => {
    a.poids = obs.equipe[i]!.niveau / niveauMax;
    if (obs.equipe[i]!.ko) {
      a.pv = 0;
    }
  });
  const lui = adverse(enFace[0]!);
  const banc = (obs.banc ?? []).filter(b => !b.ko).map(adverse);
  const restants = obs.partie.dresseur.pokemonRestants;
  const inconnus = Math.max(0, restants - 1 - banc.length);
  // Rival 1 ou 2 : l'oiseau, s'il n'est pas encore sorti, est le premier des Pokémon inconnus.
  const rival = combatDeLaVague(obs.partie.vague)?.genre === "rival" && obs.partie.vague <= 25;
  const oiseauVu = [...enFace, ...(obs.banc ?? [])].some(a => a.types.some(t => t.id === 2));
  // Son starter garde la même lignée toute la partie (vu au rival 1, retenu par le carnet) : s'il
  // n'est pas encore sorti, un des inconnus a son type.
  const typeStarter = combatDeLaVague(obs.partie.vague)?.genre === "rival" ? obs.partie.starterRival : undefined;
  const starterVu = typeStarter !== undefined && [...enFace, ...(obs.banc ?? [])].some(a => a.types[0]?.id === typeStarter);
  const inconnusJoues = Array.from({ length: inconnus }, (_, k) =>
    rival && !oiseauVu && k === 0 ? oiseauDuRival(lui, obs.partie.vague > 8)
      : typeStarter !== undefined && !starterVu && k === (rival && !oiseauVu ? 1 : 0) ? inconnu(lui, typeStarter)
        : inconnu(lui, obs.partie.dresseur!.specialite));
  const eux = [lui, ...banc, ...inconnusJoues];
  const depart: Combat = { nous, eux, actif, actifEux: 0 };
  const valeurs = new Array<number>(NOMBRE_ACTIONS).fill(0);
  for (let action = 0; action < PREMIERE_BALL; action++) {
    if (!masque[action]) {
      continue;
    }
    if (action < PREMIER_CHANGEMENT) {
      if (remplacement) {
        continue;
      }
      const attaque = Math.floor(action / 2);
      if (attaque < nous[actif]!.coups.length) {
        // Départage des égalités (souvent exactes, le calcul étant sans hasard) : les dégâts de ce tour.
        valeurs[action] = simuler(depart, { attaque }) + 0.001 * Math.min(1, attendus(nous[actif]!, lui, nous[actif]!.coups[attaque]!));
      }
    } else {
      const place = action - PREMIER_CHANGEMENT;
      if (nous[place] && nous[place]!.pv > 0) {
        // Départage : le Pokémon qui entre le plus solide (PV restants × niveau). Changer en plein
        // combat coûte un tour : à note égale, attaquer passe devant.
        valeurs[action] = simuler(depart, remplacement ? { entree: place } : { changement: place }) + 0.001 * nous[place]!.pv * nous[place]!.poids
          - (remplacement ? 0 : COUT_CHANGEMENT);
      }
    }
  }
  return valeurs;
}
