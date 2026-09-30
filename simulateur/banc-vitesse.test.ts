/**
 * Banc de vitesse du simulateur (étape 0).
 *
 * Fait jouer des parties Classiques complètes à PokeRogue, sans écran et avec le vrai hasard
 * du jeu, puis mesure combien de décisions et de vagues on enchaîne par seconde.
 * C'est le feu vert (ou rouge) de tout le projet : le renforcement a besoin de milliers de parties.
 *
 * Trois joueurs automatiques servent de mesure :
 * - « hasard »   : choisit une attaque au hasard (c'est le futur cerveau v0) ;
 * - « glouton »  : choisit l'attaque la plus forte contre l'ennemi (un bot à règles simples) ;
 * - « marathon » : le glouton avec une équipe surpuissante, pour vérifier que le simulateur
 *                  tient les 200 vagues (dresseurs, combats doubles, biomes, boss final).
 *
 * Lancement : ./simulateur/lancer-banc.sh (voir ce script pour les réglages).
 */
import { BattleScene } from "#app/battle-scene";
import { getGameMode } from "#app/game-mode";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { BattleStyle } from "#enums/battle-style";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { GameModes } from "#enums/game-modes";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";
import { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { SelectStarterPhase } from "#phases/select-starter-phase";
import { GameManager } from "#test/framework/game-manager";
import { generateStarters } from "#test/utils/game-manager-utils";
import type { StarterMoveset } from "#types/save-data";
import fs from "node:fs";
import Phaser from "phaser";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

// L'outil de test remplace le hasard par « toujours le jet maximum ».
// On garde la vraie fonction pour la remettre : un cerveau entraîné sans hasard
// apprendrait un jeu qui n'existe pas.
const vraiHasard = BattleScene.prototype.randBattleSeedInt;

const PARTIES_PAR_POLITIQUE = Number(process.env.BANC_PARTIES ?? 8);
const MARATHONS = Number(process.env.BANC_MARATHONS ?? 2);
const FICHIER_RESULTATS = process.env.BANC_SORTIE ?? "banc-vitesse.json";
/** Niveau 300 : au niveau 100, sans objets, l'équipe tombe vers la vague 110 face aux légendaires. */
const NIVEAU_MARATHON = Number(process.env.BANC_NIVEAU_MARATHON ?? 300);

type Politique = "hasard" | "glouton" | "marathon";

interface Partie {
  politique: Politique;
  graine: string;
  vagueAtteinte: number;
  decisions: number;
  phases: number;
  ms: number;
  erreur?: string;
  /** Les derniers événements, pour comprendre un blocage. */
  trace: string[];
}

const parties: Partie[] = [];

/**
 * Choisit l'attaque à jouer et l'ennemi visé.
 * Renvoie l'index -1 (Lutte) si plus aucune attaque n'est utilisable.
 */
function choisirAttaque(
  game: GameManager,
  phase: CommandPhase,
  politique: Politique,
): { index: number; cible: BattlerIndex | undefined } {
  const pokemon = phase.getPokemon();
  const ennemis = game.scene.getEnemyField().filter(p => p.isOnField() && !p.isFainted());
  const jouables = pokemon
    .getMoveset()
    .map((attaque, index) => ({ attaque, index }))
    .filter(({ attaque }) => attaque.isUsable(pokemon, false, true)[0]);

  if (jouables.length === 0 || ennemis.length === 0) {
    return { index: -1, cible: undefined };
  }
  if (politique === "hasard") {
    const ennemi = ennemis[Math.floor(Math.random() * ennemis.length)];
    return { index: jouables[Math.floor(Math.random() * jouables.length)].index, cible: ennemi.getBattlerIndex() };
  }

  // Glouton : le couple (attaque, cible) qui maximise puissance × efficacité.
  // On utilise le calcul complet du jeu, talents compris (Lévitation contre Séisme…).
  // NB : c'est une info cachée qu'un humain ne connaît pas toujours ; le futur cerveau,
  // lui, ne verra que les talents déjà révélés. Ici on mesure seulement la vitesse.
  let meilleur = { index: jouables[0].index, cible: ennemis[0].getBattlerIndex() };
  let meilleurScore = -1;
  for (const { attaque, index } of jouables) {
    const move = attaque.getMove();
    for (const ennemi of ennemis) {
      const score = Math.max(move.power, 0) * ennemi.getMoveEffectiveness(pokemon, move);
      if (score > meilleurScore) {
        meilleurScore = score;
        meilleur = { index, cible: ennemi.getBattlerIndex() };
      }
    }
  }
  return meilleur;
}

function noter(trace: string[], evenement: string): void {
  trace.push(evenement);
  if (trace.length > 400) {
    trace.shift();
  }
}

interface Compteur {
  decisions: number;
  /** Tentatives pour donner le bonus choisi à un Pokémon. */
  essaisCible: number;
  /** Récompenses déjà essayées dans la vague en cours (une CT refusée revient sinon à l'infini). */
  recompensesEssayees: Set<number>;
  vagueRecompenses: number;
  /** Ennemi visé par la dernière attaque choisie (utile en combat double). */
  cible?: BattlerIndex | undefined;
  /** Anomalie repérée par le répondeur, que la boucle principale transforme en échec. */
  erreur?: string;
}

/**
 * Répond à tout ce qui attend une action du joueur, d'après le mode d'interface affiché.
 * C'est le prototype du futur « pilote » : le cerveau décidera à la place des règles ci-dessous.
 */
function repondre(game: GameManager, politique: Politique, compteur: Compteur, trace: string[]): void {
  const scene = game.scene;
  const phase = scene.phaseManager.getCurrentPhase();
  const handler = scene.ui.getHandler() as any;
  if (!phase || !handler?.active) {
    return;
  }

  switch (scene.ui.getMode()) {
    case UiMode.COMMAND: {
      if (!phase.is("CommandPhase")) {
        return;
      }
      const commande = phase as CommandPhase;
      if (!scene.getEnemyField().some(p => p.isOnField() && !p.isFainted())) {
        // Une erreur lancée ici se perdrait dans le minuteur : on la confie à la boucle principale.
        compteur.erreur = "tour de combat sans aucun ennemi debout sur le terrain";
        return;
      }
      const { index, cible } = choisirAttaque(game, commande, politique);
      compteur.cible = cible;
      const reussi = commande.handleCommand(Command.FIGHT, index, MoveUseMode.NORMAL);
      compteur.decisions++;
      const pokemon = commande.getPokemon();
      noter(trace, `attaque ${index} ${reussi ? "ok" : "refusée"} — ${pokemon.name} ${pokemon.hp}/${pokemon.getMaxHp()} PV`);
      return;
    }
    case UiMode.PARTY: {
      const equipe = scene.getPlayerParty();
      if (phase.is("SelectModifierPhase")) {
        // Un bonus à donner à un Pokémon : le plus blessé encore debout.
        // Si le jeu refuse trois fois (ex. Champignon Mémoire sans attaque à réapprendre),
        // on recule d'un écran à chaque passage jusqu'à revenir à la boutique,
        // qui essaiera alors la récompense suivante.
        if (++compteur.essaisCible > 3) {
          noter(trace, "bonus inutilisable, retour arrière");
          handler.processInput(Button.CANCEL);
          return;
        }
        const vivants = equipe.map((p, i) => ({ p, i })).filter(({ p }) => !p.isFainted());
        vivants.sort((a, b) => a.p.getHpRatio() - b.p.getHpRatio());
        noter(trace, `donne le bonus à la place ${vivants[0]?.i}`);
        handler.setCursor(vivants[0]?.i ?? 0);
        handler.processInput(Button.ACTION);
        handler.processInput(Button.ACTION);
        return;
      }
      // Remplacer un Pokémon K.O. par le premier encore debout sur le banc.
      const place = equipe.findIndex(p => !p.isFainted() && !p.isOnField());
      if (handler.awaitingActionInput) {
        handler.processInput(Button.ACTION); // fermer un message affiché par-dessus l'équipe
        return;
      }
      compteur.decisions++;
      noter(trace, `envoie la place ${place}`);
      handler.setCursor(Math.max(place, 0));
      handler.processInput(Button.ACTION);
      handler.processInput(Button.ACTION);
      return;
    }
    case UiMode.MODIFIER_SELECT: {
      if (!handler.awaitingActionInput) {
        return;
      }
      compteur.decisions++;
      const vague = scene.currentBattle?.waveIndex ?? 0;
      if (vague !== compteur.vagueRecompenses) {
        compteur.vagueRecompenses = vague;
        compteur.recompensesEssayees.clear();
      }
      // Rangée 1 = les récompenses gratuites. Glouton : la première pas encore essayée ;
      // hasard : n'importe laquelle pas encore essayée. Si tout a échoué, on passe.
      const nombre = Math.max(handler.options?.length ?? 1, 1);
      const restantes = Array.from({ length: nombre }, (_, i) => i).filter(i => !compteur.recompensesEssayees.has(i));
      if (restantes.length === 0) {
        noter(trace, "passe les bonus (tout essayé)");
        handler.processInput(Button.CANCEL);
        return;
      }
      const choix =
        politique === "hasard" ? restantes[Math.floor(Math.random() * restantes.length)] : restantes[0];
      compteur.recompensesEssayees.add(choix);
      compteur.essaisCible = 0;
      noter(trace, `prend la récompense ${choix} (${handler.options?.[choix]?.modifierTypeOption?.type?.name ?? "?"})`);
      handler.setRowCursor(1);
      handler.setCursor(choix);
      handler.processInput(Button.ACTION);
      return;
    }
    case UiMode.TARGET_SELECT:
      // Combat double : viser l'ennemi choisi avec l'attaque.
      handler.setCursor(compteur.cible ?? BattlerIndex.ENEMY);
      handler.processInput(Button.ACTION);
      return;
    case UiMode.OPTION_SELECT: {
      // Menus à options, par exemple le choix du prochain biome.
      const nombre = Math.max(handler.config?.options?.length ?? 1, 1);
      const choix = politique === "hasard" ? Math.floor(Math.random() * nombre) : 0;
      compteur.decisions++;
      noter(trace, `option ${choix}/${nombre} (${handler.config?.options?.[choix]?.label ?? "?"})`);
      handler.setCursor(choix);
      handler.processInput(Button.ACTION);
      return;
    }
    case UiMode.SUMMARY:
      // Écran « quelle attaque oublier ? » : on renonce à la nouvelle attaque.
      handler.processInput(Button.CANCEL);
      return;
    default:
      if (handler.awaitingActionInput || scene.ui.getMode() === UiMode.CONFIRM) {
        handler.processInput(Button.ACTION);
      }
  }
}

/**
 * Lance une partie Classique comme depuis le vrai écran de sélection.
 * L'outil de test fige la graine du hasard à "test" et donne des starters sans attaque :
 * on remet une graine unique par partie et les attaques par défaut du vrai jeu
 * (celles apprises entre les niveaux 1 et 5, quatre au maximum).
 */
async function demarrerPartie(game: GameManager, especes: SpeciesId[], graine: string): Promise<void> {
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
 * On ignore les minuteries qui se répètent à l'infini (clignotements d'interface).
 */
function minuteriesEnAttente(game: GameManager): boolean {
  const horloge = game.scene.time as any;
  const evenements = [...(horloge._active ?? []), ...(horloge._pendingInsertion ?? [])];
  return evenements.some(e => !e.loop && e.repeatCount <= 0 && !e.hasDispatched && !e.paused);
}

async function jouerPartie(game: GameManager, politique: Politique): Promise<Partie> {
  const scene = game.scene;
  const intercepteur = game.phaseInterceptor as any;
  const compteur: Compteur = { decisions: 0, essaisCible: 0, recompensesEssayees: new Set(), vagueRecompenses: -1 };
  const graine = Math.random().toString(36).slice(2, 12);
  const partie: Partie = { politique, graine, vagueAtteinte: 0, decisions: 0, phases: 0, ms: 0, trace: [] };
  const debut = performance.now();

  const minuteur = setInterval(() => repondre(game, politique, compteur, partie.trace), 0);
  try {
    await demarrerPartie(game, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE], graine);

    let vagueSuivie = -1;
    let phasesDansLaVague = 0;
    // Boucle principale : on démarre chaque phase et on attend qu'elle se termine.
    // Le répondeur ci-dessus débloque celles qui attendent une action du joueur.
    for (;;) {
      await vi.waitUntil(() => intercepteur.state === "idling" || compteur.erreur, { interval: 0, timeout: 20_000 });
      if (compteur.erreur) {
        throw new Error(compteur.erreur);
      }
      if (minuteriesEnAttente(game)) {
        await vi.waitUntil(() => !minuteriesEnAttente(game), { interval: 0, timeout: 20_000 });
      }
      const phase = scene.phaseManager.getCurrentPhase();
      partie.vagueAtteinte = Math.max(partie.vagueAtteinte, scene.currentBattle?.waveIndex ?? 0);
      if (phase.is("GameOverPhase")) {
        break;
      }
      if (phase.is("SelectModifierPhase")) {
        compteur.essaisCible = 0;
        if (politique === "marathon") {
          // Triche assumée : le marathon teste le simulateur, pas le niveau de jeu.
          for (const pokemon of scene.getPlayerParty()) {
            pokemon.hp = pokemon.getMaxHp();
            pokemon.resetStatus();
            pokemon.getMoveset().forEach(attaque => (attaque.ppUsed = 0));
          }
        }
      }
      if (phase.is("ScanIvsPhase")) {
        // L'écran du Scanner d'IV plante sans graphismes (sprites simulés sans nom).
        // L'information reste lisible directement : on saute seulement l'affichage.
        partie.phases++;
        intercepteur.state = "running";
        phase.end();
        continue;
      }
      partie.phases++;
      noter(partie.trace, `vague ${scene.currentBattle?.waveIndex} · ${phase.phaseName}`);

      // Garde-fou : une vague normale prend quelques centaines de phases.
      const vague = scene.currentBattle?.waveIndex ?? 0;
      if (vague !== vagueSuivie) {
        vagueSuivie = vague;
        phasesDansLaVague = 0;
      }
      if (++phasesDansLaVague > 5000) {
        throw new Error(`boucle : plus de 5000 phases dans la vague ${vague}`);
      }
      if (partie.phases % 2000 === 0) {
        fs.writeFileSync(
          `${FICHIER_RESULTATS}.progression`,
          JSON.stringify({ ...partie, secondes: (performance.now() - debut) / 1000, trace: partie.trace.slice(-60) }, null, 2),
        );
      }
      intercepteur.state = "running";
      phase.start();
    }
  } catch (e) {
    const phase = scene.phaseManager.getCurrentPhase()?.phaseName;
    partie.erreur = `${phase} / ${UiMode[scene.ui.getMode()]} : ${(e as Error).message.split("\n")[0]}`;
  } finally {
    clearInterval(minuteur);
  }

  noter(
    partie.trace,
    `fin — équipe : ${scene
      .getPlayerParty()
      .map(p => `${p.name} niv.${p.level} ${p.hp}/${p.getMaxHp()} exp ${p.exp}`)
      .join(" ; ")}`,
  );
  partie.decisions = compteur.decisions;
  partie.ms = performance.now() - debut;
  return partie;
}

