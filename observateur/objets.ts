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
}

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

/** Valeurs de base, en points comparables d'un objet à l'autre. Réglables. */
export const VALEURS: Readonly<Record<string, number>> = {
  // Expérience (profite à toute la partie)
  EXP_SHARE: 30, EXP_BALANCE: 15, EXP_CHARM: 25, SUPER_EXP_CHARM: 30, GOLDEN_EXP_CHARM: 35,
  LUCKY_EGG: 22, GOLDEN_EGG: 30,
  // Objets tenus
  LEFTOVERS: 28, SHELL_BELL: 22, REVIVER_SEED: 20, FOCUS_BAND: 15, MULTI_LENS: 15, EVIOLITE: 15,
  QUICK_CLAW: 12, KINGS_ROCK: 12, SCOPE_LENS: 12, WIDE_LENS: 10, WHITE_HERB: 8, SOUL_DEW: 8,
  SPECIES_STAT_BOOSTER: 10, RARE_SPECIES_STAT_BOOSTER: 14, MYSTICAL_ROCK: 6, GRIP_CLAW: 5,
  SOOTHE_BELL: 3, LEEK: 3, BATON: 3, TOXIC_ORB: 2, FLAME_ORB: 2, BERRY: 10,
  // Toute l'équipe
  CATCHING_CHARM: 18, HEALING_CHARM: 15, OVAL_CHARM: 10, BERRY_POUCH: 8, CANDY_JAR: 6,
  // Argent
  RELIC_GOLD: 15, AMULET_COIN: 15, BIG_NUGGET: 12, NUGGET: 8, COIN_CASE: 8, GOLDEN_PUNCH: 5,
  // Combat en cours
  TEMP_STAT_STAGE_BOOSTER: 6, DIRE_HIT: 6,
  // Divers
  MAP: 5, IV_SCANNER: 4, MEMORY_MUSHROOM: 5, MINT: 4, TERA_SHARD: 4, ABILITY_CHARM: 3,
  LOCK_CAPSULE: 3, SHINY_CHARM: 2, LURE: 2, SUPER_LURE: 2, MAX_LURE: 2,
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
    const r = meilleurReceveur(objet, ctx, m => {
      if (m.ko) {
        return 0;
      }
      return tempsDuPorteur ? (m === porteur ? 18 : 4) : 14 * (1.5 - importance(m, equipe));
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

  const base = VALEURS[objet.id];
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
    const j = juger(objet, ctx);
    return { index, nom: objet.nom, note: Math.round(j.note * 10) / 10, cible: j.cible, pour: j.pour, contre: j.contre };
  });
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
export const SEUIL_ACHAT = 8;

/**
 * Les articles de la boutique, notés comme les récompenses, moins leur prix rapporté à l'argent
 * disponible. Un humain achète des Potions quand un membre important est blessé, surtout juste
 * avant le rival ou un champion ; il ne gaspille pas son argent quand tout le monde va bien.
 */
export function evaluerAchats(objets: ObjetPropose[], ctx: ContexteObjets, argent: number): OptionObjet[] {
  // Réserve : de quoi acheter un Rappel, pour ranimer le porteur s'il tombe. Remarque de Carlos
  // (01/10) : « morte vague 66, plus d'argent pour ranimer le porteur (Zacian) ». La boutique
  // vend un Rappel dès la vague 1 ; les soins ordinaires ne doivent pas entamer cette réserve.
  // Pas en début de partie (l'argent est rare et les Potions comptent), ni à la veille d'un combat
  // important (on soigne d'abord) : à partir de la vague 30.
  const rappels = objets.filter(o => RAPPELS.has(o.id)).map(o => o.cout);
  const combat = ctx.prochainCombat;
  const vague = combat ? combat.vague - combat.dans : 0;
  const reserve = rappels.length && vague >= 30 && urgenceSoin(combat) === 1 ? Math.min(...rappels) : 0;
  return objets.map((objet, index) => {
    if (!ACHETABLES.has(objet.id)) {
      return { index, nom: objet.nom, note: 0, cible: null, pour: [], contre: ["pas utile à acheter ici"] };
    }
    if (objet.cout > argent) {
      return { index, nom: objet.nom, note: -1, cible: null, pour: [], contre: [`trop cher (${objet.cout} ₽, il reste ${argent} ₽)`] };
    }
    const j = juger(objet, ctx);
    const entame = !RAPPELS.has(objet.id) && objet.id !== "SACRED_ASH" && objet.id !== "FULL_HEAL" && argent - objet.cout < reserve;
    const note = j.note - 4 * (objet.cout / Math.max(argent, 1)) - (entame ? 15 : 0);
    return {
      index,
      nom: objet.nom,
      note: Math.round(note * 10) / 10,
      cible: j.cible,
      pour: j.pour,
      contre: [...j.contre, `coûte ${objet.cout} ₽ sur ${argent}`, ...(entame ? [`entamerait la réserve pour un Rappel (${reserve} ₽)`] : [])],
    };
  });
}

/** Le meilleur achat, ou null si aucun ne vaut son prix. */
export function meilleurAchat(options: OptionObjet[]): OptionObjet | null {
  const meilleure = options.reduce<OptionObjet | null>((m, o) => (!m || o.note > m.note ? o : m), null);
  return meilleure && meilleure.note >= SEUIL_ACHAT ? meilleure : null;
}
