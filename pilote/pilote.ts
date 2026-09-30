/**
 * Le pilote : appuie sur les touches du jeu à la place du joueur.
 *
 * - Les décisions confiées au cerveau (combat, remplacement après un K.O.) : executerAction().
 * - Tout le reste (messages, récompenses, biomes, attaque à oublier…) : repondreParRegles(),
 *   des règles simples et fixes, en attendant que le cerveau apprenne ces décisions aussi.
 *
 * Partagé entre le simulateur (entraînement) et l'extension (mode auto) : le cerveau agit sur
 * le jeu exactement de la même façon dans les deux cas.
 */
import { decrireAction } from "../observateur/actions";
import type { ScenePokerogue } from "../observateur/jeu";
import { meilleureOption, optionsApprentissageAffichees } from "../observateur/synergie";
import { BOUTON, CIBLE, COMMANDE, ECRAN, USAGE_ATTAQUE_NORMAL } from "../observateur/valeurs";

/** Écran du jeu, vu par le pilote (sous-ensemble prudent des différents écrans). */
interface Ecran {
  active?: boolean;
  awaitingActionInput?: boolean;
  options?: { modifierTypeOption?: { type?: { name?: string } } }[];
  setCursor(curseur: number): boolean;
  setRowCursor?(rangee: number): boolean;
  processInput(bouton: number): boolean;
}

export type DecisionCerveau = "combat" | "remplacement";

export interface EtatPilote {
  /** Ennemi visé par la dernière attaque choisie (valeur BattlerIndex du jeu). */
  cible: number;
  /** Tentatives pour donner le bonus choisi à un Pokémon. */
  essaisCible: number;
  /** Récompenses déjà essayées dans la vague (une CT refusée reviendrait sinon à l'infini). */
  recompensesEssayees: Set<number>;
  vagueRecompenses: number;
}

export function nouvelEtatPilote(): EtatPilote {
  return { cible: CIBLE.ENNEMI_1, essaisCible: 0, recompensesEssayees: new Set(), vagueRecompenses: -1 };
}

function ecran(scene: ScenePokerogue): Ecran | null {
  const handler = scene.ui.getHandler() as Ecran | null;
  return handler?.active ? handler : null;
}

function nomPhase(scene: ScenePokerogue): string {
  return scene.phaseManager.getCurrentPhase()?.phaseName ?? "";
}

/** La décision que le jeu attend du cerveau en ce moment, ou null. */
export function decisionCerveauEnAttente(scene: ScenePokerogue): DecisionCerveau | null {
  const e = ecran(scene);
  if (!e) {
    return null;
  }
  const mode = scene.ui.getMode();
  const phase = nomPhase(scene);
  if (mode === ECRAN.COMMAND && phase === "CommandPhase") {
    return "combat";
  }
  if (mode === ECRAN.PARTY && phase === "SwitchPhase" && !e.awaitingActionInput) {
    return "remplacement";
  }
  return null;
}

/**
 * Exécute l'action n° `index` choisie par le cerveau (voir observateur/actions.ts).
 * Renvoie faux si le jeu la refuse (ex. changement impossible car piégé).
 */
export function executerAction(scene: ScenePokerogue, index: number, etat: EtatPilote): boolean {
  const decision = decisionCerveauEnAttente(scene);
  const action = decrireAction(index);
  const phase = scene.phaseManager.getCurrentPhase();

  if (decision === "combat" && phase?.handleCommand) {
    if (action.type === "attaque") {
      const pokemon = phase.getPokemon?.();
      const attaque = pokemon?.getMoveset()[action.attaque];
      // Plus aucune attaque utilisable : le jeu attend « -1 » pour faire utiliser Lutte.
      const utilisable = !!pokemon && !!attaque && attaque.isUsable(pokemon, false, true)[0];
      etat.cible = action.cible === 0 ? CIBLE.ENNEMI_1 : CIBLE.ENNEMI_2;
      return phase.handleCommand(COMMANDE.FIGHT, utilisable ? action.attaque : -1, USAGE_ATTAQUE_NORMAL);
    }
    return phase.handleCommand(COMMANDE.POKEMON, action.place, false);
  }

  if (decision === "remplacement" && action.type === "envoyer") {
    const e = ecran(scene)!;
    e.setCursor(action.place);
    e.processInput(BOUTON.ACTION); // choisir le Pokémon
    e.processInput(BOUTON.ACTION); // « Envoyer »
    return true;
  }
  return false;
}

/**
 * Répond par des règles fixes à tout ce qui attend le joueur sans être confié au cerveau.
 * Renvoie une courte description de ce qui a été fait (pour le journal), ou null.
 */
