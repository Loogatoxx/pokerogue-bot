/**
 * Le capteur : tourne dans le « monde principal » de la page, le seul où le jeu est visible.
 *
 * 1. Attend que le moteur Phaser soit chargé (window.Phaser).
 * 2. Intercepte une seule fois la mise à jour des scènes pour récupérer la scène de combat
 *    (« battle ») : c'est elle qui contient l'équipe, le terrain, les phases…
 * 3. Plusieurs fois par seconde : met à jour le carnet, observe la partie et envoie le résultat
 *    au panneau.
 */
import { Carnet } from "../../observateur/carnet";
import type { ScenePokerogue } from "../../observateur/jeu";
import { observer } from "../../observateur/observateur";
import { type ContenuMessage, SOURCE } from "./messages";

const PERIODE_MS = 250;

type SystemesPhaser = { settings?: { key?: string }; scene: unknown; step(...args: unknown[]): unknown };
type Phaser = { Scenes?: { Systems?: { prototype: SystemesPhaser } } };

let scene: ScenePokerogue | null = null;
const carnet = new Carnet();

function envoyer(message: ContenuMessage): void {
  window.postMessage({ source: SOURCE, ...message }, window.location.origin);
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

function observerUneFois(): void {
  try {
    if (!scene?.currentBattle) {
      envoyer({ type: "etat", etat: "hors-partie" });
      return;
    }
    carnet.mettreAJour(scene);
    const observation = observer(scene, carnet);
    if (observation) {
      envoyer({ type: "observation", observation });
    } else {
      envoyer({ type: "etat", etat: "hors-partie" });
    }
  } catch (erreur) {
    // Probablement une mise à jour du jeu qui a renommé quelque chose : on le signale sans casser la page.
    envoyer({ type: "erreur", message: erreur instanceof Error ? erreur.message : String(erreur) });
  }
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
    observer: () => (scene ? observer(scene, carnet) : null),
  },
});

attendrePhaser();
