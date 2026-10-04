/**
 * Note des objets : quelle récompense prendre après une vague, et à qui la donner (idée de
 * Carlos : « faire pareil pour les objets »).
 *
 * Chaque objet proposé est jugé d'après l'état de l'équipe, pas dans l'absolu :
 *   - une Potion vaut selon les PV qui manquent (0 si tout le monde est en pleine forme) ;
 *   - un Rappel vaut beaucoup si quelqu'un est K.O., rien sinon ;
 *   - une CT vaut ce qu'elle améliore la note de synergie des attaques du meilleur receveur ;
 *   - un objet de type (Charbon…) vaut selon qui porte des attaques de ce type ;
 *   - une Poké Ball vaut plus quand l'équipe n'est pas pleine et que le stock est bas ;
 *   - un objet refusé par le jeu (aucun Pokémon compatible) est écarté : fini les « bonus
 *     inutilisables » essayés en boucle ;
 *   - soins et Rappels valent plus juste avant un combat important (rival, champion…) : un humain
 *     se soigne avant le boss. L'analyse des défaites l'a confirmé : au boss de la vague 20, les
 *     équipes qui perdent arrivent avec 62 % de PV, celles qui gagnent avec 86 %.
 * Le meilleur receveur est désigné parmi ceux que le jeu accepte (filtre du jeu), en privilégiant
 * les membres les plus avancés. Les valeurs de base (VALEURS) sont un point de départ réglable.
 * Une formule lisible, en attendant que le cerveau apprenne lui-même à choisir ses récompenses.
 */
import type { CombatImportant } from "./combats";
import type { Membre } from "./equipe";
import { PokeballType, PokemonType } from "./noms";
import { type AttaqueNotee, evaluerApprentissage, meilleureOption, noterJeu } from "./synergie";

export interface ObjetPropose {
  /** Identifiant du jeu (POTION, TM_ULTRA, ATTACK_TYPE_BOOSTER…), stable même sur le site en ligne. */
  id: string;
  nom: string;
  /** 0 pour une récompense gratuite, le prix en boutique sinon. */
  cout: number;
  soin?: { points: number; pourcent: number; statut: boolean };
  ranime?: { pourcent: number };
  pp?: number;
  ball?: { type: number; nombre: number };
  ct?: AttaqueNotee;
  boosterType?: { type: number };
  /** Statistique renforcée par une vitamine (0 PV … 5 Vitesse). */
  vitamine?: number;
  /** Places de l'équipe que le jeu accepte pour cet objet ; absent = objet sans receveur. */
  ciblesPossibles?: number[];
}

export interface MembreObjets extends Membre {
  pv: number;
  pvMax: number;
  ko: boolean;
  /** Empoisonné, paralysé… */
  statut: boolean;
  /** PP restants / PP max, par attaque. */
  ppRatios: number[];
}

export interface ContexteObjets {
  equipe: MembreObjets[];
  /** Balls en stock, par type (Poké, Super, Hyper, Rogue, Master). */
  balls: number[];
  /** Le prochain combat important, compté depuis la vague qui suit ces récompenses. */
  prochainCombat?: CombatImportant;
  /** Types à préparer avant le rival (combats.ts, typesAPreparer), ou absent. */
  typesAPreparer?: number[] | undefined;
  /** Plafond de niveau du moment (le jeu le relève toutes les 10 vagues), ou absent. */
  plafondNiveau?: number | undefined;
  /** L'argent du joueur, ou absent. */
  argent?: number | undefined;
  /** Prix de base de la boutique : l'argent d'une vague, ce que rapporte une Pépite (Potion = 0,2 × ce prix). */
  prixBase?: number | undefined;
  /** Prix des articles de la boutique affichée (identifiant → prix), ou absent. */
  prixBoutique?: Record<string, number> | undefined;
  /** Un membre de l'équipe peut se Méga-évoluer / se Gigamaxer (forme connue du Pokédex). */
  formesSpeciales?: { mega: boolean; gigamax: boolean } | undefined;
}

