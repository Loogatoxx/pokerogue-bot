/**
 * Les actions que le cerveau peut choisir, et celles que le jeu permet à un instant donné.
 *
 * Numérotation (14 actions) :
 *   0 à 7  : attaque n° a (0 à 3) sur l'ennemi en place c (0 ou 1)  → index = a × 2 + c
 *   8 à 13 : envoyer le Pokémon de la place p de l'équipe (0 à 5)     → index = 8 + p
 *
 * Cette numérotation est figée dans chaque cerveau entraîné : la changer impose de repartir
 * de zéro (d'où NOMBRE_ACTIONS enregistré dans le fichier du cerveau).
 * Pas encore confiées au cerveau : Poké Balls, fuite, Téracristallisation (étapes suivantes).
 */
import type { PokemonJeu, ScenePokerogue } from "./jeu";
import { CIBLES_AU_CHOIX } from "./valeurs";

export const NOMBRE_ACTIONS = 14;
export const PREMIER_CHANGEMENT = 8;

export type ActionCerveau =
  | { type: "attaque"; attaque: number; cible: number }
  | { type: "envoyer"; place: number };

export function decrireAction(index: number): ActionCerveau {
  if (index < PREMIER_CHANGEMENT) {
    return { type: "attaque", attaque: Math.floor(index / 2), cible: index % 2 };
  }
  return { type: "envoyer", place: index - PREMIER_CHANGEMENT };
}

export function indexAttaque(attaque: number, cible: number): number {
  return attaque * 2 + cible;
}

/** Remplaçants possibles : debout et pas déjà sur le terrain. */
function remplacants(scene: ScenePokerogue): boolean[] {
  const equipe = scene.getPlayerParty();
  return Array.from({ length: 6 }, (_, place) => {
    const p = equipe[place];
    return !!p && !p.isFainted() && !p.isOnField();
  });
}

/** Ennemis ciblables, par place sur le terrain. */
function ciblesPossibles(scene: ScenePokerogue): boolean[] {
  const cibles = [false, false];
  for (const ennemi of scene.getEnemyField()) {
    if (ennemi.isOnField() && !ennemi.isFainted()) {
      cibles[ennemi.getFieldIndex()] = true;
    }
  }
  return cibles;
}

/** Actions permises pour le choix d'action de `pokemon` (CommandPhase). */
export function masqueCombat(scene: ScenePokerogue, pokemon: PokemonJeu, double: boolean): boolean[] {
  const masque = new Array<boolean>(NOMBRE_ACTIONS).fill(false);
  const cibles = ciblesPossibles(scene);
  const premiereCible = cibles.indexOf(true);

  pokemon.getMoveset().forEach((attaque, a) => {
    if (a > 3 || !attaque.isUsable(pokemon, false, true)[0]) {
      return;
    }
    // En simple, ou pour une attaque qui ne vise pas un ennemi au choix (Trempette vise le
    // lanceur, Rugissement tous les ennemis…), la cible n'a pas de sens : on ne garde qu'une
    // seule des deux actions pour ne pas dédoubler le même choix.
    if (!double || !CIBLES_AU_CHOIX.has(attaque.getMove().moveTarget)) {
      if (premiereCible >= 0) {
        masque[indexAttaque(a, premiereCible)] = true;
      }
      return;
    }
    cibles.forEach((possible, c) => {
      masque[indexAttaque(a, c)] = possible;
    });
  });

  remplacants(scene).forEach((possible, place) => {
    masque[PREMIER_CHANGEMENT + place] = possible;
  });

  // Plus aucune attaque ni aucun changement : le jeu fera utiliser Lutte, on garde l'attaque 0.
  if (!masque.some(Boolean) && premiereCible >= 0) {
    masque[indexAttaque(0, premiereCible)] = true;
  }
  return masque;
}

/** Actions permises pour remplacer un Pokémon K.O. (SwitchPhase) : seulement envoyer quelqu'un. */
export function masqueRemplacement(scene: ScenePokerogue): boolean[] {
  const masque = new Array<boolean>(NOMBRE_ACTIONS).fill(false);
  remplacants(scene).forEach((possible, place) => {
    masque[PREMIER_CHANGEMENT + place] = possible;
  });
  return masque;
}
