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
 * puis la vitesse, pas de statut ni de boost ; les deux camps frappent avec leur meilleure attaque, et
 * remplacent un K.O. par leur meilleur Pokémon. Seulement en combat simple (un contre un).
 */
import { NOMBRE_ACTIONS, PREMIER_CHANGEMENT, PREMIERE_BALL } from "./actions";
import { candidates, combattantAdverse, combattantAllie, type Combattant, degats } from "./prevision";
import { PRIORITES } from "./priorites";
import type { Observation, PokemonAdverse, PokemonAllie } from "./types";

const TOURS_MAX = 40;
const CATEGORIE_STATUT = 2;

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
}

const PREMIER_TOUR_SEULEMENT = new Set([252, 660]); // Bluff (Fake Out), Escarmouche (First Impression)
const coupDe = (id: number, type: number, categorie: number, puissance: number, precision: number): Coup => ({
  type, categorie, puissance, precision, priorite: PRIORITES[id] ?? 0, premierTourSeulement: PREMIER_TOUR_SEULEMENT.has(id),
});

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

function allie(p: PokemonAllie, enJeu: boolean): Acteur {
  const c = combattantAllie(p);
  const crans = enJeu ? c.crans : c.crans.map(() => 0);
  const combattant = { ...c, crans };
  return {
    c: combattant,
    pv: p.pv / Math.max(p.pvMax, 1),
    // Mêmes indices que les actions du cerveau : une attaque sans PP reste, mais ne fait rien.
    coups: p.attaques.map(a => coupDe(a.id, a.type.id, a.categorie.id, a.pp > 0 ? a.puissance : 0, a.precision > 0 ? a.precision / 100 : 1)),
    vitesse: vitesseDe(combattant),
    poids: 1,
    barres: 1,
  };
}

function adverse(a: PokemonAdverse): Acteur {
  const c = combattantAdverse(a);
  return {
    c,
    pv: a.pvPourcent / 100,
    coups: candidates(a).map(x => coupDe(x.id, x.type, x.categorie, x.puissance, 1)),
    vitesse: vitesseDe(c),
    poids: 1,
    barres: a.boss ? Math.max(1, a.boss.segments) : 1,
  };
}

/** Un Pokémon jamais vu : même force que `modele`, en pleine forme, types inconnus. */
function inconnu(modele: Acteur): Acteur {
  return {
    c: { ...modele.c, types: [], crans: modele.c.crans.map(() => 0) },
    pv: 1,
    coups: modele.coups.map(x => ({ ...x, type: -1 })), // type inconnu : efficacité neutre, sans bonus de type
    vitesse: modele.vitesse,
    poids: 1,
    barres: 1,
  };
}

/** Dégâts attendus d'un coup (fraction des PV max de la cible), précision comprise. */
function attendus(att: Acteur, def: Acteur, coup: Coup): number {
  if (coup.categorie === CATEGORIE_STATUT || coup.puissance <= 0) {
    return 0;
  }
  return degats(att.c, def.c, { type: coup.type, categorie: coup.categorie, puissance: coup.puissance }) * coup.precision;
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
    const frapper = (att: Acteur, def: Acteur, i: number) => {
      if (i >= 0 && att.pv > 0) {
        infliger(def, attendus(att, def, att.coups[i]!));
      }
    };
    // Bluff et Escarmouche ratent après le premier tour sur le terrain (simplifié : après le tour 0).
    if (tour > 0 && monCoup >= 0 && moi.coups[monCoup]!.premierTourSeulement) {
      monCoup = -1;
    }
    const prioMoi = monCoup >= 0 ? moi.coups[monCoup]!.priorite : 0;
    const prioLui = sonCoup >= 0 ? lui.coups[sonCoup]!.priorite : 0;
    const moiDAbord = prioMoi !== prioLui ? prioMoi > prioLui : moi.vitesse >= lui.vitesse;
    if (monCoup >= 0 && moiDAbord) {
      frapper(moi, lui, monCoup);
      frapper(lui, moi, sonCoup);
    } else {
      frapper(lui, moi, sonCoup);
      frapper(moi, lui, monCoup);
    }
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
  const eux = [lui, ...banc, ...Array.from({ length: inconnus }, () => inconnu(lui))];
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
        // Départage : le Pokémon qui entre le plus solide (PV restants × niveau).
        valeurs[action] = simuler(depart, remplacement ? { entree: place } : { changement: place }) + 0.001 * nous[place]!.pv * nous[place]!.poids;
      }
    }
  }
  return valeurs;
}