const OBJETS_EXPERIENCE = new Set(["EXP_CHARM", "SUPER_EXP_CHARM", "GOLDEN_EXP_CHARM", "LUCKY_EGG", "GOLDEN_EGG"]);
/**
 * Multi Exp et Équilibreur d'Exp : l'expérience des membres qui ne combattent pas. Diagnostic du
 * 03/10 : le banc restait 5 à 12 niveaux sous le porteur jusqu'au milieu de partie ; avec 5 Multi
 * Exp donnés au départ, tout le banc suit le porteur et la moyenne s'envole. Leur valeur dépend du
 * retard du banc, pas des Charmes déjà possédés.
 */
const OBJETS_PARTAGE = new Set(["EXP_SHARE", "EXP_BALANCE"]);

/** Part du banc (tous sauf le plus avancé) encore à 3 niveaux ou plus sous le plafond. */
function partBancEnRetard(ctx: ContexteObjets): number {
  const vivants = ctx.equipe.filter(m => !m.ko).sort((a, b) => b.niveau - a.niveau).slice(1);
  if (!vivants.length) {
    return 0;
  }
  const plafond = ctx.plafondNiveau ?? Infinity;
  return vivants.filter(m => m.niveau < plafond - 3).length / vivants.length;
}

/**
 * Part de l'équipe que l'expérience peut encore faire monter. En fin de partie, l'équipe est au
 * plafond de niveau (vagues 101-110 : niveau 94) : le bot empilait pourtant les Charmes Exp (jusqu'à
 * 10 Charmes et 5 Super Charmes à la vague 110) au lieu d'objets de combat.
 */
function partSousPlafond(ctx: ContexteObjets): number {
  const vivants = ctx.equipe.filter(m => !m.ko);
  if (!ctx.plafondNiveau || !vivants.length) {
    return 1;
  }
  return vivants.filter(m => m.niveau < ctx.plafondNiveau! - 3).length / vivants.length;
}

/**
 * Ce que vaut encore un objet d'expérience : peu quand l'équipe est au plafond de niveau. Pas de
 * rendement décroissant avec les Charmes déjà possédés : ils multiplient aussi l'expérience que le
 * Multi Exp donne au banc, qui reste 5 à 12 niveaux sous le plafond jusqu'au milieu de partie
 * (banc apparié, 03/10).
 */
function valeurExperience(ctx: ContexteObjets): number {
  return 0.2 + 0.8 * partSousPlafond(ctx);
}

/**
 * Ce que vaut une somme d'argent, en points comparables aux objets. Unité : l'argent d'une vague
 * (le prix de base de la boutique, ce que rapporte une Pépite : 5 Potions, ou un demi-Rappel).
 * Remarque de Carlos (04/10) : « il prend la Potion gratuite alors que s'il prend la Pépite et paye
 * la Potion, il y gagne ». L'argent sert à ranimer et soigner avant les combats difficiles (sa
 * partie s'est finie faute d'argent pour ranimer contre un dresseur) ; au-delà d'une bonne réserve,
 * il vaut moins.
 */
export function valeurArgent(montant: number, ctx: ContexteObjets): number {
  const base = ctx.prixBase ?? 0;
  if (base <= 0) {
    return 0;
  }
  const u = montant / base;
  const points = u <= 3 ? 10 * u : 30 + 4 * (u - 3);
  const reserve = (ctx.argent ?? 0) / base;
  return points * (reserve < 4 ? 1.3 : reserve > 8 ? 0.6 : 1);
}

/** Argent rapporté par une Pépite (×1), une Grosse Pépite (×2,5) ou une Relique d'Or (×10). */
const PEPITES: Readonly<Record<string, number>> = { NUGGET: 1, BIG_NUGGET: 2.5, RELIC_GOLD: 10 };

/** Combien un soin compte de plus avant un combat important : la vague suivante, ou celle d'après. */
export function urgenceSoin(combat: CombatImportant | undefined): number {
  return combat?.dans === 0 ? 1.8 : combat?.dans === 1 ? 1.4 : 1;
}

