/**
 * Environnement d'entraînement : fait jouer le vrai jeu, sans écran, pour le cerveau Python.
 *
 * Lancé par entraineur/pont.py (un processus par partie jouée en parallèle), il se connecte en
 * TCP au Python puis enchaîne les parties qu'on lui demande. À chaque décision confiée au
 * cerveau (combat, remplacement), il envoie l'observation encodée et les actions permises, et
 * attend l'action choisie. Le reste (messages, récompenses…) suit les règles du pilote.
 *
 * Protocole (une ligne JSON par message) :
 *   Node → Python : pret · decision · fin-partie
 *   Python → Node : nouvelle-partie · action · fin
 */
import { BattleScene } from "#app/battle-scene";
import { BattleStyle } from "#enums/battle-style";
import { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import { GameManager } from "#test/framework/game-manager";
import { PromptHandler } from "#test/helpers/prompt-handler";
import net from "node:net";
import Phaser from "phaser";
import { describe, it, vi } from "vitest";
import { NOMBRE_ACTIONS } from "../../../observateur/actions";
import { Carnet } from "../../../observateur/carnet";
import { encoder, TAILLE_OBSERVATION, VERSION_ENCODAGE } from "../../../observateur/encodeur";
import type { ScenePokerogue } from "../../../observateur/jeu";
import { observer } from "../../../observateur/observateur";
import { type Observation, VERSION_OBSERVATION } from "../../../observateur/types";
import {
  decisionCerveauEnAttente,
  executerAction,
  nouvelEtatPilote,
  repondreParRegles,
} from "../../../pilote/pilote";
import { demarrerPartie, minuteriesEnAttente, vraiHasard } from "./outils-partie";

const PORT = Number(process.env.PONT_PORT);
const ID = Number(process.env.PONT_ID ?? 0);
/** Un compte neuf : les starters ont 15 dans chaque IV. */
const IVS_COMPTE_NEUF = [15, 15, 15, 15, 15, 15];
const STARTERS_PAR_DEFAUT = [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE];
/** Attente maximale d'une réponse du Python (il peut être occupé à apprendre). */
const ATTENTE_MAX_MS = 30 * 60_000;
const DECISIONS_MAX = 20_000;

type MessagePython =
  | { type: "nouvelle-partie"; graine?: string; especes?: number[]; styleCombat?: "fixe" | "changer"; vagueMax?: number }
  | { type: "action"; action: number }
  | { type: "fin" };

/** Connexion au Python : messages JSON, un par ligne. */
class Canal {
  private tampon = "";
  private recus: MessagePython[] = [];
  private attentes: ((m: MessagePython) => void)[] = [];
  private ferme = false;

  constructor(private readonly socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (morceau: string) => {
      this.tampon += morceau;
      let fin: number;
      while ((fin = this.tampon.indexOf("\n")) >= 0) {
        const message = JSON.parse(this.tampon.slice(0, fin)) as MessagePython;
        this.tampon = this.tampon.slice(fin + 1);
        const attente = this.attentes.shift();
        attente ? attente(message) : this.recus.push(message);
      }
    });
    // Le Python s'est arrêté : on débloque tout le monde avec « fin ».
    socket.on("close", () => {
      this.ferme = true;
      this.attentes.splice(0).forEach(a => a({ type: "fin" }));
    });
  }

  envoyer(message: object): void {
    this.socket.write(`${JSON.stringify(message)}\n`);
  }

  recevoir(): Promise<MessagePython> {
    const message = this.recus.shift() ?? (this.ferme ? ({ type: "fin" } as const) : undefined);
    return message ? Promise.resolve(message) : new Promise(r => this.attentes.push(r));
  }

  static ouvrir(port: number): Promise<Canal> {
    return new Promise((ok, ko) => {
      const socket = net.connect(port, "127.0.0.1", () => ok(new Canal(socket)));
      socket.on("error", ko);
    });
  }
}

/** Ce que le Python reçoit à chaque décision pour calculer la récompense. */
function infoPartie(obs: Observation) {
  const pvEquipe = obs.equipe.reduce((s, p) => s + p.pv, 0) / Math.max(obs.equipe.reduce((s, p) => s + p.pvMax, 0), 1);
  return {
    vague: obs.partie.vague,
    tour: obs.partie.tour,
    pvEquipe,
    koEquipe: obs.equipe.filter(p => p.ko).length,
    pvAdversaires: obs.adversaires.reduce((s, a) => s + a.pvPourcent / 100, 0) / Math.max(obs.adversaires.length, 1),
  };
}

