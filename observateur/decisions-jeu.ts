/**
 * Adaptateurs : traduisent ce que le jeu affiche en données pour les notes d'équipe
 * (observateur/equipe.ts) et d'objets (observateur/objets.ts).
 *
 * - Récompenses après une vague : les objets proposés, et pour chacun les Pokémon que le jeu
 *   accepte (son propre filtre, celui qui affiche « ça n'aura aucun effet ») ; et la boutique.
 * - Capture avec l'équipe pleine : l'équipe actuelle et le Pokémon qui vient d'être capturé.
 */
import { prochainCombatImportant, typesAPreparer } from "./combats";
import { evaluerArrivee, type OptionEquipe } from "./equipe";
import type { AttaqueJeu, MoveJeu, PokemonJeu, ScenePokerogue } from "./jeu";
import {
  type ContexteObjets,
  evaluerAchats,
  evaluerObjets,
  type MembreObjets,
  type ObjetPropose,
  type OptionObjet,
} from "./objets";
import type { AttaqueNotee } from "./synergie";
import { ECRAN } from "./valeurs";

const versNotee = (m: MoveJeu): AttaqueNotee => ({
  nom: m.name, type: m.type, categorie: m.category, puissance: m.power, precision: m.accuracy,
});

export function membreDe(p: PokemonJeu): MembreObjets {
  const attaques = p.getMoveset();
  return {
    nom: p.name,
    espece: p.species.speciesId,
    niveau: p.level,
    types: p.getTypes(),
    stats: [0, 1, 2, 3, 4, 5].map(s => p.getStat(s)),
    attaques: attaques.map(a => versNotee(a.getMove())),
    pv: p.hp,
    pvMax: p.getMaxHp(),
    ko: p.isFainted(),
    statut: !p.isFainted() && (p.status?.effect ?? 0) !== 0,
    ppRatios: attaques.map(a => (a.getMovePp() > 0 ? (a.getMovePp() - a.ppUsed) / a.getMovePp() : 1)),
  };
}

// ─── Capture avec l'équipe pleine ─────────────────────────────────────────────────────────────

/**
 * Si le jeu demande quoi faire du Pokémon capturé alors que l'équipe est pleine (fenêtre à 4
 * choix : résumé, Pokédex, relâcher un membre, ne pas le garder), les options notées ; sinon null.
 */
export function optionsEquipePleineAffichees(scene: ScenePokerogue): OptionEquipe[] | null {
  const phase = scene.phaseManager.getCurrentPhase();
  // Pendant une capture en combat, ou dans une rencontre mystère qui donne un Pokémon (Zone Safari…).
  const rencontre = phase?.phaseName?.startsWith("MysteryEncounter") ?? false;
  if ((phase?.phaseName !== "AttemptCapturePhase" && !rencontre) || scene.ui.getMode() !== ECRAN.CONFIRM) {
    return null;
  }
  const ecran = scene.ui.getHandler() as { config?: { options?: unknown[] } } | null;
  if ((ecran?.config?.options?.length ?? 0) <= 2) {
    return null; // une simple question oui/non, pas le choix de l'équipe pleine
  }
  const arrivant = rencontre ? scene.getEnemyField()[0] : phase?.getPokemon?.();
  return arrivant
    ? evaluerArrivee(scene.getPlayerParty().map(membreDe), membreDe(arrivant), typesAPreparer(scene.currentBattle?.waveIndex ?? 0))
    : null;
}

// ─── Récompenses après une vague ──────────────────────────────────────────────────────────────

/** Ce qu'on lit d'un objet du jeu (propriétés présentes selon sa catégorie). */
interface TypeObjetJeu {
  id?: string;
  /** Clé de traduction, ex. « modifierType:ModifierType.POTION ». */
  localeKey?: string;
  name?: string;
  /** null = l'objet peut être donné à ce Pokémon ; un message sinon. */
  selectFilter?: (pokemon: PokemonJeu) => string | null;
  restorePoints?: number;
  restorePercent?: number;
  healStatus?: boolean;
  pokeballType?: number;
  count?: number;
  moveId?: number;
  moveType?: number;
  stat?: number;
}

type OptionAffichee = { modifierTypeOption?: { type?: TypeObjetJeu; cost?: number } };
type EcranRecompenses = { options?: OptionAffichee[]; shopOptionsRows?: OptionAffichee[][] } | null;