const avant = (combat: CombatImportant | undefined) =>
  combat && urgenceSoin(combat) > 1 ? [`avant : ${combat.nom} (vague ${combat.vague})`] : [];

export interface OptionObjet {
  /** Position de l'objet parmi ceux proposés. */
  index: number;
  nom: string;
  note: number;
  /** Place du receveur dans l'équipe, ou null (objet pour toute l'équipe). */
  cible: number | null;
  pour: string[];
  contre: string[];
}

/**
 * Valeurs de base, en points comparables d'un objet à l'autre. Réglables.
 * Revues le 03/10 avec le classement de la communauté (roonby.com, « PokéRogue item tier list ») :
 * rang S — Pièce Rune, Poche à Baies, Méga-Gourmette (et pierres), Restes, Roche Royale ; rang A —
 * Lentille Zoom, Ceinture Force, Poing d'Or, Griffe Accroche, Bracelet Dynamax. La Méga-Gourmette et
 * le Bracelet Dynamax manquaient (valeur par défaut 5) : le bot ne les prenait presque jamais.
 */
export const VALEURS: Readonly<Record<string, number>> = {
  // Évolutions de combat (clés : Méga-Évolution, Gigamax) et leurs pierres
  MEGA_BRACELET: 35, DYNAMAX_BAND: 25, FORM_CHANGE_ITEM: 30, RARE_FORM_CHANGE_ITEM: 30, TERA_ORB: 10,
  // Expérience (profite à toute la partie)
  EXP_SHARE: 40, EXP_BALANCE: 20, EXP_CHARM: 25, SUPER_EXP_CHARM: 30, GOLDEN_EXP_CHARM: 35,
  LUCKY_EGG: 22, GOLDEN_EGG: 30,
  // Objets tenus
  LEFTOVERS: 28, SHELL_BELL: 22, REVIVER_SEED: 20, FOCUS_BAND: 18, MULTI_LENS: 15, EVIOLITE: 15,
  QUICK_CLAW: 12, KINGS_ROCK: 20, SCOPE_LENS: 12, WIDE_LENS: 14, WHITE_HERB: 8, SOUL_DEW: 8,
  SPECIES_STAT_BOOSTER: 10, RARE_SPECIES_STAT_BOOSTER: 14, MYSTICAL_ROCK: 6, GRIP_CLAW: 8,
  SOOTHE_BELL: 3, LEEK: 3, BATON: 3, TOXIC_ORB: 2, FLAME_ORB: 2, BERRY: 10,
  // Toute l'équipe
  CATCHING_CHARM: 18, HEALING_CHARM: 15, OVAL_CHARM: 10, BERRY_POUCH: 20, CANDY_JAR: 6,
  // Argent
  RELIC_GOLD: 15, AMULET_COIN: 20, BIG_NUGGET: 12, NUGGET: 8, COIN_CASE: 8, GOLDEN_PUNCH: 8,
  // Combat en cours
  TEMP_STAT_STAGE_BOOSTER: 6, DIRE_HIT: 6,
  // Divers
  MAP: 5, IV_SCANNER: 4, MEMORY_MUSHROOM: 5, MINT: 4, TERA_SHARD: 4, ABILITY_CHARM: 3,
  LOCK_CAPSULE: 3, SHINY_CHARM: 2,
  // Leurres : plus de combats doubles, donc plus de membres exposés. Mesuré le 03/10 (banc apparié) :
  // les prendre volontiers coûte 17 vagues ; Carlos (04/10) : « mauvais dans la majorité des cas ».
  LURE: 0, SUPER_LURE: 0, MAX_LURE: 0,
};
const VALEUR_INCONNUE = 5;
/** Jusqu'à ce niveau, les Super Bonbons vont au porteur de l'équipe (son meilleur Pokémon). */
const NIVEAU_PORTEUR = 40;

