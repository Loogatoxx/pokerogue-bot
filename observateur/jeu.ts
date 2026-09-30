/**
 * Ce que l'observateur lit dans le jeu, décrit à la main.
 *
 * Ce ne sont pas les vraies classes de PokeRogue, seulement la petite partie qu'on utilise.
 * Pourquoi : l'extension lit le jeu en ligne sans accès à son code source, et ce contrat
 * explicite montre d'un coup d'œil de quoi on dépend. Si une mise à jour du jeu renomme
 * une de ces propriétés, c'est ici qu'il faudra corriger (le test du simulateur le signalera).
 */

export interface AttaqueJeu {
  moveId: number;
  ppUsed: number;
  getMovePp(): number;
  getMove(): { id: number; name: string; type: number; category: number; power: number; accuracy: number };
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
}

export interface PhaseJeu {
  phaseName: string;
  getPokemon?(): PokemonJeu | undefined;
}

export interface ScenePokerogue {
  currentBattle?: {
    waveIndex: number;
    turn: number;
    battleType: number;
    double: boolean;
    trainer?: { getName(slot?: number, avecTitre?: boolean): string } | null;
  } | null;
  arena?: {
    biomeId: number;
    weather?: { weatherType: number } | null;
    terrain?: { terrainType: number } | null;
  } | null;
  money: number;
  pokeballCounts: Record<number, number>;
  getPlayerParty(): PokemonJeu[];
  getEnemyParty(): PokemonJeu[];
  getEnemyField(): PokemonJeu[];
  phaseManager: { getCurrentPhase(): PhaseJeu | null | undefined };
  // L'interface du jeu est très variable d'un écran à l'autre : on la lit prudemment.
  ui: { getHandler(): unknown };
}