/** Traduit un objet affiché par le jeu en objet à noter. */
function versObjet(option: OptionAffichee, equipe: PokemonJeu[]): ObjetPropose {
  const t: TypeObjetJeu = option.modifierTypeOption?.type ?? {};
  // Les articles de la boutique sont créés sans identifiant par le jeu : on le lit alors dans leur
  // clé de traduction (« modifierType:ModifierType.POTION » → POTION).
  const id = t.id ?? t.localeKey?.match(/ModifierType\.([A-Z_]+)$/)?.[1] ?? "?";
  const objet: ObjetPropose = { id, nom: t.name ?? "?", cout: option.modifierTypeOption?.cost ?? 0 };
  if (t.selectFilter) {
    const filtre = t.selectFilter;
    objet.ciblesPossibles = equipe.flatMap((p, place) => (filtre(p) === null ? [place] : []));
  }
  if (t.restorePoints !== undefined || t.restorePercent !== undefined) {
    objet.soin = { points: t.restorePoints ?? 0, pourcent: t.restorePercent ?? 0, statut: !!t.healStatus };
  }
  if (t.pokeballType !== undefined) {
    objet.ball = { type: t.pokeballType, nombre: t.count ?? 1 };
  }
  // Pour connaître l'attaque d'une CT, on emprunte la classe « attaque d'un Pokémon » à un membre
  // de l'équipe : new Classe(id).getMove() donne ses données (type, puissance…), connues de tous.
  const ClasseAttaque = equipe[0]?.getMoveset()[0]?.constructor as (new (id: number) => AttaqueJeu) | undefined;
  if (t.moveId !== undefined && ClasseAttaque) {
    objet.ct = versNotee(new ClasseAttaque(t.moveId).getMove());
  }
  if (t.moveType !== undefined) {
    objet.boosterType = { type: t.moveType };
  }
  if (t.stat !== undefined) {
    objet.vitamine = t.stat;
  }
  return objet;
}

/** Les récompenses gratuites affichées (rangée principale de l'écran des bonus), ou null. */
export function objetsProposes(scene: ScenePokerogue): ObjetPropose[] | null {
  if (scene.ui.getMode() !== ECRAN.MODIFIER_SELECT) {
    return null;
  }
  const ecran = scene.ui.getHandler() as EcranRecompenses;
  if (!ecran?.options?.length) {
    return null;
  }
  const equipe = scene.getPlayerParty();
  return ecran.options.map(option => versObjet(option, equipe));
}

/** Un article de la boutique et sa place à l'écran (rangée et colonne du curseur du jeu). */
export interface ArticleBoutique {
  objet: ObjetPropose;
  rangee: number;
  colonne: number;
}

/**
 * Les articles de la boutique (rangées sous les récompenses), ou null hors de cet écran. Le jeu
 * numérote ses rangées de bas en haut : la dernière rangée de la boutique est la rangée 2 du
 * curseur, l'avant-dernière la 3 (voir getRowItems du jeu).
 */
export function boutiqueAffichee(scene: ScenePokerogue): ArticleBoutique[] | null {
  if (scene.ui.getMode() !== ECRAN.MODIFIER_SELECT) {
    return null;
  }
  const rangees = (scene.ui.getHandler() as EcranRecompenses)?.shopOptionsRows ?? [];
  const equipe = scene.getPlayerParty();
  return rangees.flatMap((rangee, r) =>
    rangee.map((option, colonne) => ({ objet: versObjet(option, equipe), rangee: rangees.length - r + 1, colonne })),
  );
}

/** Ce que les notes d'objets savent de la partie : l'équipe, les Balls, le prochain combat important. */
function contexte(scene: ScenePokerogue): ContexteObjets {
  return {
    equipe: scene.getPlayerParty().map(membreDe),
    balls: [0, 1, 2, 3, 4].map(b => scene.pokeballCounts[b] ?? 0),
    // Les récompenses arrivent après la vague gagnée : ce qui compte, c'est la suivante.
    prochainCombat: prochainCombatImportant((scene.currentBattle?.waveIndex ?? 0) + 1),
    typesAPreparer: typesAPreparer((scene.currentBattle?.waveIndex ?? 0) + 1),
  };
}

/** Les récompenses affichées, notées d'après l'état de l'équipe ; null hors de cet écran. */
export function optionsRecompensesAffichees(scene: ScenePokerogue): OptionObjet[] | null {
  const objets = objetsProposes(scene);
  return objets ? evaluerObjets(objets, contexte(scene)) : null;
}

/** Les articles de la boutique, notés (prix compris) ; null hors de cet écran. */
export function optionsBoutiqueAffichees(scene: ScenePokerogue): (OptionObjet & { rangee: number; colonne: number })[] | null {
  const articles = boutiqueAffichee(scene);
  if (!articles) {
    return null;
  }
  const notes = evaluerAchats(articles.map(a => a.objet), contexte(scene), scene.money);
  return notes.map((o, i) => ({ ...o, rangee: articles[i]!.rangee, colonne: articles[i]!.colonne }));
}
