/**
 * L'encodeur : traduit une observation en une liste de nombres de taille fixe, la seule
 * chose qu'un réseau de neurones sait lire.
 *
 * Principes :
 * - Chaque valeur est ramenée à peu près entre 0 et 1 (un niveau /100, un pourcentage /100…) :
 *   un réseau apprend mal quand ses entrées ont des échelles très différentes.
 * - Une catégorie (type, statut, météo…) devient un « one-hot » : une case par valeur possible,
 *   1 dans la bonne case, 0 ailleurs. Écrire « Feu = 9 » ferait croire au réseau que Feu est
 *   « plus grand » qu'Eau.
 * - Les places sont fixes : 6 cases pour l'équipe (dans l'ordre de l'équipe), 2 pour les
 *   adversaires (par place sur le terrain). Une case vide reste à 0 avec « présent = 0 ».
 *
 * Partagé entre le simulateur (entraînement) et l'extension (jeu en ligne) : le cerveau lit
 * exactement les mêmes nombres dans les deux cas. Toute modification change la taille ou le sens
 * des entrées : incrémenter VERSION_ENCODAGE (un cerveau existant ne saura plus lire).
 * Règle : on n'ajoute qu'À LA FIN. Les nombres existants gardent leur place et leur sens, ce qui
 * permet de « greffer » un cerveau existant (entraineur/greffe.py) au lieu de repartir de zéro.
 *
 * Historique : v1 = 1 290 nombres ; v2 = + 9 pour la capture (Poké Balls, équipe, déjà capturé) ;
 * v3 = + 5 pour le prochain combat important (dans combien de vagues, rival / dresseur / boss, et
 * « c'est maintenant »). Un cerveau v2 lit les 1 299 premiers nombres, qui n'ont pas changé ;
 * v4 = + 88 pour la connaissance « Pokédex » (idée de Carlos, observateur/especes.ts) : pour chaque
 * adversaire, ce qu'il PEUT avoir à son niveau (meilleure puissance par type, pire menace sur
 * l'acteur, types qu'un de ses talents possibles annule) et son potentiel ; pour chaque membre de
 * l'équipe, son potentiel (total de statistiques de sa forme finale).
 */
import { connaissance, immunitesPossibles, NB_TYPES_CONNUS, pireMenace, puissanceParType } from "./especes";
import type { AttaqueVue, Libelle, Observation, PokemonAdverse, PokemonAllie } from "./types";

export const VERSION_ENCODAGE = 4;

const NB_TYPES = 19; // Normal (0) → Stellaire (18) ; « inconnu » (-1) n'allume aucune case
const NB_STATUTS = 8;
const NB_METEOS = 10;
const NB_TERRAINS = 5;
const NB_TYPES_COMBAT = 4;
const NB_CATEGORIES = 3;
const NB_ATTAQUES = 4;
const NB_ALLIES = 6;
const NB_ADVERSAIRES = 2;

const TAILLE_ATTAQUE = 1 + NB_TYPES + NB_CATEGORIES + 3; // présente, type, catégorie, puissance, précision, PP
const TAILLE_PARTIE = 2 + 1 + NB_TYPES_COMBAT + NB_METEOS + NB_TERRAINS + 1 + 1 + 2 + 2;
const TAILLE_ALLIE = 4 + 2 + 2 + NB_STATUTS + NB_TYPES + 6 + 6 + 7 + NB_ATTAQUES * TAILLE_ATTAQUE + 1;
const TAILLE_ADVERSAIRE = 2 + 2 + 2 + NB_STATUTS + NB_TYPES + 2 + 6 + 7 + 1 + NB_ATTAQUES * TAILLE_ATTAQUE + 1;

const NB_BALLS = 5;
const TAILLE_CAPTURE = NB_BALLS + 2 + NB_ADVERSAIRES; // Balls en stock, taille de l'équipe, déjà capturés

const GENRES_COMBAT = ["rival", "dresseur", "boss"] as const;
const TAILLE_PROCHAIN_COMBAT = 1 + GENRES_COMBAT.length + 1; // dans combien de vagues, genre, maintenant
// Par adversaire : puissance possible par type, pire menace sur l'acteur, immunités possibles, potentiel.
const TAILLE_CONNAISSANCE_ADVERSAIRE = NB_TYPES_CONNUS + 1 + NB_TYPES_CONNUS + 2;
const TAILLE_CONNAISSANCE = NB_ADVERSAIRES * TAILLE_CONNAISSANCE_ADVERSAIRE + NB_ALLIES;
/** Un total de statistiques ramené vers 0-1 (720 = Arceus). */
const TOTAL_MAX = 720;