const SOINS = new Set(["POTION", "SUPER_POTION", "HYPER_POTION", "MAX_POTION", "FULL_RESTORE"]);
const RAPPELS = new Set(["REVIVE", "MAX_REVIVE"]);
const PP = new Set(["ETHER", "MAX_ETHER", "ELIXIR", "MAX_ELIXIR"]);
const BALLS = new Set(["POKEBALL", "GREAT_BALL", "ULTRA_BALL", "ROGUE_BALL", "MASTER_BALL"]);
const CT = new Set(["TM_COMMON", "TM_GREAT", "TM_ULTRA"]);
const EVOLUTION = new Set(["EVOLUTION_ITEM", "RARE_EVOLUTION_ITEM"]);

/** Importance d'un membre : les plus avancés comptent plus (ils portent la partie). */
function importance(m: MembreObjets, equipe: MembreObjets[]): number {
  return m.niveau / Math.max(...equipe.map(e => e.niveau), 1);
}

interface Jugement {
  note: number;
  cible: number | null;
  pour: string[];
  contre: string[];
}

const rien = (raison: string): Jugement => ({ note: 0, cible: null, pour: [], contre: [raison] });

/** Le receveur qui maximise `valeur` parmi les places permises. */
function meilleurReceveur(
  objet: ObjetPropose,
  ctx: ContexteObjets,
  valeur: (m: MembreObjets, place: number) => number,
): { place: number; valeur: number } | null {
  const places = objet.ciblesPossibles ?? ctx.equipe.map((_, i) => i);
  let meilleur: { place: number; valeur: number } | null = null;
  for (const place of places) {
    const m = ctx.equipe[place];
    if (!m) {
      continue;
    }
    const v = valeur(m, place);
    if (!meilleur || v > meilleur.valeur) {
      meilleur = { place, valeur: v };
    }
  }
  return meilleur;
}

