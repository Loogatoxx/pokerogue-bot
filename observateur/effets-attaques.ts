// Fichier GÉNÉRÉ par observateur/generer-effets-attaques.py depuis la copie locale du jeu — ne pas modifier à la main.
export interface EffetsAttaque {
  recul?: number;
  reculPv?: number;
  drain?: number;
  soi?: readonly (readonly [readonly number[], number, number])[];
  cible?: readonly (readonly [readonly number[], number, number])[];
  statut?: readonly [number, number];
  peur?: number;
}

export const EFFETS_ATTAQUES: Readonly<Record<number, EffetsAttaque>> = {
  7: { statut: [6, 0.1] }, // FIRE_PUNCH
  9: { statut: [3, 0.1] }, // THUNDER_PUNCH
  23: { peur: 0.3 }, // STOMP
  27: { peur: 0.3 }, // ROLLING_KICK
  29: { peur: 0.3 }, // HEADBUTT
  34: { statut: [3, 0.3] }, // BODY_SLAM
  36: { recul: 0.25 }, // TAKE_DOWN
  38: { recul: 0.33 }, // DOUBLE_EDGE
  40: { statut: [1, 0.3] }, // POISON_STING
  41: { statut: [1, 0.2] }, // TWINEEDLE
  44: { peur: 0.3 }, // BITE
  51: { cible: [[[3], -1, 0.1]] }, // ACID
  52: { statut: [6, 0.1] }, // EMBER
  53: { statut: [6, 0.1] }, // FLAMETHROWER
  61: { cible: [[[4], -1, 0.1]] }, // BUBBLE_BEAM
  62: { cible: [[[0], -1, 0.1]] }, // AURORA_BEAM
  66: { recul: 0.25 }, // SUBMISSION
  71: { drain: 0.5 }, // ABSORB
  72: { drain: 0.5 }, // MEGA_DRAIN
  77: { statut: [1, 1] }, // POISON_POWDER
  78: { statut: [3, 1] }, // STUN_SPORE
  84: { statut: [3, 0.1] }, // THUNDER_SHOCK
  85: { statut: [3, 0.1] }, // THUNDERBOLT
  86: { statut: [3, 1] }, // THUNDER_WAVE
  87: { statut: [3, 0.3] }, // THUNDER
  92: { statut: [2, 1] }, // TOXIC
  94: { cible: [[[3], -1, 0.1]] }, // PSYCHIC
  122: { statut: [3, 0.3] }, // LICK
  123: { statut: [1, 0.4] }, // SMOG
  124: { statut: [1, 0.3] }, // SLUDGE
  125: { peur: 0.1 }, // BONE_CLUB
  126: { statut: [6, 0.1] }, // FIRE_BLAST
  127: { peur: 0.2 }, // WATERFALL
  132: { cible: [[[4], -1, 0.1]] }, // CONSTRICT
  137: { statut: [3, 1] }, // GLARE
  138: { drain: 0.5 }, // DREAM_EATER
  139: { statut: [1, 1] }, // POISON_GAS
  141: { drain: 0.5 }, // LEECH_LIFE
  143: { peur: 0.3 }, // SKY_ATTACK
  145: { cible: [[[4], -1, 0.1]] }, // BUBBLE
  157: { peur: 0.3 }, // ROCK_SLIDE
  158: { peur: 0.1 }, // HYPER_FANG
  165: { reculPv: 0.25 }, // STRUGGLE
  172: { statut: [6, 0.1] }, // FLAME_WHEEL
  173: { peur: 0.3 }, // SNORE
  188: { statut: [1, 0.3] }, // SLUDGE_BOMB
  189: { cible: [[[5], -1, 1]] }, // MUD_SLAP
  190: { cible: [[[5], -1, 0.5]] }, // OCTAZOOKA
  192: { statut: [3, 1] }, // ZAP_CANNON
  196: { cible: [[[4], -1, 1]] }, // ICY_WIND
  202: { drain: 0.5 }, // GIGA_DRAIN
  209: { statut: [3, 0.3] }, // SPARK
  211: { soi: [[[1], 1, 0.1]] }, // STEEL_WING
  221: { statut: [6, 0.5] }, // SACRED_FIRE
  225: { statut: [3, 0.3] }, // DRAGON_BREATH
  229: { soi: [[[4], 1, 1]] }, // RAPID_SPIN
  231: { cible: [[[1], -1, 0.3]] }, // IRON_TAIL
  232: { soi: [[[0], 1, 0.1]] }, // METAL_CLAW
  239: { peur: 0.2 }, // TWISTER
  242: { cible: [[[1], -1, 0.2]] }, // CRUNCH
  246: { soi: [[[0, 1, 2, 3, 4], 1, 0.1]] }, // ANCIENT_POWER
  247: { cible: [[[3], -1, 0.2]] }, // SHADOW_BALL
  249: { cible: [[[1], -1, 0.5]] }, // ROCK_SMASH
  252: { peur: 1 }, // FAKE_OUT
  257: { statut: [6, 0.1] }, // HEAT_WAVE
  261: { statut: [6, 1] }, // WILL_O_WISP
  276: { soi: [[[0, 1], -1, 1]] }, // SUPERPOWER
  295: { cible: [[[3], -1, 0.5]] }, // LUSTER_PURGE
  296: { cible: [[[2], -1, 0.5]] }, // MIST_BALL
  299: { statut: [6, 0.1] }, // BLAZE_KICK
  302: { peur: 0.3 }, // NEEDLE_ARM
  305: { statut: [2, 0.5] }, // POISON_FANG
  306: { cible: [[[1], -1, 0.5]] }, // CRUSH_CLAW
  309: { soi: [[[0], 1, 0.2]] }, // METEOR_MASH
  310: { peur: 0.3 }, // ASTONISH
  315: { soi: [[[2], -2, 1]] }, // OVERHEAT
  317: { cible: [[[4], -1, 1]] }, // ROCK_TOMB
  318: { soi: [[[0, 1, 2, 3, 4], 1, 0.1]] }, // SILVER_WIND
  326: { peur: 0.1 }, // EXTRASENSORY
  330: { cible: [[[5], -1, 0.3]] }, // MUDDY_WATER
  340: { statut: [3, 0.3] }, // BOUNCE
  341: { cible: [[[4], -1, 1]] }, // MUD_SHOT
  342: { statut: [1, 0.1] }, // POISON_TAIL
  344: { recul: 0.33, statut: [3, 0.1] }, // VOLT_TACKLE
  354: { soi: [[[2], -2, 1]] }, // PSYCHO_BOOST
  359: { soi: [[[4], -1, 1]] }, // HAMMER_ARM
  370: { soi: [[[1, 3], -1, 1]] }, // CLOSE_COMBAT
  394: { recul: 0.33, statut: [6, 0.1] }, // FLARE_BLITZ
  395: { statut: [3, 0.3] }, // FORCE_PALM
  398: { statut: [1, 0.3] }, // POISON_JAB
  399: { peur: 0.2 }, // DARK_PULSE
  403: { peur: 0.3 }, // AIR_SLASH
  405: { cible: [[[3], -1, 0.1]] }, // BUG_BUZZ
  407: { peur: 0.2 }, // DRAGON_RUSH
  409: { drain: 0.5 }, // DRAIN_PUNCH
  411: { cible: [[[3], -1, 0.1]] }, // FOCUS_BLAST
  412: { cible: [[[3], -1, 0.1]] }, // ENERGY_BALL
  413: { recul: 0.33 }, // BRAVE_BIRD
  414: { cible: [[[3], -1, 0.1]] }, // EARTH_POWER
  422: { statut: [3, 0.1], peur: 0.1 }, // THUNDER_FANG
  423: { peur: 0.1 }, // ICE_FANG
  424: { statut: [6, 0.1], peur: 0.1 }, // FIRE_FANG
  426: { cible: [[[5], -1, 0.3]] }, // MUD_BOMB
  428: { peur: 0.2 }, // ZEN_HEADBUTT
  429: { cible: [[[5], -1, 0.3]] }, // MIRROR_SHOT
  430: { cible: [[[3], -1, 0.1]] }, // FLASH_CANNON
  434: { soi: [[[2], -2, 1]] }, // DRACO_METEOR
  435: { statut: [3, 0.3] }, // DISCHARGE
  436: { statut: [6, 0.3] }, // LAVA_PLUME
  437: { soi: [[[2], -2, 1]] }, // LEAF_STORM
  440: { statut: [1, 0.1] }, // CROSS_POISON
  441: { statut: [1, 0.3] }, // GUNK_SHOT
  442: { peur: 0.2 }, // IRON_HEAD
  451: { soi: [[[2], 1, 0.7]] }, // CHARGE_BEAM
  452: { recul: 0.33 }, // WOOD_HAMMER
  457: { recul: 0.5 }, // HEAD_SMASH
  465: { cible: [[[3], -2, 0.4]] }, // SEED_FLARE
  466: { soi: [[[0, 1, 2, 3, 4], 1, 0.1]] }, // OMINOUS_WIND
  482: { statut: [1, 0.1] }, // SLUDGE_WAVE
  488: { soi: [[[4], 1, 1]] }, // FLAME_CHARGE
  490: { cible: [[[4], -1, 1]] }, // LOW_SWEEP
  491: { cible: [[[3], -2, 1]] }, // ACID_SPRAY
  503: { statut: [6, 0.3] }, // SCALD
  517: { statut: [6, 1] }, // INFERNO
  522: { cible: [[[2], -1, 1]] }, // STRUGGLE_BUG
  523: { cible: [[[4], -1, 1]] }, // BULLDOZE
  527: { cible: [[[4], -1, 1]] }, // ELECTROWEB
  528: { recul: 0.25 }, // WILD_CHARGE
  531: { peur: 0.3 }, // HEART_STAMP
  532: { drain: 0.5 }, // HORN_LEECH
  534: { cible: [[[1], -1, 0.5]] }, // RAZOR_SHELL
  536: { cible: [[[5], -1, 0.5]] }, // LEAF_TORNADO
  537: { peur: 0.3 }, // STEAMROLLER
  539: { cible: [[[5], -1, 0.4]] }, // NIGHT_DAZE
  543: { recul: 0.25 }, // HEAD_CHARGE
  545: { statut: [6, 0.3] }, // SEARING_SHOT
  549: { cible: [[[4], -1, 1]] }, // GLACIATE
  550: { statut: [3, 0.2] }, // BOLT_STRIKE
  551: { statut: [6, 0.2] }, // BLUE_FLARE
  552: { soi: [[[2], 1, 0.5]] }, // FIERY_DANCE
  553: { statut: [3, 0.3] }, // FREEZE_SHOCK
  554: { statut: [6, 0.3] }, // ICE_BURN
  555: { cible: [[[2], -1, 1]] }, // SNARL
  556: { peur: 0.3 }, // ICICLE_CRASH
  557: { soi: [[[1, 3, 4], -1, 1]] }, // V_CREATE
  570: { drain: 0.5 }, // PARABOLIC_CHARGE
  577: { drain: 0.75 }, // DRAINING_KISS
  583: { cible: [[[0], -1, 0.1]] }, // PLAY_ROUGH
  585: { cible: [[[2], -1, 0.1]] }, // MOONBLAST
  591: { soi: [[[1], 2, 0.5]] }, // DIAMOND_STORM
  592: { statut: [6, 0.3] }, // STEAM_ERUPTION
  595: { cible: [[[2], -1, 1]] }, // MYSTICAL_FIRE
  609: { statut: [3, 1] }, // NUZZLE
  612: { soi: [[[0], 1, 1]] }, // POWER_UP_PUNCH
  613: { drain: 0.75 }, // OBLIVION_WING
  617: { recul: 0.5 }, // LIGHT_OF_RUIN
  620: { soi: [[[1, 3], -1, 1]] }, // DRAGON_ASCENT
  621: { soi: [[[1], -1, 1]] }, // HYPERSPACE_FURY
  665: { soi: [[[4], -1, 1]] }, // ICE_HAMMER
  672: { statut: [1, 1] }, // TOXIC_THREAD
  679: { cible: [[[0], -1, 1]] }, // LUNGE
  680: { cible: [[[1], -1, 1]] }, // FIRE_LASH
  688: { cible: [[[0], -1, 1]] }, // TROP_KICK
  691: { soi: [[[1], -1, 1]] }, // CLANGING_SCALES
  705: { soi: [[[2], -2, 1]] }, // FLEUR_CANNON
  708: { cible: [[[1], -1, 0.2]] }, // SHADOW_BONE
  710: { cible: [[[1], -1, 0.2]] }, // LIQUIDATION
  716: { peur: 0.3 }, // ZING_ZAP
  728: { soi: [[[0, 1, 2, 3, 4], 1, 1]] }, // CLANGOROUS_SOULBLAZE
  730: { statut: [3, 0.3] }, // SPLISHY_SPLASH
  731: { peur: 0.3 }, // FLOATY_FALL
  733: { drain: 1 }, // BOUNCY_BUBBLE
  734: { statut: [3, 1] }, // BUZZY_BUZZ
  735: { statut: [6, 1] }, // SIZZLY_SLIDE
  742: { peur: 0.3 }, // DOUBLE_IRON_BASH
  778: { cible: [[[4], -1, 1]] }, // DRUM_BEATING
  780: { statut: [6, 0.1] }, // PYRO_BALL
  783: { soi: [[[4], 1, 1]] }, // AURA_WHEEL
  784: { cible: [[[0], -1, 1]] }, // BREAKING_SWIPE
  787: { cible: [[[3], -1, 1]] }, // APPLE_ACID
  788: { cible: [[[1], -1, 1]] }, // GRAV_APPLE
  789: { cible: [[[2], -1, 1]] }, // SPIRIT_BREAK
  799: { soi: [[[4], 1, 1], [[1], -1, 1]] }, // SCALE_SHOT
  801: { statut: [1, 0.2] }, // SHELL_SIDE_ARM
  806: { cible: [[[2], -1, 1]] }, // SKITTER_SMACK
  815: { statut: [6, 0.3] }, // SCORCHING_SANDS
  822: { peur: 0.2 }, // FIERY_WRATH
  823: { cible: [[[1], -1, 1]] }, // THUNDEROUS_KICK
  828: { soi: [[[1], 1, 1]] }, // PSYSHIELD_BASH
  831: { cible: [[[0], -1, 0.3]] }, // SPRINGTIDE_STORM
  832: { soi: [[[2], 1, 1]] }, // MYSTICAL_POWER
  834: { recul: 0.33 }, // WAVE_CRASH
  835: { reculPv: 0.5 }, // CHLOROBLAST
  836: { peur: 0.3 }, // MOUNTAIN_GALE
  838: { soi: [[[1, 3], -1, 1]] }, // HEADLONG_RUSH
  839: { statut: [1, 0.5] }, // BARB_BARRAGE
  840: { soi: [[[4], 1, 1]] }, // ESPER_WING
  841: { cible: [[[0], -1, 1]] }, // BITTER_MALICE
  843: { cible: [[[1], -1, 0.5]], peur: 0.3 }, // TRIPLE_ARROWS
  844: { statut: [6, 0.3] }, // INFERNAL_PARADE
  846: { cible: [[[4], -1, 0.3]] }, // BLEAKWIND_STORM
  847: { statut: [3, 0.2] }, // WILDBOLT_STORM
  848: { statut: [6, 0.2] }, // SANDSEAR_STORM
  887: { cible: [[[3], -2, 1]] }, // LUMINA_CRASH
  891: { soi: [[[4], -2, 1]] }, // SPIN_OUT
  898: { statut: [1, 1] }, // MORTAL_SPIN
  903: { soi: [[[2], 1, 1]] }, // TORCH_SONG
  904: { soi: [[[4], 1, 1]] }, // AQUA_STEP
  906: { soi: [[[2], -2, 1]] }, // MAKE_IT_RAIN
  916: { cible: [[[4], -1, 1]] }, // POUNCE
  917: { soi: [[[4], 1, 1]] }, // TRAILBLAZE
  918: { cible: [[[0], -1, 1]] }, // CHILLING_WATER
  922: { soi: [[[1, 3], -1, 1]] }, // ARMOR_CANNON
  923: { drain: 0.5 }, // BITTER_BLADE
  928: { statut: [6, 0.3] }, // BLAZING_TORQUE
  930: { statut: [1, 0.3] }, // NOXIOUS_TORQUE
  931: { statut: [3, 0.3] }, // COMBAT_TORQUE
  934: { drain: 0.5, statut: [6, 0.2] }, // MATCHA_GOTCHA
  950: { peur: 1 }, // UPPER_HAND
  951: { statut: [2, 0.5] }, // MALIGNANT_CHAIN
};
