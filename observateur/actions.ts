/**
 * Les actions que le cerveau peut choisir, et celles que le jeu permet à un instant donné.
 *
 * Numérotation (19 actions) :
 *   0 à 7   : attaque n° a (0 à 3) sur l'ennemi en place c (0 ou 1)  → index = a × 2 + c
 *   8 à 13  : envoyer le Pokémon de la place p de l'équipe (0 à 5)     → index = 8 + p
 *   14 à 18 : lancer une Poké, Super, Hyper, Rogue ou Master Ball       → index = 14 + type
 *
 * Cette numérotation est figée dans chaque cerveau entraîné (NOMBRE_ACTIONS est enregistré dans
 * son fichier). On n'ajoute donc de nouvelles actions qu'à la fin : un cerveau existant peut
 * alors être « greffé » (entraineur/greffe.py) au lieu de repartir de zéro.
 * Pas encore confiées au cerveau : fuite, Téracristallisation.
 */
import type { PokemonJeu, ScenePokerogue } from "./jeu";
import { BattleType } from "./noms";
import { CIBLES_AU_CHOIX } from "./valeurs";

export const NOMBRE_ACTIONS = 19;
export const PREMIER_CHANGEMENT = 8;
export const PREMIERE_BALL = 14;
/** Poké, Super, Hyper, Rogue et Master Ball (valeurs PokeballType 0 à 4 du jeu). */
const NB_BALLS = 5;
const MASTER_BALL = 4;
/** Valeur BattleType d'un combat sauvage (seuls combats où l'on peut capturer). */
const COMBAT_SAUVAGE = Number(Object.entries(BattleType).find(([, n]) => n.cle === "WILD")![0]);

export type ActionCerveau =
  | { type: "attaque"; attaque: number; cible: number }
  | { type: "envoyer"; place: number }
  | { type: "ball"; ball: number };

export function decrireAction(index: number): ActionCerveau {
  if (index < PREMIER_CHANGEMENT) {
    return { type: "attaque", attaque: Math.floor(index / 2), cible: index % 2 };
  }
  if (index < PREMIERE_BALL) {
    return { type: "envoyer", place: index - PREMIER_CHANGEMENT };
  }
  return { type: "ball", ball: index - PREMIERE_BALL };
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

  ballsPossibles(scene).forEach((possible, ball) => {
    masque[PREMIERE_BALL + ball] = possible;
  });

  // Plus aucune attaque ni aucun changement : le jeu fera utiliser Lutte, on garde l'attaque 0.
  if (!masque.some(Boolean) && premiereCible >= 0) {
    masque[indexAttaque(0, premiereCible)] = true;
  }
  return masque;
}

/**
 * Poké Balls lançables, selon les règles du jeu (CommandPhase.handleBallCommand) : combat
 * sauvage, un seul ennemi actif, une Ball en stock, et un boss seulement quand il ne lui reste
 * qu'une barre de PV (sauf Master Ball). Les cas rares (zone finale, rencontres mystère) sont
 * refusés par le jeu lui-même, et le cerveau choisit alors autre chose.
 */
function ballsPossibles(scene: ScenePokerogue): boolean[] {
  const aucune = new Array<boolean>(NB_BALLS).fill(false);
  const actifs = scene.getEnemyField().filter(p => p.isActive(true));
  if (scene.currentBattle?.battleType !== COMBAT_SAUVAGE || actifs.length !== 1) {
    return aucune;
  }
  const cible = actifs[0]!;
  const protegeParSesBarres = cible.isBoss() && (cible.bossSegmentIndex ?? 0) >= 1;
  return aucune.map((_, ball) => (scene.pokeballCounts[ball] ?? 0) > 0 && (!protegeParSesBarres || ball === MASTER_BALL));
}

/** Actions permises pour remplacer un Pokémon K.O. (SwitchPhase) : seulement envoyer quelqu'un. */
export function masqueRemplacement(scene: ScenePokerogue): boolean[] {
  const masque = new Array<boolean>(NOMBRE_ACTIONS).fill(false);
  remplacants(scene).forEach((possible, place) => {
    masque[PREMIER_CHANGEMENT + place] = possible;
  });
  return masque;
}