/** Taille de l'observation de chaque version de l'encodage (les versions ne font qu'ajouter à la fin). */
export const TAILLES_ENCODAGE: Readonly<Record<number, number>> = {
  1: TAILLE_PARTIE + NB_ALLIES * TAILLE_ALLIE + NB_ADVERSAIRES * TAILLE_ADVERSAIRE,
  2: TAILLE_PARTIE + NB_ALLIES * TAILLE_ALLIE + NB_ADVERSAIRES * TAILLE_ADVERSAIRE + TAILLE_CAPTURE,
  3: TAILLE_PARTIE + NB_ALLIES * TAILLE_ALLIE + NB_ADVERSAIRES * TAILLE_ADVERSAIRE + TAILLE_CAPTURE + TAILLE_PROCHAIN_COMBAT,
  4: TAILLE_PARTIE + NB_ALLIES * TAILLE_ALLIE + NB_ADVERSAIRES * TAILLE_ADVERSAIRE + TAILLE_CAPTURE + TAILLE_PROCHAIN_COMBAT
    + TAILLE_CONNAISSANCE,
};

export const TAILLE_OBSERVATION = TAILLES_ENCODAGE[VERSION_ENCODAGE]!;

/** Écrit dans un tableau en avançant une position, et vérifie qu'on remplit exactement chaque bloc. */
class Ecrivain {
  readonly valeurs = new Float32Array(TAILLE_OBSERVATION);
  position = 0;

  nombre(v: number): void {
    this.valeurs[this.position++] = Number.isFinite(v) ? v : 0;
  }

  booleen(v: boolean): void {
    this.nombre(v ? 1 : 0);
  }

  /** Une case par valeur possible ; `valeur` hors limites (ex. -1) n'allume rien. */
  oneHot(valeur: number, taille: number): void {
    for (let i = 0; i < taille; i++) {
      this.nombre(i === valeur ? 1 : 0);
    }
  }

  plusieursHot(valeurs: number[], taille: number): void {
    for (let i = 0; i < taille; i++) {
      this.nombre(valeurs.includes(i) ? 1 : 0);
    }
  }

  vide(taille: number): void {
    this.position += taille; // déjà à 0
  }

  bloc(taille: number, remplir: () => void): void {
    const debut = this.position;
    remplir();
    if (this.position - debut !== taille) {
      throw new Error(`Encodeur : bloc de ${this.position - debut} valeurs au lieu de ${taille}`);
    }
  }
}

const borne = (v: number, max = 1) => Math.max(0, Math.min(max, v));
const ids = (libelles: Libelle[]) => libelles.map(l => l.id);

function attaque(e: Ecrivain, a: AttaqueVue | undefined, ppRatio: number): void {
  e.bloc(TAILLE_ATTAQUE, () => {
    if (!a) {
      e.vide(TAILLE_ATTAQUE);
      return;
    }
    e.booleen(true);
    e.oneHot(a.type.id, NB_TYPES);
    e.oneHot(a.categorie.id, NB_CATEGORIES);
    e.nombre(borne(a.puissance / 200, 1.5));
    e.nombre(a.precision < 0 ? 1 : a.precision / 100); // -1 = touche toujours
    e.nombre(ppRatio);
  });
}

function allie(e: Ecrivain, p: PokemonAllie | undefined, estActeur: boolean): void {
  e.bloc(TAILLE_ALLIE, () => {
    if (!p) {
      e.vide(TAILLE_ALLIE);
      return;
    }
    e.booleen(true);
    e.booleen(p.ko);
    e.booleen(p.surTerrain);
    e.booleen(estActeur);
    e.oneHot(p.position ?? -1, 2);
    e.nombre(p.niveau / 100);
    e.nombre(p.pv / Math.max(p.pvMax, 1));
    e.oneHot(p.statut.id, NB_STATUTS);
    e.plusieursHot(ids(p.types), NB_TYPES);
    p.stats.forEach(s => e.nombre(borne(s / 400, 2)));
    p.statsDeBase.forEach(s => e.nombre(s / 255));
    p.modifStats.forEach(m => e.nombre(m / 6));
    for (let i = 0; i < NB_ATTAQUES; i++) {
      const a = p.attaques[i];
      attaque(e, a, a ? a.pp / Math.max(a.ppMax, 1) : 0);
    }
    e.nombre(borne(p.objets.reduce((n, o) => n + o.quantite, 0) / 10));
  });
}