export function repondreParRegles(scene: ScenePokerogue, etat: EtatPilote): string | null {
  const e = ecran(scene);
  if (!e || decisionCerveauEnAttente(scene)) {
    return null;
  }
  const mode = scene.ui.getMode();
  const phase = nomPhase(scene);

  if (mode === ECRAN.TARGET_SELECT) {
    e.setCursor(etat.cible);
    e.processInput(BOUTON.ACTION);
    return "cible";
  }

  if (mode === ECRAN.MODIFIER_SELECT) {
    return e.awaitingActionInput ? choisirRecompense(scene, e, etat) : null;
  }

  if (mode === ECRAN.PARTY && phase === "SelectModifierPhase") {
    // Un bonus à donner : au Pokémon le plus blessé encore debout. Refusé trois fois
    // (ex. Champignon Mémoire sans attaque à réapprendre) : on recule jusqu'à la boutique.
    if (++etat.essaisCible > 3) {
      e.processInput(BOUTON.CANCEL);
      return "bonus inutilisable";
    }
    const vivants = scene.getPlayerParty().map((p, place) => ({ p, place })).filter(({ p }) => !p.isFainted());
    vivants.sort((a, b) => a.p.getHpRatio() - b.p.getHpRatio());
    e.setCursor(vivants[0]?.place ?? 0);
    e.processInput(BOUTON.ACTION);
    e.processInput(BOUTON.ACTION);
    return "bonus donné";
  }

  if (mode === ECRAN.OPTION_SELECT) {
    // Menus à options, dont le choix du prochain biome : la première option.
    e.setCursor(0);
    e.processInput(BOUTON.ACTION);
    return "option";
  }

  if (mode === ECRAN.SUMMARY) {
    return choisirAttaqueAOublier(scene, e);
  }

  if (mode === ECRAN.CONFIRM && phase === "CheckSwitchPhase") {
    // « Changer de Pokémon ? » après un K.O. adverse (style de combat « Changer ») : non,
    // le cerveau peut changer lui-même à son tour. On vise « Non » (2e option) puis on valide :
    // la touche Annuler ne fait rien si la fenêtre interdit l'annulation.
    e.setCursor(1);
    e.processInput(BOUTON.ACTION);
    return "ne change pas";
  }

  if (e.awaitingActionInput || mode === ECRAN.CONFIRM) {
    e.processInput(BOUTON.ACTION);
    return "suite";
  }
  return null;
}

function choisirRecompense(scene: ScenePokerogue, e: Ecran, etat: EtatPilote): string {
  const vague = scene.currentBattle?.waveIndex ?? 0;
  if (vague !== etat.vagueRecompenses) {
    etat.vagueRecompenses = vague;
    etat.recompensesEssayees.clear();
  }
  // Rangée 1 = les récompenses gratuites : la première pas encore essayée ; sinon on passe.
  const nombre = Math.max(e.options?.length ?? 1, 1);
  const choix = Array.from({ length: nombre }, (_, i) => i).find(i => !etat.recompensesEssayees.has(i));
  if (choix === undefined) {
    e.processInput(BOUTON.CANCEL);
    return "passe les récompenses";
  }
  etat.recompensesEssayees.add(choix);
  etat.essaisCible = 0;
  e.setRowCursor?.(1);
  e.setCursor(choix);
  e.processInput(BOUTON.ACTION);
  return `récompense : ${e.options?.[choix]?.modifierTypeOption?.type?.name ?? "?"}`;
}

/**
 * « Quelle attaque oublier pour apprendre la nouvelle ? » (écran de résumé du jeu).
 * Règle en attendant que le cerveau décide : on note chaque option (refuser, ou oublier l'une
 * des 4) avec la note de synergie du jeu d'attaques complet (observateur/synergie.ts), et on
 * garde la mieux notée.
 */
function choisirAttaqueAOublier(scene: ScenePokerogue, e: Ecran): string | null {
  const resume = e as Ecran & { moveSelect?: boolean };
  const options = optionsApprentissageAffichees(scene);
  if (!options) {
    e.processInput(BOUTON.CANCEL);
    return "garde ses attaques";
  }
  if (!resume.moveSelect) {
    return null; // l'écran n'est pas encore prêt à choisir une attaque
  }
  const choix = meilleureOption(options);
  // Lignes 0 à 3 : les attaques actuelles ; ligne 4 : la nouvelle (la choisir revient à la refuser).
  e.setCursor(choix.oublier ?? 4);
  e.processInput(BOUTON.ACTION);
  return choix.oublier === null ? "garde ses attaques" : `apprend : ${choix.nom.replace("Oublier ", "oublie ")}`;
}
