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
import { ecrirePlan, etapeCapture, lirePlan, type MemoireCapture, nouveauPlan, type PlanCapture } from "./capture-forcee";
import { type ContenuCapteur, cleDecision, estMessagePanneau, SOURCE } from "./messages";
import { estBall } from "./options-capture";
import { lireStartersDuCompte } from "./starters-compte";

/** Signature de la dernière liste de starters envoyée : on ne la renvoie que si elle change. */
let derniersStarters = "";

const PERIODE_MS = 250;

type SystemesPhaser = { settings?: { key?: string }; scene: unknown; step(...args: unknown[]): unknown };
type Phaser = { Scenes?: { Systems?: { prototype: SystemesPhaser } } };

let scene: ScenePokerogue | null = null;
const carnet = new Carnet();
const etatPilote = nouvelEtatPilote(carnet);
const pilotage = { auto: false, objetsALaMain: false, delaiMs: 700, derniereAction: 0, sansBalls: false };
const DELAI_CAPTURE_MS = 800;
const MAX_TENTATIVES = 100;
let planCapture: PlanCapture | null = lirePlan();
const memoireCapture: MemoireCapture = { toursAttendus: 0, ballLancee: false };
let texteCapture = "";
let annonceCapture = 0;

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

function objetsLaissesAuJoueur(s: ScenePokerogue): boolean {
  return pilotage.objetsALaMain && s.phaseManager.getCurrentPhase()?.phaseName === "SelectModifierPhase";
}

function annoncerCapture(texte: string): void {
  texteCapture = texte;
  annonceCapture = Date.now();
  envoyer({ type: "capture", actif: planCapture !== null, texte });
}

function arreterCapture(texte: string): void {
  planCapture = null;
  ecrirePlan(null);
  annoncerCapture(texte);
}

function piloterCapture(s: ScenePokerogue): void {
  const plan = planCapture!;
  if (s.gameMode?.isDaily) {
    arreterCapture("Jamais en Daily Run.");
    return;
  }
  if (Date.now() - annonceCapture > 3000) {
    annoncerCapture(texteCapture || `Capture forcée de ${plan.nom} : tentative ${plan.tentative + 1}/${plan.max}`);
  }
  if (Date.now() - pilotage.derniereAction < DELAI_CAPTURE_MS) {
    return;
  }
  const decision = decisionCerveauEnAttente(s);
  const obs = s.currentBattle ? observer(s, carnet) : null;
  if (obs) {
    envoyer({ type: "observation", observation: obs });
  }
  const etape = etapeCapture(s, obs, plan, memoireCapture, decision);
  if (etape.genre === "rien") {
    if (s.currentBattle && !decisionCerveauEnAttente(s) && repondreParRegles(s, etatPilote)) {
      pilotage.derniereAction = Date.now();
    }
    return;
  }
  pilotage.derniereAction = Date.now();
  if (etape.genre === "fini") {
    arreterCapture(etape.texte);
  } else if (etape.genre === "recharger") {
    plan.tentative++;
    if (plan.tentative >= plan.max) {
      arreterCapture(`${plan.nom} pas capturé après ${plan.max} tentatives.`);
      return;
    }
    ecrirePlan(plan);
    annoncerCapture(`${etape.texte} : on recharge (tentative ${plan.tentative + 1}/${plan.max})`);
    window.location.reload();
  } else if (etape.genre === "action") {
    executerAction(s, etape.action, etatPilote);
    annoncerCapture(etape.texte);
  } else if (etape.texte !== texteCapture) {
    annoncerCapture(etape.texte);
  }
}

function observerUneFois(): void {
  try {
    if (scene && planCapture) {
      piloterCapture(scene);
      return;
    }
    if (!scene?.currentBattle) {
      // Écran de choix des starters : le panneau conseille une équipe (constructeur-equipe.ts).
      const candidats = scene ? lireStartersDuCompte(scene) : null;
      if (candidats) {
        const signature = candidats.map(c => `${c.espece}:${c.cout}`).join(",");
        if (signature !== derniersStarters) {
          derniersStarters = signature;
          envoyer({ type: "starters", candidats });
        }
        return;
      }
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
    if (autoPermis(scene) && !objetsLaissesAuJoueur(scene) && !decisionCerveauEnAttente(scene) && Date.now() - pilotage.derniereAction >= pilotage.delaiMs / 3) {
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
  if (!scene || !autoPermis(scene) || !decisionCerveauEnAttente(scene) || (pilotage.sansBalls && estBall(action))) {
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

function changerCapture(actif: boolean, max: number): void {
  if (!actif) {
    arreterCapture("Capture forcée arrêtée.");
    return;
  }
  const obs = scene?.currentBattle ? observer(scene, carnet) : null;
  if (!scene || !obs) {
    annoncerCapture("Lance d'abord le combat contre le Pokémon à capturer.");
    return;
  }
  const plan = nouveauPlan(scene, obs, Math.max(1, Math.min(max, MAX_TENTATIVES)));
  if (typeof plan === "string") {
    annoncerCapture(plan);
    return;
  }
  planCapture = plan;
  memoireCapture.toursAttendus = 0;
  memoireCapture.ballLancee = false;
  ecrirePlan(plan);
  annoncerCapture(`Capture forcée de ${plan.nom} (vague ${plan.vague}) : tentative 1/${plan.max}`);
}

function ecouterPanneau(): void {
  window.addEventListener("message", (evenement: MessageEvent) => {
    if (evenement.source !== window || !estMessagePanneau(evenement.data)) {
      return;
    }
    const message = evenement.data;
    if (message.type === "pilotage") {
      pilotage.auto = message.auto;
      pilotage.objetsALaMain = message.objetsALaMain;
      pilotage.delaiMs = message.delaiMs;
      pilotage.sansBalls = message.sansBalls;
      etatPilote.garderEquipe = message.garderEquipe;
    } else if (message.type === "action") {
      executerSiToujoursAttendue(message.cle, message.action);
    } else if (message.type === "capture-forcee") {
      changerCapture(message.actif, message.max);
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