function juger(objet: ObjetPropose, ctx: ContexteObjets): Jugement {
  const equipe = ctx.equipe;
  // Le jeu refuse cet objet à tout le monde : le prendre ne mènerait qu'à un refus.
  if (objet.ciblesPossibles && objet.ciblesPossibles.length === 0) {
    return { note: -1, cible: null, pour: [], contre: ["aucun Pokémon de l'équipe ne peut le recevoir"] };
  }

  if (SOINS.has(objet.id) && objet.soin) {
    const soin = objet.soin;
    const r = meilleurReceveur(objet, ctx, m => {
      if (m.ko) {
        return 0;
      }
      const rendus = Math.min(m.pvMax - m.pv, soin.points + (soin.pourcent / 100) * m.pvMax) / m.pvMax;
      return (45 * rendus + (soin.statut && m.statut ? 10 : 0)) * importance(m, equipe);
    });
    if (!r || r.valeur <= 0) {
      return rien("tout le monde est en pleine forme");
    }
    const m = equipe[r.place]!;
    return {
      note: r.valeur * urgenceSoin(ctx.prochainCombat),
      cible: r.place,
      pour: [`soigne ${m.nom} (${m.pv}/${m.pvMax} PV)`, ...avant(ctx.prochainCombat)],
      contre: [],
    };
  }

  if (RAPPELS.has(objet.id) || objet.id === "SACRED_ASH") {
    const ko = equipe.filter(m => m.ko);
    if (!ko.length) {
      return rien("personne n'est K.O.");
    }
    const urgence = urgenceSoin(ctx.prochainCombat);
    if (objet.id === "SACRED_ASH") {
      return {
        note: ko.reduce((n, m) => n + 60 * importance(m, equipe), 0) * urgence,
        cible: null,
        pour: [`ranime ${ko.map(m => m.nom).join(", ")}`, ...avant(ctx.prochainCombat)],
        contre: [],
      };
    }
    const r = meilleurReceveur(objet, ctx, m => (m.ko ? 60 * importance(m, equipe) : 0))!;
    return { note: r.valeur * urgence, cible: r.place, pour: [`ranime ${equipe[r.place]!.nom}`, ...avant(ctx.prochainCombat)], contre: [] };
  }

  if (PP.has(objet.id)) {
    const r = meilleurReceveur(objet, ctx, m => (1 - Math.min(...m.ppRatios, 1)) * 25 * importance(m, equipe));
    if (!r || r.valeur < 5) {
      return rien("les attaques ont encore assez de PP");
    }
    return { note: r.valeur, cible: r.place, pour: [`recharge les PP de ${equipe[r.place]!.nom}`], contre: [] };
  }

  if (BALLS.has(objet.id) && objet.ball) {
    if (objet.ball.type === 4) {
      return { note: 25, cible: null, pour: ["Master Ball : capture assurée d'un boss ou d'un rare"], contre: [] };
    }
    const stock = ctx.balls.reduce((a, b) => a + b, 0);
    const pleine = equipe.length >= 6;
    // Équipe pleine : une capture ne sert plus qu'à remplacer un membre ; les objets durables
    // (objets tenus, CT, vitamines) valent mieux que des Balls.
    const note = 4 * objet.ball.nombre * (pleine ? 0.2 : 1.5) * (stock < 5 ? 1.5 : 1) * (objet.ball.type >= 1 ? 1.3 : 1);
    return {
      note,
      cible: null,
      pour: [
        `${objet.ball.nombre} ${PokeballType[objet.ball.type]?.fr ?? "Ball"}${stock < 5 ? " (stock bas)" : ""}`,
        ...(pleine ? [] : ["l'équipe n'est pas encore complète"]),
      ],
      contre: pleine ? ["l'équipe est déjà pleine"] : [],
    };
  }

  if (objet.id === "RARE_CANDY" || objet.id === "RARER_CANDY") {
    if (objet.id === "RARER_CANDY") {
      return { note: 14 * equipe.filter(m => !m.ko).length * 0.6, cible: null, pour: ["+1 niveau pour toute l'équipe"], contre: [] };
    }
    // Stratégie du porteur (guides de la communauté) : concentrer les niveaux sur le meilleur
    // Pokémon jusqu'au niveau 40, il fait l'essentiel du travail ; ensuite, aider ceux en retard.
    const porteur = equipe.reduce((a, b) => (b.niveau > a.niveau && !b.ko ? b : a), equipe[0]!);
    const tempsDuPorteur = porteur.niveau < NIVEAU_PORTEUR;
    // Un rival dans 8 vagues ou moins : chaque niveau du porteur compte énormément. Mesuré au rival 1
    // (02/10, 1 919 parties) : porteur niveau 6 → 15 % de défaites, 7 → 5 %, 8 → 2 %, 9 → 1 %. Le
    // bot préférait 5 Poké Balls (note 30 à 45) au Super Bonbon (18).
    const rivalProche = ctx.prochainCombat?.genre === "rival" && ctx.prochainCombat.dans <= 8;
    const noteBonbonPorteur = rivalProche ? 50 : 18;
    const r = meilleurReceveur(objet, ctx, m => {
      if (m.ko) {
        return 0;
      }
      return tempsDuPorteur ? (m === porteur ? noteBonbonPorteur : 4) : 14 * (1.5 - importance(m, equipe));
    })!;
    const pourquoi = tempsDuPorteur && equipe[r.place] === porteur ? " (le porteur de l'équipe)" : "";
    return { note: r.valeur, cible: r.place, pour: [`+1 niveau pour ${equipe[r.place]!.nom}${pourquoi}`], contre: [] };
  }

  if (CT.has(objet.id) && objet.ct) {
    const ct = objet.ct;
    const r = meilleurReceveur(objet, ctx, m => {
      const porteur = { types: m.types, stats: m.stats };
      if (m.attaques.some(a => a.nom === ct.nom)) {
        return 0;
      }
      const prep = ctx.typesAPreparer;
      const actuelle = noterJeu(m.attaques, porteur, undefined, prep);
      const apres = m.attaques.length < 4
        ? noterJeu([...m.attaques, ct], porteur, undefined, prep)
        : meilleureOption(evaluerApprentissage(porteur, m.attaques, ct, undefined, prep)).note;
      return Math.max(0, apres - actuelle) * 0.8 * importance(m, equipe);
    });
    if (!r || r.valeur <= 0) {
      return rien(`${ct.nom} n'améliore les attaques de personne`);
    }
    return { note: r.valeur, cible: r.place, pour: [`${ct.nom} renforce le jeu d'attaques de ${equipe[r.place]!.nom}`], contre: [] };
  }

  if (objet.id === "ATTACK_TYPE_BOOSTER" && objet.boosterType) {
    const type = objet.boosterType.type;
    const r = meilleurReceveur(objet, ctx, m => {
      const concernees = m.attaques.filter(a => a.type === type && a.puissance > 0).length;
      return concernees ? 20 * (m.types.includes(type) ? 1.3 : 1) * importance(m, equipe) : 0;
    });
    if (!r || r.valeur <= 0) {
      return rien(`personne n'a d'attaque de type ${PokemonType[type]?.fr ?? type}`);
    }
    return { note: r.valeur, cible: r.place, pour: [`renforce les attaques ${PokemonType[type]?.fr} de ${equipe[r.place]!.nom}`], contre: [] };
  }

  if (objet.id === "BASE_STAT_BOOSTER" && objet.vitamine !== undefined) {
    const stat = objet.vitamine;
    const r = meilleurReceveur(objet, ctx, m => {
      // Attaque : pour un attaquant physique ; Attaque Spé. : pour un spécial ; le reste : pour tous.
      const physique = (m.stats[1] ?? 0) >= (m.stats[3] ?? 0);
      const utile = stat === 1 ? physique : stat === 3 ? !physique : true;
      return utile ? 12 * importance(m, equipe) : 3;
    })!;
    return { note: r.valeur, cible: r.place, pour: [`renforce ${equipe[r.place]!.nom}`], contre: [] };
  }

  if (EVOLUTION.has(objet.id)) {
    // Le jeu ne l'accepte que pour un Pokémon qui peut évoluer avec : ciblesPossibles l'a vérifié.
    if (!objet.ciblesPossibles) {
      return rien("aucun Pokémon ne peut évoluer avec");
    }
    const r = meilleurReceveur(objet, ctx, m => 50 * importance(m, equipe))!;
    return { note: r.valeur, cible: r.place, pour: [`fait évoluer ${equipe[r.place]!.nom}`], contre: [] };
  }

  if (objet.id === "FULL_HEAL") {
    // Le plus important des membres empoisonnés, brûlés, paralysés…
    const r = meilleurReceveur(objet, ctx, m => (m.statut && !m.ko ? 22 * importance(m, equipe) : 0));
    return r && r.valeur > 0
      ? {
          note: r.valeur * urgenceSoin(ctx.prochainCombat),
          cible: r.place,
          pour: [`guérit ${equipe[r.place]!.nom}`, ...avant(ctx.prochainCombat)],
          contre: [],
        }
      : rien("personne n'a de problème de statut");
  }

  // Objets X (un cran de stat pendant quelques combats) : décisifs contre le Conseil 4, le Maître et
  // Éthernatos (guides : gameleap, « X items aux vagues 190-200 ») ; peu utiles avant.
  const combat = ctx.prochainCombat;
  const vagueCourante = combat ? combat.vague - combat.dans : 0;
  if ((objet.id === "TEMP_STAT_STAGE_BOOSTER" || objet.id === "DIRE_HIT") && vagueCourante >= 170) {
    return { note: 20, cible: null, pour: ["fin de partie : un cran de stat pour les derniers combats"], contre: [] };
  }
  // Pépites : de l'argent, selon la réserve (voir valeurArgent).
  if (PEPITES[objet.id] !== undefined && ctx.prixBase) {
    return { note: valeurArgent(PEPITES[objet.id]! * ctx.prixBase, ctx), cible: null, pour: ["de l'argent pour ranimer et soigner avant les combats difficiles"], contre: [] };
  }
  // Bonbonnière : chaque Super Bonbon donne un niveau de plus par Bonbonnière, au-delà du plafond.
  // Très forte en début de partie (Carlos, 04/10 : il en avait laissé passer deux vers la vague 20).
  if (objet.id === "CANDY_JAR") {
    return { note: 10 + 25 * Math.max(0, 1 - vagueCourante / 150), cible: null, pour: ["chaque Super Bonbon donnera un niveau de plus"], contre: [] };
  }
  // Méga-Gourmette, Bracelet Dynamax : utiles seulement si un membre a une Méga-Évolution ou une
  // forme Gigamax (Carlos, 04/10 : il a préféré une CT au Bracelet Dynamax).
  if (objet.id === "MEGA_BRACELET" || objet.id === "DYNAMAX_BAND") {
    const utile = objet.id === "MEGA_BRACELET" ? ctx.formesSpeciales?.mega : ctx.formesSpeciales?.gigamax;
    return utile
      ? { note: 45, cible: null, pour: ["un membre de l'équipe peut s'en servir"], contre: [] }
      : { note: 6, cible: null, pour: [], contre: ["personne dans l'équipe ne peut s'en servir pour l'instant"] };
  }
  const base0 = VALEURS[objet.id];
  // L'expérience ne vaut que pour les membres encore sous le plafond de niveau.
  const base = base0 === undefined ? undefined
    : OBJETS_EXPERIENCE.has(objet.id) ? base0 * valeurExperience(ctx)
      : OBJETS_PARTAGE.has(objet.id) ? base0 * (0.2 + 0.8 * partBancEnRetard(ctx)) : base0;
  if (base === undefined) {
    return { note: VALEUR_INCONNUE, cible: null, pour: [], contre: ["effet mal connu du pilote"] };
  }
  // Objet tenu ou utile à un seul : au membre le plus avancé que le jeu accepte.
  const r = objet.ciblesPossibles ? meilleurReceveur(objet, ctx, m => importance(m, equipe)) : null;
  return { note: base, cible: r?.place ?? null, pour: [], contre: [] };
}

