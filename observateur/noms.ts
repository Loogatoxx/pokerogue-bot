// Fichier GÉNÉRÉ par observateur/generer-noms.py — ne pas modifier à la main.
// Source : copie locale du jeu (version 1.12.0.11).

/** Une entrée d'énumération du jeu : sa clé technique et son nom français. */
export interface Nom {
  cle: string;
  fr: string;
}

export const BattleType: Readonly<Record<number, Nom>> = {
  0: { cle: "WILD", fr: "sauvage" },
  1: { cle: "TRAINER", fr: "dresseur" },
  2: { cle: "CLEAR", fr: "vide" },
  3: { cle: "MYSTERY_ENCOUNTER", fr: "rencontre mystère" },
};

export const BiomeId: Readonly<Record<number, Nom>> = {
  0: { cle: "TOWN", fr: "Ville" },
  1: { cle: "PLAINS", fr: "Plaines" },
  2: { cle: "GRASS", fr: "Herbes" },
  3: { cle: "TALL_GRASS", fr: "Hautes Herbes" },
  4: { cle: "METROPOLIS", fr: "Métropole" },
  5: { cle: "FOREST", fr: "Forêt" },
  6: { cle: "SEA", fr: "Mer" },
  7: { cle: "SWAMP", fr: "Marécage" },
  8: { cle: "BEACH", fr: "Plage" },
  9: { cle: "LAKE", fr: "Lac" },
  10: { cle: "SEABED", fr: "Fonds Marins" },
  11: { cle: "MOUNTAIN", fr: "Montagne" },
  12: { cle: "BADLANDS", fr: "Terres Sauvages" },
  13: { cle: "CAVE", fr: "Grotte" },
  14: { cle: "DESERT", fr: "Désert" },
  15: { cle: "ICE_CAVE", fr: "Caverne Gelée" },
  16: { cle: "MEADOW", fr: "Prairie" },
  17: { cle: "POWER_PLANT", fr: "Centrale" },
  18: { cle: "VOLCANO", fr: "Volcan" },
  19: { cle: "GRAVEYARD", fr: "Cimetière" },
  20: { cle: "DOJO", fr: "Dojo" },
  21: { cle: "FACTORY", fr: "Usine" },
  22: { cle: "RUINS", fr: "Ruines" },
  23: { cle: "WASTELAND", fr: "Terres Désolées" },
  24: { cle: "ABYSS", fr: "Gouffre" },
  25: { cle: "SPACE", fr: "Espace" },
  26: { cle: "CONSTRUCTION_SITE", fr: "Chantier" },
  27: { cle: "JUNGLE", fr: "Jungle" },
  28: { cle: "FAIRY_CAVE", fr: "Grotte Féérique" },
  29: { cle: "TEMPLE", fr: "Temple" },
  30: { cle: "SLUM", fr: "Bidonville" },
  31: { cle: "SNOWY_FOREST", fr: "Forêt Enneigée" },
  40: { cle: "ISLAND", fr: "Ile" },
  41: { cle: "LABORATORY", fr: "Laboratoire" },
  50: { cle: "END", fr: "???" },
};

export const MoveCategory: Readonly<Record<number, Nom>> = {
  0: { cle: "PHYSICAL", fr: "Physique" },
  1: { cle: "SPECIAL", fr: "Spéciale" },
  2: { cle: "STATUS", fr: "Statut" },
};

export const Nature: Readonly<Record<number, Nom>> = {
  0: { cle: "HARDY", fr: "Hardi" },
  1: { cle: "LONELY", fr: "Solo" },
  2: { cle: "BRAVE", fr: "Brave" },
  3: { cle: "ADAMANT", fr: "Rigide" },
  4: { cle: "NAUGHTY", fr: "Mauvais" },
  5: { cle: "BOLD", fr: "Assuré" },
  6: { cle: "DOCILE", fr: "Docile" },
  7: { cle: "RELAXED", fr: "Relax" },
  8: { cle: "IMPISH", fr: "Malin" },
  9: { cle: "LAX", fr: "Lâche" },
  10: { cle: "TIMID", fr: "Timide" },
  11: { cle: "HASTY", fr: "Pressé" },
  12: { cle: "SERIOUS", fr: "Sérieux" },
  13: { cle: "JOLLY", fr: "Jovial" },
  14: { cle: "NAIVE", fr: "Naïf" },
  15: { cle: "MODEST", fr: "Modeste" },
  16: { cle: "MILD", fr: "Doux" },
  17: { cle: "QUIET", fr: "Discret" },
  18: { cle: "BASHFUL", fr: "Pudique" },
  19: { cle: "RASH", fr: "Foufou" },
  20: { cle: "CALM", fr: "Calme" },
  21: { cle: "GENTLE", fr: "Gentil" },
  22: { cle: "SASSY", fr: "Malpoli" },
  23: { cle: "CAREFUL", fr: "Prudent" },
  24: { cle: "QUIRKY", fr: "Bizarre" },
};

