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
import { optionsEquipePleineAffichees, optionsRecompensesAffichees } from "../observateur/decisions-jeu";
import { meilleureOptionEquipe } from "../observateur/equipe";
import type { ScenePokerogue } from "../observateur/jeu";
import { meilleurObjet } from "../observateur/objets";
import { meilleureOption, optionsApprentissageAffichees } from "../observateur/synergie";
import { BOUTON, CIBLE, COMMANDE, ECRAN, OPTION_EQUIPE, USAGE_ATTAQUE_NORMAL } from "../observateur/valeurs";

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
  /** Receveur choisi pour la récompense en cours (note des objets), ou null. */
  receveur: number | null;
  /** Membre à relâcher pour faire de la place au Pokémon capturé (note d'équipe), ou null. */
  placeARelacher: number | null;
}

export function nouvelEtatPilote(): EtatPilote {
  return {
    cible: CIBLE.ENNEMI_1, essaisCible: 0, recompensesEssayees: new Set(), vagueRecompenses: -1,
    receveur: null, placeARelacher: null,
  };
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
  if (mode === ECRAN.PARTY && phase === "SwitchPhase" && etatEquipe(e) === "liste") {
    return "remplacement";
  }
  return null;
}

// ─── Écran d'équipe : une touche par passage, selon son état ────────────────────────────────

/** Ce que montre l'écran d'équipe : un message, le menu d'options d'un Pokémon, ou la liste. */
type EtatEquipe = "message" | "options" | "liste";

interface EcranEquipe {
  awaitingActionInput?: boolean;
  optionsMode?: boolean;
  /** Codes des options affichées (PartyOption du jeu : Envoyer, Relâcher, Appliquer…). */
  options?: number[];
}

function etatEquipe(e: Ecran): EtatEquipe {
  const equipe = e as unknown as EcranEquipe;
  return equipe.awaitingActionInput ? "message" : equipe.optionsMode ? "options" : "liste";
}

/**
 * Un pas dans l'écran d'équipe, jamais deux touches d'affilée à l'aveugle : un message → le
 * valider ; le menu d'options ouvert → viser l'option voulue par son code (pas par sa position,
 * qui change selon le contexte) ; la liste → choisir la place, ce qui ouvre le menu d'options.
 * Si aucune option voulue n'est proposée, on referme le menu.
 */