/** Toutes les récompenses proposées, notées, avec leur receveur et leurs pour et contre. */
export function evaluerObjets(objets: ObjetPropose[], ctx: ContexteObjets): OptionObjet[] {
  return objets.map((objet, index) => {
    const j = plafonnerParPrix(objet, juger(objet, ctx), ctx);
    return { index, nom: objet.nom, note: Math.round(j.note * 10) / 10, cible: j.cible, pour: j.pour, contre: j.contre };
  });
}

/**
 * Un soin, un Rappel ou des PP gratuits que la boutique vend aussi, et qu'on peut payer : ils ne
 * valent pas plus que leur prix. Prendre la Pépite et acheter la Potion rapporte plus (une Pépite =
 * 5 Potions). Sans boutique (vagues 10, 20…) ou trop cher, ils gardent leur valeur.
 */
function plafonnerParPrix(objet: ObjetPropose, j: Jugement, ctx: ContexteObjets): Jugement {
  const prix = ctx.prixBoutique?.[objet.id];
  if (objet.cout > 0 || prix === undefined || prix > (ctx.argent ?? 0) || j.note <= 0) {
    return j;
  }
  const plafond = valeurArgent(prix, ctx);
  return j.note <= plafond ? j : { ...j, note: plafond, contre: [...j.contre, `la boutique le vend ${prix} ₽ : mieux vaut prendre autre chose et l'acheter`] };
}