export const PokeballType: Readonly<Record<number, Nom>> = {
  0: { cle: "POKEBALL", fr: "Poké Ball" },
  1: { cle: "GREAT_BALL", fr: "Super Ball" },
  2: { cle: "ULTRA_BALL", fr: "Hyper Ball" },
  3: { cle: "ROGUE_BALL", fr: "Rogue Ball" },
  4: { cle: "MASTER_BALL", fr: "Master Ball" },
  5: { cle: "LUXURY_BALL", fr: "Luxe Ball" },
};

export const PokemonType: Readonly<Record<number, Nom>> = {
  "-1": { cle: "UNKNOWN", fr: "???" },
  0: { cle: "NORMAL", fr: "Normal" },
  1: { cle: "FIGHTING", fr: "Combat" },
  2: { cle: "FLYING", fr: "Vol" },
  3: { cle: "POISON", fr: "Poison" },
  4: { cle: "GROUND", fr: "Sol" },
  5: { cle: "ROCK", fr: "Roche" },
  6: { cle: "BUG", fr: "Insecte" },
  7: { cle: "GHOST", fr: "Spectre" },
  8: { cle: "STEEL", fr: "Acier" },
  9: { cle: "FIRE", fr: "Feu" },
  10: { cle: "WATER", fr: "Eau" },
  11: { cle: "GRASS", fr: "Plante" },
  12: { cle: "ELECTRIC", fr: "Électrik" },
  13: { cle: "PSYCHIC", fr: "Psy" },
  14: { cle: "ICE", fr: "Glace" },
  15: { cle: "DRAGON", fr: "Dragon" },
  16: { cle: "DARK", fr: "Ténèbres" },
  17: { cle: "FAIRY", fr: "Fée" },
  18: { cle: "STELLAR", fr: "Stellaire" },
};

export const StatusEffect: Readonly<Record<number, Nom>> = {
  0: { cle: "NONE", fr: "Aucun" },
  1: { cle: "POISON", fr: "Empoisonnement" },
  2: { cle: "TOXIC", fr: "Empoisonnement grave" },
  3: { cle: "PARALYSIS", fr: "Paralysie" },
  4: { cle: "SLEEP", fr: "Sommeil" },
  5: { cle: "FREEZE", fr: "Gelé" },
  6: { cle: "BURN", fr: "Brulure" },
  7: { cle: "FAINT", fr: "K.O." },
};

export const TerrainType: Readonly<Record<number, Nom>> = {
  0: { cle: "NONE", fr: "Aucun" },
  1: { cle: "MISTY", fr: "Brumeux" },
  2: { cle: "ELECTRIC", fr: "Électrifié" },
  3: { cle: "GRASSY", fr: "Herbu" },
  4: { cle: "PSYCHIC", fr: "Psychique" },
};

export const WeatherType: Readonly<Record<number, Nom>> = {
  0: { cle: "NONE", fr: "Aucune" },
  1: { cle: "SUNNY", fr: "Soleil" },
  2: { cle: "RAIN", fr: "Pluie" },
  3: { cle: "SANDSTORM", fr: "Tempête de sable" },
  4: { cle: "HAIL", fr: "Grêle" },
  5: { cle: "SNOW", fr: "Neige" },
  6: { cle: "FOG", fr: "Brouillard" },
  7: { cle: "HEAVY_RAIN", fr: "Pluie battante" },
  8: { cle: "HARSH_SUN", fr: "Soleil intense" },
  9: { cle: "STRONG_WINDS", fr: "Vent mystérieux" },
};