function pasDansEquipe(e: Ecran, place: number, optionsVoulues: number[]): EtatEquipe {
  const etat = etatEquipe(e);
  if (etat === "message") {
    e.processInput(BOUTON.ACTION);
  } else if (etat === "options") {
    const proposees = (e as unknown as EcranEquipe).options ?? [];
    const voulue = optionsVoulues.find(o => proposees.includes(o));
    if (voulue === undefined) {
      e.processInput(BOUTON.CANCEL);
    } else {
      e.setCursor(proposees.indexOf(voulue));
      e.processInput(BOUTON.ACTION);
    }
  } else {
    e.setCursor(place);
    e.processInput(BOUTON.ACTION);
  }
  return etat;
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
    if (action.type === "ball") {
      // Comme l'écran des Poké Balls du jeu : la commande BALL avec le type de Ball choisi.
      return phase.handleCommand(COMMANDE.BALL, action.ball);
    }
    return phase.handleCommand(COMMANDE.POKEMON, action.place, false);
  }

  if (decision === "remplacement" && action.type === "envoyer") {
    // On choisit le Pokémon (son menu d'options s'ouvre) ; le pas suivant validera « Envoyer ».
    pasDansEquipe(ecran(scene)!, action.place, [OPTION_EQUIPE.ENVOYER]);
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

  if (mode === ECRAN.PARTY && phase === "SwitchPhase") {
    // Après le choix du cerveau : valider « Envoyer » dans le menu d'options (ou un message).
    pasDansEquipe(e, 0, [OPTION_EQUIPE.ENVOYER]);
    return "envoie";
  }

  if (mode === ECRAN.PARTY && phase === "SelectModifierPhase") {
    // Un bonus à donner au receveur désigné par la note des objets (à défaut, le plus blessé).
    // Si le jeu refuse trois fois de suite (message à la place du menu), on revient à la boutique.
    const vivants = scene.getPlayerParty().map((p, place) => ({ p, place })).filter(({ p }) => !p.isFainted());
    vivants.sort((a, b) => a.p.getHpRatio() - b.p.getHpRatio());
    const place = etat.receveur ?? vivants[0]?.place ?? 0;
    if (etatEquipe(e) === "liste" && ++etat.essaisCible > 3) {
      e.processInput(BOUTON.CANCEL);
      return "bonus inutilisable";
    }
    // Objets sur une attaque (Huile…) : l'attaque la plus à court de PP d'abord.
    const attaques = scene.getPlayerParty()[place]?.getMoveset() ?? [];
    const parPp = attaques
      .map((a, i) => ({ i, ratio: a.getMovePp() > 0 ? (a.getMovePp() - a.ppUsed) / a.getMovePp() : 1 }))
      .sort((a, b) => a.ratio - b.ratio)
      .map(({ i }) => OPTION_EQUIPE.ATTAQUE_1 + i);
    const fait = pasDansEquipe(e, place, [OPTION_EQUIPE.APPLIQUER, OPTION_EQUIPE.ENSEIGNER, ...parPp]);
    return fait === "options" ? "bonus donné" : "suite";
  }

  if (mode === ECRAN.PARTY && phase === "AttemptCapturePhase") {
    // Équipe pleine : relâcher le membre désigné par la note d'équipe (option « Relâcher »).
    if (etat.placeARelacher === null) {
      // Déjà relâché (ou rien à relâcher) : on valide le message éventuel, sinon on ressort.
      e.processInput(etatEquipe(e) === "message" ? BOUTON.ACTION : BOUTON.CANCEL);
      return "suite";
    }
    const fait = pasDansEquipe(e, etat.placeARelacher, [OPTION_EQUIPE.RELACHER]);
    if (fait === "options") {
      etat.placeARelacher = null; // relâché : ne jamais recommencer
      return "relâche un membre";
    }
    return "suite";
  }

  if (mode === ECRAN.POKEDEX_PAGE || mode === ECRAN.RENAME_POKEMON) {
    // Écrans ouverts par erreur (Pokédex, renommer) : on revient en arrière.
    e.processInput(BOUTON.CANCEL);
    return "referme un écran";
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

  if (mode === ECRAN.CONFIRM && phase === "AttemptCapturePhase") {
    // Capture réussie mais équipe pleine : le jeu propose (résumé, Pokédex, relâcher un membre,
    // ne pas le garder). On suit la note d'équipe (observateur/equipe.ts).
    const options = optionsEquipePleineAffichees(scene);
    if (options) {
      const choix = meilleureOptionEquipe(options);
      etat.placeARelacher = choix.remplacer;
      const nbOptions = (e as Ecran & { config?: { options?: unknown[] } }).config?.options?.length ?? 4;
      e.setCursor(choix.remplacer === null ? nbOptions - 1 : 2); // « ne pas le garder » ou « relâcher un membre »
      e.processInput(BOUTON.ACTION);
      return choix.remplacer === null ? "équipe pleine, ne garde pas" : "équipe pleine, remplace";
    }
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
  // Rangée 1 = les récompenses gratuites, notées d'après l'état de l'équipe (observateur/objets.ts).
  // On prend la mieux notée pas encore essayée dans cette vague ; si aucune ne sert, on passe.
  const notees = (optionsRecompensesAffichees(scene) ?? []).filter(o => !etat.recompensesEssayees.has(o.index));
  const choix = meilleurObjet(notees);
  if (!choix) {
    e.processInput(BOUTON.CANCEL);
    return "passe les récompenses";
  }
  etat.recompensesEssayees.add(choix.index);
  etat.essaisCible = 0;
  etat.receveur = choix.cible;
  e.setRowCursor?.(1);
  e.setCursor(choix.index);
  e.processInput(BOUTON.ACTION);
  return `récompense : ${choix.nom}`;
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
