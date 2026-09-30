/**
 * Adaptateurs : traduisent ce que le jeu affiche en données pour les notes d'équipe
 * (observateur/equipe.ts) et d'objets (observateur/objets.ts).
 *
 * - Récompenses après une vague : les objets proposés, et pour chacun les Pokémon que le jeu
 *   accepte (son propre filtre, celui qui affiche « ça n'aura aucun effet »).
 * - Capture avec l'équipe pleine : l'équipe actuelle et le Pokémon qui vient d'être capturé.
 */
import { evaluerArrivee, type OptionEquipe } from "./equipe";
import type { AttaqueJeu, MoveJeu, PokemonJeu, ScenePokerogue } from "./jeu";
import { type ContexteObjets, evaluerObjets, type MembreObjets, type ObjetPropose, type OptionObjet } from "./objets";
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
  if (phase?.phaseName !== "AttemptCapturePhase" || scene.ui.getMode() !== ECRAN.CONFIRM) {
    return null;
  }
  const ecran = scene.ui.getHandler() as { config?: { options?: unknown[] } } | null;
  if ((ecran?.config?.options?.length ?? 0) <= 2) {
    return null; // une simple question oui/non, pas le choix de l'équipe pleine
  }
  const arrivant = phase.getPokemon?.();
  return arrivant ? evaluerArrivee(scene.getPlayerParty().map(membreDe), membreDe(arrivant)) : null;
}

// ─── Récompenses après une vague ──────────────────────────────────────────────────────────────

/** Ce qu'on lit d'un objet du jeu (propriétés présentes selon sa catégorie). */
interface TypeObjetJeu {
  id?: string;
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

/** Les récompenses gratuites affichées (rangée principale de l'écran des bonus), ou null. */
export function objetsProposes(scene: ScenePokerogue): ObjetPropose[] | null {
  if (scene.ui.getMode() !== ECRAN.MODIFIER_SELECT) {
    return null;
  }
  const ecran = scene.ui.getHandler() as {
    options?: { modifierTypeOption?: { type?: TypeObjetJeu; cost?: number } }[];
  } | null;
  if (!ecran?.options?.length) {
    return null;
  }
  const equipe = scene.getPlayerParty();
  // Pour connaître l'attaque d'une CT, on emprunte la classe « attaque d'un Pokémon » à un membre
  // de l'équipe : new Classe(id).getMove() donne ses données (type, puissance…), connues de tous.
  const ClasseAttaque = equipe[0]?.getMoveset()[0]?.constructor as (new (id: number) => AttaqueJeu) | undefined;

  return ecran.options.map(option => {
    const t: TypeObjetJeu = option.modifierTypeOption?.type ?? {};
    const objet: ObjetPropose = { id: t.id ?? "?", nom: t.name ?? "?", cout: option.modifierTypeOption?.cost ?? 0 };
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
  });
}

/** Les récompenses affichées, notées d'après l'état de l'équipe ; null hors de cet écran. */
export function optionsRecompensesAffichees(scene: ScenePokerogue): OptionObjet[] | null {
  const objets = objetsProposes(scene);
  if (!objets) {
    return null;
  }
  const contexte: ContexteObjets = {
    equipe: scene.getPlayerParty().map(membreDe),
    balls: [0, 1, 2, 3, 4].map(b => scene.pokeballCounts[b] ?? 0),
  };
  return evaluerObjets(objets, contexte);
}