async function jouerPartie(
  phaserGame: Phaser.Game,
  canal: Canal,
  demande: { graine?: string; especes?: number[]; styleCombat?: "fixe" | "changer"; vagueMax?: number },
) {
  // Nettoyage entre deux parties d'un même processus (normalement fait par l'outil de test
  // entre deux tests) : sans lui, les « espions » de l'outil s'empileraient partie après partie.
  vi.restoreAllMocks();
  if (PromptHandler.runInterval) {
    clearInterval(PromptHandler.runInterval);
    PromptHandler.runInterval = undefined;
  }
  const game = new GameManager(phaserGame);
  BattleScene.prototype.randBattleSeedInt = vraiHasard;
  game.override.normalizeIVs = false;
  game.override.normalizeNatures = false;
  game.override.disableShinies = false;
  game.override.removeEnemyStartingItems = false;
  // Style « Changer » : le jeu demande « Changer de Pokémon ? » après chaque K.O. adverse
  // (réglage possible du joueur en ligne) ; « Fixe » : il ne demande rien.
  game.settings.battleStyle(demande.styleCombat === "changer" ? BattleStyle.SWITCH : BattleStyle.SET);

  const scene: ScenePokerogue = game.scene;
  const intercepteur = game.phaseInterceptor as unknown as { state: string };
  const carnet = new Carnet();
  const etat = nouvelEtatPilote();
  const graine = demande.graine ?? Math.random().toString(36).slice(2, 12);
  const debut = performance.now();
  let decisions = 0;
  let phases = 0;
  let enAttente = false;
  let erreur: string | undefined;
  let victoire = false;
  /** Vrai si la partie a été arrêtée à la vague maximale demandée (programme progressif). */
  let tronquee = false;
  /** Combien de fois chaque règle du pilote a servi (ex. « récompense », « ne change pas »). */
  const regles: Record<string, number> = {};
  // Actions refusées par le jeu pour la décision en cours (ex. changement alors qu'on est piégé).
  let cleDecision = "";
  const refusees = new Set<number>();

  const minuteur = setInterval(() => {
    if (enAttente || erreur) {
      return;
    }
    try {
      if (!decisionCerveauEnAttente(scene)) {
        const fait = repondreParRegles(scene, etat)?.split(" :")[0];
        if (fait && fait !== "suite") {
          regles[fait] = (regles[fait] ?? 0) + 1;
        }
        return;
      }
      carnet.mettreAJour(scene);
      const obs = observer(scene, carnet);
      if (!obs?.decision.masque) {
        return;
      }
      const cle = `${obs.partie.vague}:${obs.partie.tour}:${obs.decision.phase}:${obs.decision.positionActeur}`;
      if (cle !== cleDecision) {
        cleDecision = cle;
        refusees.clear();
      }
      const masque = obs.decision.masque.map((permise, i) => permise && !refusees.has(i));
      if (!masque.some(Boolean)) {
        erreur = "aucune action permise";
        return;
      }
      enAttente = true;
      decisions++;
      canal.envoyer({
        type: "decision",
        // Les 1 290 nombres en binaire (base64) : plus rapide et plus exact que du texte.
        observation: Buffer.from(encoder(obs).buffer).toString("base64"),
        masque: masque.map(Number),
        info: infoPartie(obs),
      });
      canal.recevoir().then(message => {
        if (message.type !== "action") {
          erreur = message.type === "fin" ? "arrêt demandé" : `message inattendu : ${message.type}`;
        } else if (!executerAction(scene, message.action, etat)) {
          refusees.add(message.action);
        }
        enAttente = false;
      });
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }, 0);

  try {
    await demarrerPartie(game, (demande.especes ?? STARTERS_PAR_DEFAUT) as SpeciesId[], graine, IVS_COMPTE_NEUF);
    let vagueSuivie = -1;
    let phasesDansLaVague = 0;
    for (;;) {
      await vi.waitUntil(() => intercepteur.state === "idling" || !!erreur, { interval: 0, timeout: ATTENTE_MAX_MS });
      if (erreur) {
        break;
      }
      if (minuteriesEnAttente(game)) {
        await vi.waitUntil(() => !minuteriesEnAttente(game), { interval: 0, timeout: 20_000 });
      }
      carnet.mettreAJour(scene);
      const phase = game.scene.phaseManager.getCurrentPhase();
      if (phase.is("GameOverPhase")) {
        victoire = !!(phase as unknown as { isVictory?: boolean }).isVictory;
        break;
      }
      if (phase.is("ScanIvsPhase")) {
        // L'écran du Scanner d'IV plante sans graphismes ; on saute seulement l'affichage.
        intercepteur.state = "running";
        phase.end();
        continue;
      }
      const vague = game.scene.currentBattle?.waveIndex ?? 0;
      if (demande.vagueMax && vague > demande.vagueMax) {
        tronquee = true;
        break;
      }
      if (vague !== vagueSuivie) {
        vagueSuivie = vague;
        phasesDansLaVague = 0;
      }
      if (++phasesDansLaVague > 5000 || decisions > DECISIONS_MAX) {
        erreur = `boucle à la vague ${vague}`;
        break;
      }
      phases++;
      intercepteur.state = "running";
      phase.start();
    }
  } catch (e) {
    erreur = e instanceof Error ? e.message.split("\n")[0] : String(e);
  } finally {
    clearInterval(minuteur);
  }

  return {
    vague: game.scene.currentBattle?.waveIndex ?? 0,
    victoire,
    tronquee,
    decisions,
    phases,
    secondes: (performance.now() - debut) / 1000,
    graine,
    regles,
    ...(erreur ? { erreur, phase: game.scene.phaseManager.getCurrentPhase()?.phaseName, ecran: UiMode[game.scene.ui.getMode()] } : {}),
  };
}

describe("Environnement d'entraînement", () => {
  it.runIf(PORT)(
    `simulateur n° ${ID}`,
    async () => {
      // Le jeu écrit énormément dans la console ; l'outil de test garderait tout en mémoire.
      for (const methode of ["log", "info", "debug", "warn", "error", "trace"] as const) {
        console[methode] = () => {};
      }
      const phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
      const canal = await Canal.ouvrir(PORT);
      canal.envoyer({
        type: "pret",
        id: ID,
        tailleEntree: TAILLE_OBSERVATION,
        nombreActions: NOMBRE_ACTIONS,
        versionObservation: VERSION_OBSERVATION,
        versionEncodage: VERSION_ENCODAGE,
      });
      for (;;) {
        const message = await canal.recevoir();
        if (message.type === "fin") {
          break;
        }
        if (message.type === "nouvelle-partie") {
          canal.envoyer({ type: "fin-partie", info: await jouerPartie(phaserGame, canal, message) });
        }
      }
    },
    7 * 24 * 3600_000,
  );
});
