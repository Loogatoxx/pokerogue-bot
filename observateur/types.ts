/**
 * Ce que le cerveau voit d'une partie : exactement ce qu'un joueur humain peut voir à l'écran,
 * plus son carnet (la mémoire de ce qu'il a déjà vu). Rien de caché : pas les IVs ni la nature
 * de l'adversaire, pas ses attaques tant qu'il ne les a pas utilisées, pas ses PV exacts.
 *
 * Les identifiants numériques servent au cerveau, les noms à l'affichage.
 * Toute modification de cette forme doit incrémenter VERSION_OBSERVATION : un cerveau
 * entraîné sur une version ne sait pas lire une autre.
 */
import type { CombatImportant } from "./combats";

export const VERSION_OBSERVATION = 5;

/** Un identifiant du jeu et son nom lisible. */
export interface Libelle {
  id: number;
  nom: string;
}

/** Une attaque vue chez l'adversaire : ce qu'elle fait est une connaissance publique. */
export interface AttaqueVue {
  id: number;
  nom: string;
  type: Libelle;
  categorie: Libelle;
  puissance: number;
  /** En pourcentage ; -1 pour une attaque qui touche toujours. */
  precision: number;
}

/** Une attaque de son équipe : on connaît aussi ses PP. */
export interface Attaque extends AttaqueVue {
  pp: number;
  ppMax: number;
}

export interface Objet {
  nom: string;
  quantite: number;
}

/** Un Pokémon de l'équipe : le joueur connaît tout de lui (écran de résumé). */
export interface PokemonAllie {
  uid: number;
  espece: number;
  nom: string;
  niveau: number;
  pv: number;
  pvMax: number;
  statut: Libelle;
  types: Libelle[];
  talent: Libelle;
  passif: Libelle | null;
  nature: Libelle;
  /** Dans l'ordre PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse. */
  ivs: number[];
  /** Statistiques réelles, même ordre que les IVs. */
  stats: number[];
  /** Statistiques de base de l'espèce, même ordre. */
  statsDeBase: number[];
  /** Modificateurs de combat (-6 à +6) : Att, Déf, Att. Spé., Déf. Spé., Vit, Précision, Esquive. */
  modifStats: number[];
  attaques: Attaque[];
  objets: Objet[];
  surTerrain: boolean;
  /** Place sur le terrain (0 ou 1 en combat double), null s'il est sur le banc. */
  position: number | null;
  ko: boolean;
  shiny: boolean;
}

/** Un Pokémon adverse sur le terrain : seulement ce qui s'affiche. */
export interface PokemonAdverse {
  uid: number;
  /** Espèce affichée (celle du déguisement si le Pokémon a Illusion). */
  espece: number;
  nom: string;
  niveau: number;
  /** Place sur le terrain (0 ou 1 en combat double). */
  position: number;
  /**
   * Statistiques de base de l'espèce affichée : connaissance publique (un joueur sait qu'une
   * Chenipotte est faible). Avec Illusion, ce sont celles du déguisement : un humain s'y
   * tromperait aussi.
   */
  statsDeBase: number[];
  /** La barre de PV, en pourcentage : le joueur ne voit pas les PV exacts de l'adversaire. */
  pvPourcent: number;
  statut: Libelle;
  types: Libelle[];
  boss: { segments: number; segmentsRestants: number } | null;
  modifStats: number[];
  objets: Objet[];
  shiny: boolean;
  ko: boolean;
  /** Déjà capturé une fois (le jeu affiche une petite Poké Ball à côté de son nom). */
  dejaCapture: boolean;
  /** Mémoire du combat : talent affiché par le jeu, sinon inconnu. */
  talentRevele: Libelle | null;
  /** Mémoire du combat : attaques qu'il a déjà utilisées. */
  attaquesVues: AttaqueVue[];
}

export type TypeDecision =
  | "equipe-depart"
  | "combat"
  | "cible"
  | "bonus"
  | "remplacement"
  | "attaque-a-oublier"
  | "equipe-pleine"
  | "biome"
  | "rencontre-mystere"
  | "aucune";

export interface OptionDecision {
  nom: string;
  cout?: number;
  /** Note de synergie (attaque à oublier) : plus haut = meilleur jeu d'attaques. */
  note?: number;
  pour?: string[];
  contre?: string[];
  /** L'option que le pilote choisirait. */
  recommandee?: boolean;
}

/** Ce que le jeu attend en ce moment. */
export interface Decision {
  /** Nom technique de la phase du jeu (ex. CommandPhase). */
  phase: string;
  type: TypeDecision;
  /** Pokémon qui doit agir (uid), pour un choix de combat. */
  acteur?: number;
  /** Sa place sur le terrain (0 ou 1), pour un choix de combat ou un remplacement. */
  positionActeur?: number;
  /**
   * Actions permises par le jeu à cet instant, pour les décisions confiées au cerveau
   * (combat, remplacement). Voir observateur/actions.ts pour la numérotation.
   */
  masque?: boolean[];
  /** Choix proposés (récompenses, biomes…). */
  options?: OptionDecision[];
}

export interface EntreeJournal {
  vague: number;
  texte: string;
}

export interface Observation {
  version: number;
  partie: {
    vague: number;
    tour: number;
    typeCombat: Libelle;
    double: boolean;
    biome: Libelle;
    meteo: Libelle;
    terrain: Libelle;
    argent: number;
    /** Défi du jour : classement partagé avec d'autres joueurs, le mode auto y est interdit. */
    quotidien: boolean;
    balls: (Libelle & { quantite: number })[];
    /** Le joueur voit le nombre de Poké Balls restantes du dresseur, pas ses Pokémon. */
    dresseur: { nom: string; pokemonRestants: number; specialite?: number } | null;
    /** v4 — le prochain combat important (rival, champion, boss…) : un joueur le voit venir. */
    prochainCombat: CombatImportant;
    /** Type du starter du rival, vu au rival 1 (absent avant, ou si la partie reprend d'une photo). */
    starterRival?: number;
    plafondNiveau?: number;
  };
  equipe: PokemonAllie[];
  adversaires: PokemonAdverse[];
  /** v5 — le banc adverse dont on se souvient : vus pendant ce combat, plus sur le terrain
   * (position -1). Sert à prévoir ses changements (observateur/prevision.ts). */
  banc: PokemonAdverse[];
  decision: Decision;
  /** Mémoire de la partie entière (carnet), du plus ancien au plus récent. */
  journal: EntreeJournal[];
}
