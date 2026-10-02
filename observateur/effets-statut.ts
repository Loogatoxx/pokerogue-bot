// Fichier GÉNÉRÉ depuis la copie locale du jeu (jeu/src/data/moves/move.ts) — ne pas modifier à la main.
/** Attaques de statut qui ne font que changer des crans de stats : identifiant → [crans touchés
 * (0 Attaque, 1 Défense, 2 Attaque Spé., 3 Défense Spé., 4 Vitesse, 5 Précision, 6 Esquive), étapes, sur soi]. */
export const EFFETS_STATUT: Readonly<Record<number, readonly [readonly number[], number, boolean]>> = {
  14: [[0], 2, true], // SWORDS_DANCE
  28: [[5], -1, false], // SAND_ATTACK
  39: [[1], -1, false], // TAIL_WHIP
  43: [[1], -1, false], // LEER
  45: [[0], -1, false], // GROWL
  81: [[4], -2, false], // STRING_SHOT
  96: [[0], 1, true], // MEDITATE
  97: [[4], 2, true], // AGILITY
  103: [[1], -2, false], // SCREECH
  104: [[6], 1, true], // DOUBLE_TEAM
  106: [[1], 1, true], // HARDEN
  108: [[5], -1, false], // SMOKESCREEN
  110: [[1], 1, true], // WITHDRAW
  111: [[1], 1, true], // DEFENSE_CURL
  112: [[1], 2, true], // BARRIER
  133: [[3], 2, true], // AMNESIA
  134: [[5], -1, false], // KINESIS
  148: [[5], -1, false], // FLASH
  151: [[1], 2, true], // ACID_ARMOR
  159: [[0], 1, true], // SHARPEN
  178: [[4], -2, false], // COTTON_SPORE
  184: [[4], -2, false], // SCARY_FACE
  204: [[0], -2, false], // CHARM
  230: [[6], -2, false], // SWEET_SCENT
  294: [[2], 3, true], // TAIL_GLOW
  297: [[0], -2, false], // FEATHER_DANCE
  313: [[3], -2, false], // FAKE_TEARS
  319: [[3], -2, false], // METAL_SOUND
  321: [[0, 1], -1, false], // TICKLE
  322: [[1, 3], 1, true], // COSMIC_POWER
  334: [[1], 2, true], // IRON_DEFENSE
  336: [[0], 1, false], // HOWL
  339: [[0, 1], 1, true], // BULK_UP
  347: [[2, 3], 1, true], // CALM_MIND
  349: [[0, 4], 1, true], // DRAGON_DANCE
  397: [[4], 2, true], // ROCK_POLISH
  417: [[2], 2, true], // NASTY_PLOT
  445: [[2], -2, false], // CAPTIVATE
  455: [[1, 3], 1, true], // DEFEND_ORDER
  468: [[0, 5], 1, true], // HONE_CLAWS
  483: [[2, 3, 4], 1, true], // QUIVER_DANCE
  489: [[0, 1, 5], 1, true], // COIL
  526: [[0, 2], 1, true], // WORK_UP
  538: [[1], 3, true], // COTTON_GUARD
  563: [[0, 2], 1, false], // ROTOTILLER
  568: [[0, 2], -1, false], // NOBLE_ROAR
  579: [[1], 1, false], // FLOWER_SHIELD
  589: [[0], -1, false], // PLAY_NICE
  590: [[2], -1, false], // CONFIDE
  597: [[3], 1, false], // AROMATIC_MIST
  598: [[2], -2, false], // EERIE_IMPULSE
  599: [[0, 2, 4], -1, false], // VENOM_DRENCH
  602: [[1, 3], 1, false], // MAGNETIC_FLUX
  608: [[0], -1, false], // BABY_DOLL_EYES
  674: [[0, 2], 1, false], // GEAR_UP
  702: [[0, 1, 2, 3, 4], 2, true], // EXTREME_EVOBOOST
  715: [[0, 2], -1, false], // TEARFUL_LOOK
  777: [[0, 2], 2, false], // DECORATE
  811: [[0, 1], 1, false], // COACHING
  837: [[0, 1, 4], 1, true], // VICTORY_DANCE
  842: [[1], 2, true], // SHELTER
};
