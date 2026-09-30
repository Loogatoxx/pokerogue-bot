/**
 * Messages entre le capteur (monde de la page) et le panneau (monde de l'extension).
 *
 * Les deux scripts ne partagent pas de variables : Brave isole l'extension de la page.
 * Ils communiquent par window.postMessage, que n'importe quel script de la page peut aussi
 * utiliser : d'où la signature SOURCE et l'origine, vérifiées à la réception.
 */
import type { Observation } from "../../observateur/types";

export const SOURCE = "pokerogue-cerveau";

/** Ce que le capteur dit au panneau. */
export type ContenuCapteur =
  | { type: "etat"; etat: "attente-jeu" | "hors-partie" }
  | { type: "observation"; observation: Observation }
  | { type: "pilote"; texte: string }
  | { type: "erreur"; message: string };

/** Ce que le panneau demande au capteur. */
export type ContenuPanneau =
  | { type: "pilotage"; auto: boolean; delaiMs: number }
  | { type: "action"; cle: string; action: number };

export type MessageCapteur = ContenuCapteur & { source: typeof SOURCE; origine: "capteur" };
export type MessagePanneau = ContenuPanneau & { source: typeof SOURCE; origine: "panneau" };

function signe(donnee: unknown, origine: string): boolean {
  const d = donnee as { source?: unknown; origine?: unknown } | null;
  return typeof d === "object" && d !== null && d.source === SOURCE && d.origine === origine;
}

export const estMessageCapteur = (d: unknown): d is MessageCapteur => signe(d, "capteur");
export const estMessagePanneau = (d: unknown): d is MessagePanneau => signe(d, "panneau");

/**
 * Identifie une décision précise (vague, tour, phase, place) : le panneau l'envoie avec son
 * action, et le capteur n'exécute que si le jeu attend toujours cette même décision.
 */
export function cleDecision(obs: Observation): string {
  return `${obs.partie.vague}:${obs.partie.tour}:${obs.decision.phase}:${obs.decision.positionActeur ?? "-"}`;
}
