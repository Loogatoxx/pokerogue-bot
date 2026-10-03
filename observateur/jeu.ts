/**
 * Ce que l'observateur lit dans le jeu, décrit à la main.
 *
 * Ce ne sont pas les vraies classes de PokeRogue, seulement la petite partie qu'on utilise.
 * Pourquoi : l'extension lit le jeu en ligne sans accès à son code source, et ce contrat
 * explicite montre d'un coup d'œil de quoi on dépend. Si une mise à jour du jeu renomme
 * une de ces propriétés, c'est ici qu'il faudra corriger (le test du simulateur le signalera).
 */

export interface MoveJeu {
  id: number;
  name: string;
  type: number;
  category: number;
  power: number;
  accuracy: number;
  /** Ce que vise l'attaque (valeur MoveTarget du jeu : lanceur, un ennemi, tous…). */
  moveTarget: number;
}

export interface AttaqueJeu {
  moveId: number;
  ppUsed: number;
  getMovePp(): number;
  getMove(): MoveJeu;
  /** [utilisable, raison] ; forSelection = vérifier aussi Entrave, Provoc… comme l'écran du jeu. */
  isUsable(pokemon: PokemonJeu, ignorePp?: boolean, forSelection?: boolean): [boolean, string];
}

export interface PokemonJeu {
  id: number;
  name: string;
  level: number;
  hp: number;
  shiny: boolean;
  nature: number;
  ivs: number[];
  species: { speciesId: number };
  status?: { effect: number } | null;
  summonData?: {
    illusion?: { species: number; name: string; shiny: boolean } | null;
    moveHistory?: { move: number }[];
  };
  waveData?: { abilityRevealed?: boolean };
  bossSegments?: number;
  bossSegmentIndex?: number;
  getMaxHp(): number;
  getHpRatio(precise?: boolean): number;
  isOnField(): boolean;
  /** En jeu et capable d'agir (sur le terrain si onField). */
  isActive(onField?: boolean): boolean;
  isFainted(): boolean;
  isBoss(): boolean;
  getTypes(options?: { useIllusion?: boolean }): number[];
  getAbility(): { id: number; name: string };
  hasPassive(): boolean;
  getPassiveAbility(): { id: number; name: string };
  getStat(stat: number, bypassSummonData?: boolean): number;
  getStatStage(stat: number): number;
  getMoveset(): AttaqueJeu[];
  getHeldItems(): { type: { name: string }; getStackCount(): number }[];
  getNameToRender(options?: { useIllusion?: boolean }): string;
  /** Place sur le terrain de son camp (0 ou 1). */
  getFieldIndex(): number;
  /** Forme de l'espèce ; avec useIllusion, celle du déguisement. */
  getSpeciesForm(ignoreOverride?: boolean, useIllusion?: boolean): { baseStats: readonly number[] };
}

export interface PhaseJeu {
  phaseName: string;
  getPokemon?(): PokemonJeu | undefined;
  /** CommandPhase : place du Pokémon qui choisit son action. */
  getFieldIndex?(): number;
  /** SwitchPhase : place du terrain à remplir (propriété protégée du jeu, lue telle quelle). */
  fieldIndex?: number;
  /** CommandPhase : applique une commande (attaque, changement…) ; faux si refusée. */
  handleCommand?(commande: number, curseur: number, option?: boolean | number): boolean;
  start(): void;
  end(): void;
}

export interface ScenePokerogue {
  currentBattle?: {
    waveIndex: number;
    turn: number;
    battleType: number;
    double: boolean;
    trainer?: {
      getName(slot?: number, avecTitre?: boolean): string;
      /** Spécialité d'un champion d'arène, du Conseil 4… (connaissance publique : un champion = un type). */
      config?: { specialtyType?: number; hasSpecialtyType?(): boolean };
    } | null;
  } | null;
  arena?: {
    biomeId: number;
    weather?: { weatherType: number } | null;
    terrain?: { terrainType: number } | null;
  } | null;
  money: number;
  pokeballCounts: Record<number, number>;
  gameMode: { isDaily: boolean };
  /** Pokédex du joueur : caughtAttr non nul = espèce déjà capturée. */
  gameData: { dexData: Record<number, { caughtAttr: bigint } | undefined> };
  /** Objets possédés par le joueur (Charmes Exp, objets tenus…). */
  modifiers?: { type?: { id?: string }; stackCount?: number; getArgs?: () => unknown[] }[];
  getPlayerParty(): PokemonJeu[];
  getPlayerField(): PokemonJeu[];
  getEnemyParty(): PokemonJeu[];
  getEnemyField(): PokemonJeu[];
  phaseManager: { getCurrentPhase(): PhaseJeu | null | undefined };
  // L'interface du jeu est très variable d'un écran à l'autre : on la lit prudemment.
  ui: { getHandler(): unknown; getMode(): number };
}