describe("Banc de vitesse du simulateur", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  afterAll(() => {
    fs.writeFileSync(FICHIER_RESULTATS, JSON.stringify(parties, null, 2));
  });

  const cas = (["hasard", "glouton", "marathon"] as const).flatMap(politique =>
    Array.from({ length: politique === "marathon" ? MARATHONS : PARTIES_PAR_POLITIQUE }, (_, n) => ({ politique, n })),
  );

  it.each(cas)(
    "partie $n — $politique",
    async ({ politique }) => {
      const game = new GameManager(phaserGame);
      BattleScene.prototype.randBattleSeedInt = vraiHasard;

      // Partie réaliste : vrais IVs, natures, shinys et objets tenus par l'ennemi.
      game.override.normalizeIVs = false;
      game.override.normalizeNatures = false;
      game.override.disableShinies = false;
      game.override.removeEnemyStartingItems = false;
      // Combats simples ET doubles, comme dans le vrai jeu : forcer le simple bloque les duos
      // de dresseurs. Limite assumée pour cette mesure : pas de rencontres mystère
      // (déjà coupées par défaut dans l'outil de test).
      game.settings.battleStyle(BattleStyle.SET);
      if (politique === "marathon") {
        game.override
          .startingLevel(NIVEAU_MARATHON)
          .moveset([MoveId.EARTHQUAKE, MoveId.SURF, MoveId.FLAMETHROWER, MoveId.ICE_BEAM]);
      }

      parties.push(await jouerPartie(game, politique));
    },
    30 * 60_000,
  );
});