function adversaire(e: Ecrivain, p: PokemonAdverse | undefined): void {
  e.bloc(TAILLE_ADVERSAIRE, () => {
    if (!p) {
      e.vide(TAILLE_ADVERSAIRE);
      return;
    }
    e.booleen(true);
    e.booleen(p.ko);
    e.oneHot(p.position, 2);
    e.nombre(p.niveau / 100);
    e.nombre(p.pvPourcent / 100);
    e.oneHot(p.statut.id, NB_STATUTS);
    e.plusieursHot(ids(p.types), NB_TYPES);
    e.booleen(p.boss !== null);
    e.nombre(p.boss ? p.boss.segmentsRestants / 5 : 0);
    p.statsDeBase.forEach(s => e.nombre(s / 255));
    p.modifStats.forEach(m => e.nombre(m / 6));
    e.booleen(p.talentRevele !== null);
    for (let i = 0; i < NB_ATTAQUES; i++) {
      attaque(e, p.attaquesVues[i], 1); // PP de l'adversaire inconnus
    }
    e.nombre(borne(p.objets.reduce((n, o) => n + o.quantite, 0) / 10));
  });
}

export function encoder(obs: Observation): Float32Array {
  const e = new Ecrivain();
  const p = obs.partie;
  const d = obs.decision;

  e.bloc(TAILLE_PARTIE, () => {
    e.nombre(p.vague / 200);
    e.nombre((p.vague % 10) / 10); // un boss revient toutes les 10 vagues : un humain le sait
    e.booleen(p.double);
    e.oneHot(p.typeCombat.id, NB_TYPES_COMBAT);
    e.oneHot(p.meteo.id, NB_METEOS);
    e.oneHot(p.terrain.id, NB_TERRAINS);
    e.nombre(borne(p.tour / 20));
    e.nombre(p.dresseur ? p.dresseur.pokemonRestants / 6 : 0);
    e.oneHot(d.type === "combat" ? 0 : d.type === "remplacement" ? 1 : -1, 2);
    e.oneHot(d.positionActeur ?? -1, 2);
  });

  for (let place = 0; place < NB_ALLIES; place++) {
    const p = obs.equipe[place];
    allie(e, p, !!p && p.uid === d.acteur);
  }
  for (let place = 0; place < NB_ADVERSAIRES; place++) {
    adversaire(e, obs.adversaires.find(a => a.position === place));
  }

  // v2 — capture : ce qu'un joueur regarde avant de lancer une Ball.
  e.bloc(TAILLE_CAPTURE, () => {
    for (let ball = 0; ball < NB_BALLS; ball++) {
      e.nombre(borne((p.balls.find(b => b.id === ball)?.quantite ?? 0) / 10));
    }
    e.nombre(obs.equipe.length / 6);
    e.booleen(obs.equipe.length >= 6);
    for (let place = 0; place < NB_ADVERSAIRES; place++) {
      e.booleen(!!obs.adversaires.find(a => a.position === place)?.dejaCapture);
    }
  });

  // v3 — le prochain combat important : un joueur sait que le rival arrive à la vague 8.
  e.bloc(TAILLE_PROCHAIN_COMBAT, () => {
    const combat = p.prochainCombat;
    e.nombre(Math.min(combat.dans, 10) / 10);
    e.oneHot(GENRES_COMBAT.indexOf(combat.genre), GENRES_COMBAT.length);
    e.booleen(combat.dans === 0);
  });

  // v4 — la connaissance « Pokédex » : de quoi se méfier, et ce qui vaut d'être capturé.
  const acteur = obs.equipe.find(a => a.uid === d.acteur) ?? obs.equipe.find(a => a.surTerrain && !a.ko);
  const typesActeur = acteur ? ids(acteur.types) : [];
  e.bloc(TAILLE_CONNAISSANCE, () => {
    for (let place = 0; place < NB_ADVERSAIRES; place++) {
      const a = obs.adversaires.find(x => x.position === place);
      const c = a ? connaissance(a.espece) : null;
      if (!a || !c) {
        e.vide(TAILLE_CONNAISSANCE_ADVERSAIRE);
        continue;
      }
      for (const puissance of puissanceParType(a.espece, a.niveau)) {
        e.nombre(borne(puissance / 150));
      }
      e.nombre(borne((pireMenace(a.espece, a.niveau, typesActeur)?.force ?? 0) / 300, 2));
      e.plusieursHot(immunitesPossibles(a.espece, a.talentRevele?.id ?? null), NB_TYPES_CONNUS);
      e.nombre(c.totalFinal / TOTAL_MAX);
      e.nombre(c.total / TOTAL_MAX);
    }
    for (let place = 0; place < NB_ALLIES; place++) {
      const membre = obs.equipe[place];
      e.nombre(membre ? (connaissance(membre.espece)?.totalFinal ?? 0) / TOTAL_MAX : 0);
    }
  });

  if (e.position !== TAILLE_OBSERVATION) {
    throw new Error(`Encodeur : ${e.position} valeurs écrites au lieu de ${TAILLE_OBSERVATION}`);
  }
  return e.valeurs;
}
