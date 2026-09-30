/**
 * Le capteur : tourne dans le « monde principal » de la page, le seul où le jeu est visible.
 * Ce sont les yeux et les mains du cerveau dans le navigateur.
 *
 * 1. Attend que le moteur Phaser soit chargé (window.Phaser).
 * 2. Intercepte une seule fois la mise à jour des scènes pour récupérer la scène de combat
 *    (« battle ») : c'est elle qui contient l'équipe, le terrain, les phases…
 * 3. Plusieurs fois par seconde : met à jour le carnet, observe la partie, envoie l'observation.
 * 4. En mode auto : exécute l'action choisie par le cerveau (reçue du panneau), et répond au
 *    reste (messages, récompenses…) avec les règles du pilote, au rythme choisi.
 */
import { Carnet } from "../../observateur/carnet";
import type { ScenePokerogue } from "../../observateur/jeu";
import { observer } from "../../observateur/observateur";
import {
  decisionCerveauEnAttente,
  executerAction,
  nouvelEtatPilote,
  repondreParRegles,
} from "../../pilote/pilote";
import { type ContenuCapteur, cleDecision, estMessagePanneau, SOURCE } from "./messages";

const PERIODE_MS = 250;

type SystemesPhaser = { settings?: { key?: string }; scene: unknown; step(...args: unknown[]): unknown };
type Phaser = { Scenes?: { Systems?: { prototype: SystemesPhaser } } };

let scene: ScenePokerogue | null = null;
const carnet = new Carnet();
const etatPilote = nouvelEtatPilote();
const pilotage = { auto: false, delaiMs: 700, derniereAction: 0 };

function envoyer(message: ContenuCapteur): void {
  window.postMessage({ source: SOURCE, origine: "capteur", ...message }, window.location.origin);
}

/**
 * Remplace une fois `step` des scènes Phaser (appelé à chaque image pour chaque scène) :
 * au premier passage de la scène « battle », on la garde et on remet l'original.
 */
function intercepterScene(phaser: Phaser): void {
  const prototype = phaser.Scenes!.Systems!.prototype;
  const original = prototype.step;
  prototype.step = function (this: SystemesPhaser, ...args: unknown[]) {
    if (this.settings?.key === "battle") {
      scene = this.scene as ScenePokerogue;
      prototype.step = original;
      demarrer();
    }
    return original.apply(this, args);
  };
}

/** Le mode auto est-il permis ici ? Jamais en Daily Run (classement partagé avec d'autres). */
function autoPermis(s: ScenePokerogue): boolean {
  return pilotage.auto && !s.gameMode.isDaily;
}

function observerUneFois(): void {
  try {
    if (!scene?.currentBattle) {
      envoyer({ type: "etat", etat: "hors-partie" });
      return;
    }
    carnet.mettreAJour(scene);
    const observation = observer(scene, carnet);
    if (!observation) {
      envoyer({ type: "etat", etat: "hors-partie" });
      return;
    }
    envoyer({ type: "observation", observation });

    // Mode auto : tout ce qui n'est pas une décision du cerveau suit les règles du pilote,
    // au rythme choisi pour qu'un humain puisse suivre.
    if (autoPermis(scene) && !decisionCerveauEnAttente(scene) && Date.now() - pilotage.derniereAction >= pilotage.delaiMs / 3) {
      const fait = repondreParRegles(scene, etatPilote);
      if (fait) {
        pilotage.derniereAction = Date.now();
        if (fait !== "suite") {
          envoyer({ type: "pilote", texte: `Règle : ${fait}` });
        }
      }
    }
  } catch (erreur) {
    // Probablement une mise à jour du jeu qui a renommé quelque chose : on le signale sans casser la page.
    envoyer({ type: "erreur", message: erreur instanceof Error ? erreur.message : String(erreur) });
  }
}

/** Le panneau a choisi une action : on l'exécute si le jeu attend toujours cette décision. */
function executerSiToujoursAttendue(cle: string, action: number): void {
  if (!scene || !autoPermis(scene) || !decisionCerveauEnAttente(scene)) {
    return;
  }
  const observation = observer(scene, carnet);
  if (!observation || cleDecision(observation) !== cle) {
    return;
  }
  const accepte = executerAction(scene, action, etatPilote);
  pilotage.derniereAction = Date.now();
  envoyer({ type: "pilote", texte: accepte ? "Action du cerveau jouée" : "Action refusée par le jeu" });
}

function ecouterPanneau(): void {
  window.addEventListener("message", (evenement: MessageEvent) => {
    if (evenement.source !== window || !estMessagePanneau(evenement.data)) {
      return;
    }
    const message = evenement.data;
    if (message.type === "pilotage") {
      pilotage.auto = message.auto;
      pilotage.delaiMs = message.delaiMs;
    } else if (message.type === "action") {
      executerSiToujoursAttendue(message.cle, message.action);
    }
  });
}

function demarrer(): void {
  window.setInterval(observerUneFois, PERIODE_MS);
}

function attendrePhaser(): void {
  envoyer({ type: "etat", etat: "attente-jeu" });
  const minuteur = window.setInterval(() => {
    const phaser = (window as unknown as { Phaser?: Phaser }).Phaser;
    if (phaser?.Scenes?.Systems?.prototype) {
      window.clearInterval(minuteur);
      intercepterScene(phaser);
    }
  }, 200);
}

// Accès de débogage depuis la console du navigateur : window.__pokerogueCerveau
Object.defineProperty(window, "__pokerogueCerveau", {
  value: {
    get scene() {
      return scene;
    },
    carnet,
    pilotage,
    observer: () => (scene ? observer(scene, carnet) : null),
  },
});

ecouterPanneau();
attendrePhaser();
