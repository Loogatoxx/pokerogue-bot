/**
 * Outils communs pour faire jouer une partie Classique au vrai jeu, sans écran.
 * Tirés du banc de vitesse (voir docs/etape-0-vitesse.md pour le pourquoi de chaque piège).
 */
import { BattleScene } from "#app/battle-scene";
import { Battle } from "#app/battle";
import { Phase } from "#app/phase";
import { Arena } from "#field/arena";
import { Pokemon } from "#field/pokemon";
import { Trainer } from "#field/trainer";
import { Modifier } from "#modifiers/modifier";
import { MockContainer } from "#test/mocks/mocks-container/mock-container";
import { MockSprite } from "#test/mocks/mocks-container/mock-sprite";
import { MockText } from "#test/mocks/mocks-container/mock-text";
import { Session } from "node:inspector/promises";
import Phaser from "phaser";
import { getGameMode } from "#app/game-mode";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { GameModes } from "#enums/game-modes";
import type { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import { SelectStarterPhase } from "#phases/select-starter-phase";
import type { GameManager } from "#test/framework/game-manager";
import { generateStarters } from "#test/utils/game-manager-utils";
import type { SessionSaveData, StarterMoveset } from "#types/save-data";
import { vi } from "vitest";

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
    // L'outil de test tire nature, talent et chromatique des starters avec un hasard sans graine :
    // la même graine donnait des parties différentes (une même partie finissait aux vagues 15, 25,
    // 66 ou 90). Ils dépendent maintenant de la graine : rejouer une graine rejoue la même partie.
    starters.forEach((starter, i) => {
      starter.nature = hacher(`${graine}-${i}`) % 25;
      starter.abilityIndex = 0;
      starter.shiny = false;
      starter.variant = 0;
    });
    scene.setSeed(graine);
    scene.resetSeed();
    const selection = new SelectStarterPhase();
    scene.phaseManager.pushNew("EncounterPhase", false);
    selection.initBattle(starters);
  });
  await game.phaseInterceptor.to("EncounterPhase");
}

/** Un entier tiré d'un texte (FNV-1a), toujours le même pour le même texte. */
function hacher(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

// ─── Photos de partie : s'entraîner sur les combats qui bloquent ──────────────────────────────

/** Le texte d'une sauvegarde, comme le jeu l'écrit (les grands entiers en texte). */
const enTexte = (session: SessionSaveData) =>
  JSON.stringify(session, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v));

/**
 * La photo du début de la vague en cours : le jeu sauvegarde la partie juste avant chaque
 * rencontre (EncounterPhase), et l'outil de test garde cette sauvegarde (ReloadHelper). Équipe,
 * objets, argent, Balls, arène, dresseur adverse : tout ce qu'il faut pour rejouer cette vague.
 */
export function photoDeLaVague(game: GameManager): { vague: number; texte: string } | null {
  const session = (game.reload as unknown as { sessionData?: SessionSaveData }).sessionData;
  return session ? { vague: session.waveIndex, texte: enTexte(session) } : null;
}

/**
 * Reprend une partie depuis une photo, exactement comme le bouton « Continuer » de l'écran titre
 * (TitlePhase.loadSaveSlot → gameData.loadSession). La partie repart au début de cette vague,
 * avec l'équipe, les objets et l'adversaire qu'elle avait.
 */
export async function reprendrePartie(game: GameManager, texte: string, graine: string): Promise<void> {
  await game.runToTitle();
  const session = game.scene.gameData.parseSessionData(texte);
  vi.spyOn(game.scene.gameData, "getSession").mockResolvedValue(session);
  // Comme l'outil de test (ReloadHelper) : des objets de la partie précédente peuvent rester.
  game.scene.modifiers = [];
  game.onNextPrompt("TitlePhase", UiMode.TITLE, () => {
    const titre = game.scene.phaseManager.getCurrentPhase() as unknown as { loadSaveSlot(place: number): Promise<void> };
    void titre.loadSaveSlot(0);
  });
  await game.phaseInterceptor.to("EncounterPhase");
  // Graine neuve : le combat photographié ne change pas (l'adversaire est dans la sauvegarde), mais
  // les vagues suivantes ne sont plus toujours les mêmes d'une reprise à l'autre.
  game.scene.setSeed(graine);
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

// ─── Diagnostic de mémoire : combien d'objets de chaque classe sont encore en vie ? ──────────────

let session: Session | null = null;

/** Les classes suivies : une qui grimpe de partie en partie sans redescendre est une fuite. */
const CLASSES_SUIVIES: Record<string, { prototype: object }> = {
  Pokemon, Battle, Trainer, Arena, Phase, Modifier, MockSprite, MockContainer, MockText,
  "Phaser.Sprite": Phaser.GameObjects.Sprite,
  "Phaser.Container": Phaser.GameObjects.Container,
  "Phaser.GameObject": Phaser.GameObjects.GameObject,
  "Phaser.Tween": Phaser.Tweens.Tween,
  "Phaser.TimerEvent": Phaser.Time.TimerEvent,
  "Phaser.Animation": Phaser.Animations.Animation,
};

/**
 * Compte les objets vivants de chaque classe suivie, avec l'inspecteur de Node (la même
 * fonction que « Memory » dans les outils de développement du navigateur ; elle fait passer le
 * ramasse-miettes avant de compter). Lent : seulement pour le diagnostic (PONT_COMPTAGE=1).
 */
export async function compterInstances(): Promise<Record<string, number>> {
  if (!session) {
    session = new Session();
    session.connect();
  }
  const comptes: Record<string, number> = {};
  const global = globalThis as { __aCompter?: object };
  for (const [nom, classe] of Object.entries(CLASSES_SUIVIES)) {
    global.__aCompter = classe.prototype;
    const { result } = await session.post("Runtime.evaluate", { expression: "globalThis.__aCompter" });
    const { objects } = await session.post("Runtime.queryObjects", { prototypeObjectId: result.objectId! });
    const { result: nombre } = await session.post("Runtime.callFunctionOn", {
      objectId: objects.objectId!,
      functionDeclaration: "function () { return this.length; }",
      returnByValue: true,
    });
    comptes[nom] = nombre.value as number;
    await session.post("Runtime.releaseObject", { objectId: objects.objectId! });
    await session.post("Runtime.releaseObject", { objectId: result.objectId! });
  }
  delete global.__aCompter;
  return comptes;
}

/**
 * Les collections (tableaux, listes de conteneurs, Map, Set) accessibles depuis la scène sur deux
 * niveaux, avec leur taille : celle qui grandit à chaque partie retient les objets qui fuient.
 */
export function taillesCollections(racine: object): Record<string, number> {
  const tailles: Record<string, number> = {};
  const taille = (v: unknown): number | null =>
    Array.isArray(v) ? v.length
    : v instanceof Map || v instanceof Set ? v.size
    : v && typeof v === "object" && Array.isArray((v as { list?: unknown }).list) ? (v as { list: unknown[] }).list.length
    : null;
  const vus = new Set<object>();
  const parcourir = (objet: object, chemin: string, profondeur: number) => {
    if (vus.has(objet) || profondeur > 2) {
      return;
    }
    vus.add(objet);
    for (const cle of Object.keys(objet)) {
      let v: unknown;
      try {
        v = (objet as Record<string, unknown>)[cle];
      } catch {
        continue;
      }
      const n = taille(v);
      if (n !== null && n >= 20) {
        tailles[`${chemin}.${cle}`] = n;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        parcourir(v, `${chemin}.${cle}`, profondeur + 1);
      }
    }
  };
  parcourir(racine, "scene", 0);
  return tailles;
}
