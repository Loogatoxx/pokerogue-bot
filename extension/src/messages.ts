/**
 * Messages envoyés par le capteur (monde de la page) au panneau (monde de l'extension).
 *
 * Les deux scripts ne partagent pas de variables : Chrome/Brave isolent l'extension de la page.
 * Ils communiquent par window.postMessage, que n'importe quel script de la page peut aussi
 * utiliser : d'où la signature SOURCE, vérifiée à la réception.
 */
import type { Observation } from "../../observateur/types";

export const SOURCE = "pokerogue-cerveau";

/** Ce que le capteur peut dire au panneau. */
export type ContenuMessage =
  | { type: "etat"; etat: "attente-jeu" | "hors-partie" }
  | { type: "observation"; observation: Observation }
  | { type: "erreur"; message: string };

/** Le même, signé : c'est ce qui circule réellement entre les deux mondes. */
export type MessageCapteur = ContenuMessage & { source: typeof SOURCE };

export function estMessageCapteur(donnee: unknown): donnee is MessageCapteur {
  return typeof donnee === "object" && donnee !== null && (donnee as { source?: unknown }).source === SOURCE;
}
