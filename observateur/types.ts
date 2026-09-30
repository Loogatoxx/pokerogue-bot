/**
 * Ce que le cerveau voit d'une partie : exactement ce qu'un joueur humain peut voir à l'écran,
 * plus son carnet (la mémoire de ce qu'il a déjà vu). Rien de caché : pas les IVs ni la nature
 * de l'adversaire, pas ses attaques tant qu'il ne les a pas utilisées, pas ses PV exacts.
 *
 * Les identifiants numériques servent au cerveau, les noms à l'affichage.
 * Toute modification de cette forme doit incrémenter VERSION_OBSERVATION : un cerveau
 * entraîné sur une version ne sait pas lire une autre.
 */
export const VERSION_OBSERVATION = 1;

/** Un identifiant du jeu et son nom lisible. */
export interface Libelle {
  id: number;
  nom: string;
}

export interface Attaque {
  id: number;
  nom: string;
  type: Libelle;
  categorie: Libelle;
  puissance: number;
  precision: number;
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
  /** Modificateurs de combat (-6 à +6) : Att, Déf, Att. Spé., Déf. Spé., Vit, Précision, Esquive. */
  modifStats: number[];
  attaques: Attaque[];
  objets: Objet[];
  surTerrain: boolean;
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
  /** La barre de PV, en pourcentage : le joueur ne voit pas les PV exacts de l'adversaire. */
  pvPourcent: number;
  statut: Libelle;
  types: Libelle[];
  boss: { segments: number; segmentsRestants: number } | null;
  modifStats: number[];
  objets: Objet[];
  shiny: boolean;
  ko: boolean;
  /** Mémoire du combat : talent affiché par le jeu, sinon inconnu. */
  talentRevele: Libelle | null;
  /** Mémoire du combat : attaques qu'il a déjà utilisées. */
  attaquesVues: Libelle[];
}

export type TypeDecision =
  | "equipe-depart"
  | "combat"
  | "cible"
  | "bonus"
  | "remplacement"
  | "attaque-a-oublier"
  | "biome"
  | "rencontre-mystere"
  | "aucune";

export interface OptionDecision {
  nom: string;
  cout?: number;
}

/** Ce que le jeu attend en ce moment. */
export interface Decision {
  /** Nom technique de la phase du jeu (ex. CommandPhase). */
  phase: string;
  type: TypeDecision;
  /** Pokémon qui doit agir, pour un choix de combat. */
  acteur?: number;
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
    balls: (Libelle & { quantite: number })[];
    /** Le joueur voit le nombre de Poké Balls restantes du dresseur, pas ses Pokémon. */
    dresseur: { nom: string; pokemonRestants: number } | null;
  };
  equipe: PokemonAllie[];
  adversaires: PokemonAdverse[];
  decision: Decision;
  /** Mémoire de la partie entière (carnet), du plus ancien au plus récent. */
  journal: EntreeJournal[];
}