/** La meilleure récompense, ou null s'il vaut mieux passer (rien d'utile, ou tout refusé). */
export function meilleurObjet(options: OptionObjet[]): OptionObjet | null {
  const meilleure = options.reduce<OptionObjet | null>((m, o) => (!m || o.note > m.note ? o : m), null);
  return meilleure && meilleure.note > 0 ? meilleure : null;
}

// ─── Boutique ─────────────────────────────────────────────────────────────────────────────────

/** Ce que la boutique vend d'utile pour l'équipe : soins, Rappels, PP. */
const ACHETABLES = new Set([...SOINS, ...RAPPELS, ...PP, "SACRED_ASH", "FULL_HEAL"]);
/** Note minimale (une fois le prix déduit) pour qu'un achat vaille la peine. */
export const SEUIL_ACHAT = 5;

/**
 * Les articles de la boutique, notés comme les récompenses, moins leur prix rapporté à l'argent
 * disponible. Un humain achète des Potions quand un membre important est blessé, surtout juste
 * avant le rival ou un champion ; il ne gaspille pas son argent quand tout le monde va bien.
 */
export function evaluerAchats(objets: ObjetPropose[], ctx: ContexteObjets, argent: number): OptionObjet[] {
  // Remarques de Carlos (01/10, 04/10) : « morte vague 66, plus d'argent pour ranimer le porteur » ;
  // « il achète quand ce n'est pas nécessaire et dépense trop sur des Pokémon plus faibles ; il
  // devrait économiser pour les moments difficiles, pas quand il faut juste battre un Pokémon ».
  // Donc : à la veille d'un combat important (rival, champion, boss…), on soigne et on ranime ce qu'il
  // faut ; sinon, seulement le porteur (ou un membre de son niveau) mal en point, et on garde de quoi
  // acheter deux Rappels. Le jeu soigne et ranime d'ailleurs toute l'équipe à chaque nouveau biome.
  const ctxArgent = { ...ctx, argent };
  const rappels = objets.filter(o => RAPPELS.has(o.id)).map(o => o.cout);
  const combat = ctx.prochainCombat;
  const vague = combat ? combat.vague - combat.dans : 0;
  const urgent = urgenceSoin(combat) > 1;
  const reserve = rappels.length && vague >= 10 && !urgent ? 2 * Math.min(...rappels) : 0;
  const niveauMax = Math.max(...ctx.equipe.map(m => m.niveau), 1);
  return objets.map((objet, index) => {
    if (!ACHETABLES.has(objet.id)) {
      return { index, nom: objet.nom, note: 0, cible: null, pour: [], contre: ["pas utile à acheter ici"] };
    }
    if (objet.cout > argent) {
      return { index, nom: objet.nom, note: -1, cible: null, pour: [], contre: [`trop cher (${objet.cout} ₽, il reste ${argent} ₽)`] };
    }
    const j = juger(objet, ctx);
    const m = j.cible === null ? null : ctx.equipe[j.cible];
    const important = !m || m.niveau >= 0.85 * niveauMax;
    const malEnPoint = !m || m.ko || m.pv < 0.5 * m.pvMax || m.statut;
    if (!urgent && (!important || !malEnPoint)) {
      return { index, nom: objet.nom, note: 0, cible: j.cible, pour: j.pour, contre: [...j.contre, "pas urgent : on garde l'argent pour les combats difficiles"] };
    }
    const entame = !RAPPELS.has(objet.id) && argent - objet.cout < reserve;
    const note = j.note - valeurArgent(objet.cout, ctxArgent) - (entame ? 15 : 0);
    return {
      index,
      nom: objet.nom,
      note: Math.round(note * 10) / 10,
      cible: j.cible,
      pour: j.pour,
      contre: [...j.contre, `coûte ${objet.cout} ₽ sur ${argent}`, ...(entame ? [`entamerait la réserve pour deux Rappels (${reserve} ₽)`] : [])],
    };
  });
}

/** Le meilleur achat, ou null si aucun ne vaut son prix. */
export function meilleurAchat(options: OptionObjet[]): OptionObjet | null {
  const meilleure = options.reduce<OptionObjet | null>((m, o) => (!m || o.note > m.note ? o : m), null);
  return meilleure && meilleure.note >= SEUIL_ACHAT ? meilleure : null;
}
