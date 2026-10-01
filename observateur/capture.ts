/**
 * La chance de capturer un Pokémon avec une Ball, par la formule du jeu (AttemptCapturePhase),
 * avec ce qu'un joueur voit : le taux de capture de l'espèce (Pokédex), la barre de PV, le statut.
 *
 *   taux modifié = (3 × PVmax − 2 × PV) / (3 × PVmax) × taux de l'espèce × bonus de la Ball × statut
 *   chance d'une secousse = (taux modifié / 255) ^ 0,1875 ; il faut réussir 3 secousses.
 *
 * Remarque de Carlos (01/10) : « l'IA essaie toujours de capturer ; si le Pokémon résiste, il ne
 * rentre pas et finit par mettre K.O. nos Pokémon ». Un Pokémon à taux 45 en pleine forme n'a que
 * ~20 % de chances d'entrer dans une Poké Ball ; à 10 % de PV, ~36 % : un joueur l'affaiblit d'abord.
 */
import { connaissance } from "./especes";
import type { PokemonAdverse } from "./types";

/** Bonus des Balls, dans l'ordre des actions du cerveau : Poké, Super, Hyper, Rogue, Master. */
const BONUS_BALL = [1, 1.5, 2, 3, Infinity];

/** Bonus de statut (StatusEffect du jeu) : poison, toxik, paralysie, brûlure ×1,5 ; sommeil, gel ×2,5. */
function bonusStatut(statut: number): number {
  // Valeurs de StatusEffect : 1 poison, 2 toxik, 3 paralysie, 4 sommeil, 5 gel, 6 brûlure.
  if (statut === 4 || statut === 5) {
    return 2.5;
  }
  return statut === 1 || statut === 2 || statut === 3 || statut === 6 ? 1.5 : 1;
}

/** Chance (0 à 1) de capturer cet adversaire avec la Ball n° `ball` (0 Poké … 4 Master). */
export function chanceCapture(adversaire: PokemonAdverse, ball: number): number {
  const bonus = BONUS_BALL[ball] ?? 1;
  if (bonus === Infinity) {
    return 1;
  }
  const taux = connaissance(adversaire.espece)?.tauxCapture ?? 45;
  const pv = Math.max(0, Math.min(1, adversaire.pvPourcent / 100));
  const modifie = Math.round(((3 - 2 * pv) / 3) * taux * bonus * bonusStatut(adversaire.statut.id));
  if (modifie >= 255) {
    return 1;
  }
  if (modifie <= 0) {
    return 0;
  }
  return Math.pow(Math.pow(modifie / 255, 0.1875), 3);
}
