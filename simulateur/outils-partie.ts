/**
 * Outils communs pour faire jouer une partie Classique au vrai jeu, sans écran.
 * Tirés du banc de vitesse (voir docs/etape-0-vitesse.md pour le pourquoi de chaque piège).
 */
import { BattleScene } from "#app/battle-scene";
import { getGameMode } from "#app/game-mode";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { GameModes } from "#enums/game-modes";
import type { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import { SelectStarterPhase } from "#phases/select-starter-phase";
import type { GameManager } from "#test/framework/game-manager";
import { generateStarters } from "#test/utils/game-manager-utils";
import type { StarterMoveset } from "#types/save-data";

/**
 * L'outil de test remplace le hasard par « toujours le jet maximum » : on garde la vraie
 * fonction pour la remettre après chaque `new GameManager()`.
 */
export const vraiHasard = BattleScene.prototype.randBattleSeedInt;

/**
 * Lance une partie Classique comme depuis le vrai écran de sélection.
 * L'outil de test fige la graine à "test" et donne des starters sans attaque : on remet une
 * graine par partie, les attaques par défaut du vrai jeu (niveaux 1 à 5, quatre au maximum),
 * et, si demandé, les IVs d'un compte neuf (15 partout).
 */
export async function demarrerPartie(
  game: GameManager,
  especes: SpeciesId[],
  graine: string,
  ivs?: number[],
): Promise<void> {
  await game.runToTitle();
  game.onNextPrompt("TitlePhase", UiMode.TITLE, () => {
    const scene = game.scene;
    scene.gameMode = getGameMode(GameModes.CLASSIC);
    const starters = generateStarters(scene, especes);
    for (const starter of starters) {
      starter.moveset = speciesDataRegistry
        .getSpecies(starter.speciesId)
        .getLevelMoves()
        .filter(([niveau]) => niveau > 0 && niveau <= 5)
        .map(([, attaque]) => attaque)
        .slice(0, 4) as StarterMoveset;
      if (ivs) {
        starter.ivs = [...ivs];
      }
    }
    scene.setSeed(graine);
    scene.resetSeed();
    const selection = new SelectStarterPhase();
    scene.phaseManager.pushNew("EncounterPhase", false);
    selection.initBattle(starters);
  });
  await game.phaseInterceptor.to("EncounterPhase");
}

/**
 * Vrai si une minuterie du jeu (« fais ça dans X ms ») attend encore de se déclencher.
 * Sans écran, l'horloge du jeu n'avance que toutes les millisecondes : enchaîner la phase
 * suivante avant ce battement crée des courses (ex. un ennemi K.O. encore « sur le terrain »).
 */
export function minuteriesEnAttente(game: GameManager): boolean {
  const horloge = game.scene.time as unknown as {
    _active?: { loop: boolean; repeatCount: number; hasDispatched: boolean; paused: boolean }[];
    _pendingInsertion?: { loop: boolean; repeatCount: number; hasDispatched: boolean; paused: boolean }[];
  };
  const evenements = [...(horloge._active ?? []), ...(horloge._pendingInsertion ?? [])];
  return evenements.some(e => !e.loop && e.repeatCount <= 0 && !e.hasDispatched && !e.paused);
}
