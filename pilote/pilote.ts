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
import {
  optionsBoutiqueAffichees,
  optionsEquipePleineAffichees,
  optionsRecompensesAffichees,
} from "../observateur/decisions-jeu";
import { choisirBiome } from "../observateur/biomes";
import { meilleureOptionEquipe } from "../observateur/equipe";
import type { ScenePokerogue } from "../observateur/jeu";
import { Carnet } from "../observateur/carnet";
import { meilleurAchat, meilleurObjet } from "../observateur/objets";
import { observer } from "../observateur/observateur";
import { changerAuDebut } from "../observateur/planificateur";
import { statsEstimees } from "../observateur/prevision";
import { meilleureOption, optionsApprentissageAffichees } from "../observateur/synergie";
import { BOUTON, CIBLE, COMMANDE, ECRAN, OPTION_EQUIPE, USAGE_ATTAQUE_NORMAL } from "../observateur/valeurs";
import RENCONTRES from "../donnees/rencontres-mysteres.json";

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
  /** Le choix « relâcher un membre » est en cours (capture, ou rencontre mystère qui donne un Pokémon). */
  relacheEnCours: boolean;
  /** Retours d'affilée du menu des attaques au menu de combat (Fun and Games le rouvre aussitôt). */
  retoursCombat: number;
  /** Achats en boutique dans la vague (plafonnés), articles refusés, et dernier achat tenté. */
  achats: number;
  achatsRefuses: Set<number>;
  dernierAchat: { index: number; argent: number } | null;
  /** Le carnet de la partie (sa mémoire : starter du rival…), s'il y en a un. */
  carnet: Carnet | null;
  /** Récompenses proposées dans la partie, par nom (une fois par vague) : pour juger les choix. */
  offertes: Record<string, number>;
}

/** Achats au plus par vague : de quoi soigner l'équipe, sans boucle si quelque chose cloche. */
const ACHATS_MAX = 6;

export function nouvelEtatPilote(carnet: Carnet | null = null): EtatPilote {
  return {
    carnet,
    offertes: {},
    cible: CIBLE.ENNEMI_1, essaisCible: 0, recompensesEssayees: new Set(), vagueRecompenses: -1,
    receveur: null, placeARelacher: null, relacheEnCours: false, retoursCombat: 0, achats: 0, achatsRefuses: new Set(), dernierAchat: null,
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
 * La Téracristallisation (Orbe Téracristal, donné par le rival 4 à la vague 95 ; une par biome) :
 * pour le porteur (le plus haut niveau), dans un combat important (boss, dresseur boss, rival,
 * Conseil 4, Maître, Éthernatos), quand l'attaque choisie est de son type Téra — le bonus de même
 * type passe de ×1,5 à ×2. Le bot ne l'utilisait jamais.
 */
function teracristalliser(scene: ScenePokerogue, pokemon: unknown, attaque: unknown): boolean {
  const menu = scene.ui.getHandler() as { canTera?: () => boolean } | null;
  if (typeof menu?.canTera !== "function" || !menu.canTera()) {
    return false;
  }
  const p = pokemon as { level?: number; teraType?: number };
  const a = attaque as { getMove?: () => { type?: number; category?: number } };
  const vague = scene.currentBattle?.waveIndex ?? 0;
  const ennemis = scene.getEnemyField() as unknown as { isBoss?: () => boolean }[];
  const important = vague % 10 === 0 || vague >= 180 || ennemis.some(e => e.isBoss?.())
    || [8, 25, 55, 95, 145, 195].includes(vague);
  const porteur = Math.max(...scene.getPlayerParty().map(m => (m as unknown as { level: number }).level));
  const coup = a.getMove?.();
  return important && (p.level ?? 0) >= porteur && coup?.category !== 2 && coup?.type === p.teraType;
}

/**
 * Exécute l'action n° `index` choisie par le cerveau (voir observateur/actions.ts).
 * Renvoie faux si le jeu la refuse (ex. changement impossible car piégé).
 */
export function executerAction(scene: ScenePokerogue, index: number, etat: EtatPilote): boolean {
  const decision = decisionCerveauEnAttente(scene);
  const action = decrireAction(index);
  etat.retoursCombat = 0;
  const phase = scene.phaseManager.getCurrentPhase();

  if (decision === "combat" && phase?.handleCommand) {
    if (action.type === "attaque") {
      const pokemon = phase.getPokemon?.();
      const attaque = pokemon?.getMoveset()[action.attaque];
      // Plus aucune attaque utilisable : le jeu attend « -1 » pour faire utiliser Lutte.
      const utilisable = !!pokemon && !!attaque && attaque.isUsable(pokemon, false, true)[0];
      etat.cible = action.cible === 0 ? CIBLE.ENNEMI_1 : CIBLE.ENNEMI_2;
      const commande = utilisable && teracristalliser(scene, pokemon, attaque) ? COMMANDE.TERA : COMMANDE.FIGHT;
      return phase.handleCommand(commande, utilisable ? action.attaque : -1, USAGE_ATTAQUE_NORMAL);
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

  if (mode === ECRAN.PARTY && (phase === "AttemptCapturePhase" || etat.relacheEnCours)) {
    // Équipe pleine : relâcher le membre désigné par la note d'équipe (option « Relâcher »).
    if (etat.placeARelacher === null) {
      // Déjà relâché (ou rien à relâcher) : on valide le message éventuel, sinon on ressort.
      const message = etatEquipe(e) === "message";
      e.processInput(message ? BOUTON.ACTION : BOUTON.CANCEL);
      etat.relacheEnCours = message;
      return "suite";
    }
    const fait = pasDansEquipe(e, etat.placeARelacher, [OPTION_EQUIPE.RELACHER]);
    if (fait === "options") {
      etat.placeARelacher = null; // relâché : ne jamais recommencer
      return "relâche un membre";
    }
    return "suite";
  }

  if (mode === ECRAN.MYSTERY_ENCOUNTER) {
    return choisirRencontreMystere(scene, e);
  }

  // Œufs reçus d'une rencontre mystère, qui éclosent pendant la partie : passer l'animation, puis
  // fermer le résumé (sinon tout reste bloqué, y compris la partie suivante dans le simulateur).
  if (mode === ECRAN.ECLOSION) {
    e.processInput(BOUTON.ACTION);
    return "éclosion";
  }
  if (mode === ECRAN.RESUME_ECLOSIONS) {
    e.processInput(BOUTON.CANCEL);
    return "ferme les éclosions";
  }

  // Le menu des attaques ouvert alors que le cerveau attend le menu de combat (attaque refusée par
  // le jeu, par exemple) : on revient au menu de combat, où le cerveau choisit de nouveau.
  if (mode === ECRAN.FIGHT) {
    // Certaines rencontres (Fun and Games) rouvrent aussitôt le menu des attaques : après trois
    // retours sans effet, on lance la première attaque proposée.
    if (++etat.retoursCombat > 3) {
      etat.retoursCombat = 0;
      e.setCursor(0);
      e.processInput(BOUTON.ACTION);
      return "attaque imposée";
    }
    e.processInput(BOUTON.CANCEL);
    return "revient au menu de combat";
  }

  if (mode === ECRAN.PARTY && !["SwitchPhase", "SelectModifierPhase", "AttemptCapturePhase"].includes(phase)) {
    // Une rencontre mystère (ou un autre écran) demande de choisir un Pokémon : le premier que
    // l'écran accepte (son filtre : ex. Delibird-y ne veut qu'un Pokémon qui tient certains objets ;
    // prendre le premier venu faisait refuser puis reproposer le même à l'infini), puis l'option
    // « Choisir » (ou appliquer, envoyer…). Sans Pokémon accepté ni option utilisable, on revient.
    const filtre = (e as unknown as { selectFilter?: (p: unknown) => string | null }).selectFilter;
    const accepte = (p: { isFainted(): boolean }) => !p.isFainted() && (typeof filtre !== "function" || filtre(p) === null);
    const place = scene.getPlayerParty().findIndex(accepte);
    if (place < 0 && etatEquipe(e) === "liste") {
      e.processInput(BOUTON.CANCEL);
      return "aucun Pokémon accepté";
    }
    const fait = pasDansEquipe(e, Math.max(place, 0), [
      OPTION_EQUIPE.CHOISIR, OPTION_EQUIPE.APPLIQUER, OPTION_EQUIPE.ENVOYER, OPTION_EQUIPE.ENSEIGNER,
    ]);
    return fait === "options" ? "choisit un Pokémon" : "suite";
  }

  if (mode === ECRAN.POKEDEX_PAGE || mode === ECRAN.RENAME_POKEMON) {
    // Écrans ouverts par erreur (Pokédex, renommer) : on revient en arrière.
    e.processInput(BOUTON.CANCEL);
    return "referme un écran";
  }

  if (mode === ECRAN.OPTION_SELECT && phase === "SelectBiomePhase") {
    const noms = ((e as Ecran & { config?: { options?: { label?: string }[] } }).config?.options ?? []).map(o => o.label ?? "");
    const obs = observer(scene, etat.carnet ?? new Carnet());
    const choix = obs ? choisirBiome(noms, obs.equipe, obs.partie.vague, scene.arena?.biomeId, etat.carnet?.vagueDesChampions()) : 0;
    e.setCursor(choix);
    e.processInput(BOUTON.ACTION);
    return `biome : ${noms[choix] ?? "?"}`;
  }

  if (mode === ECRAN.OPTION_SELECT) {
    // Menus à options : la première option.
    e.setCursor(0);
    e.processInput(BOUTON.ACTION);
    return "option";
  }

  if (mode === ECRAN.SUMMARY) {
    return choisirAttaqueAOublier(scene, e, etat);
  }

  if (mode === ECRAN.CONFIRM && (phase === "AttemptCapturePhase" || phase.startsWith("MysteryEncounter"))) {
    // Capture réussie mais équipe pleine (en combat, ou dans une rencontre comme la Zone Safari) :
    // le jeu propose (résumé, Pokédex, relâcher un membre, ne pas le garder). On suit la note
    // d'équipe (observateur/equipe.ts). Valider la 1re option ouvrait le résumé, encore et encore.
    const options = optionsEquipePleineAffichees(scene, etat.carnet?.typeStarterRival());
    if (options) {
      const choix = meilleureOptionEquipe(options);
      etat.placeARelacher = choix.remplacer;
      etat.relacheEnCours = choix.remplacer !== null;
      const nbOptions = (e as Ecran & { config?: { options?: unknown[] } }).config?.options?.length ?? 4;
      e.setCursor(choix.remplacer === null ? nbOptions - 1 : 2); // « ne pas le garder » ou « relâcher un membre »
      e.processInput(BOUTON.ACTION);
      return choix.remplacer === null ? "équipe pleine, ne garde pas" : "équipe pleine, remplace";
    }
    const nombreOptions = (e as Ecran & { config?: { options?: unknown[] } }).config?.options?.length ?? 0;
    if (phase.startsWith("MysteryEncounter") && nombreOptions > 2) {
      e.setCursor(nombreOptions - 1);
      e.processInput(BOUTON.ACTION);
      return "équipe pleine, ne garde pas";
    }
  }

  if (mode === ECRAN.CONFIRM && phase === "CheckSwitchPhase") {
    // « Changer de Pokémon ? » au début d'une vague contre des sauvages (style de combat
    // « Changer ») : un changement gratuit, l'adversaire déjà visible. Oui (1re option) si le
    // planificateur trouve mieux sur le banc ; non (2e) sinon. On vise puis on valide : la touche
    // Annuler ne fait rien si la fenêtre interdit l'annulation.
    const position = (scene.phaseManager.getCurrentPhase() as { fieldIndex?: number } | null | undefined)?.fieldIndex ?? 0;
    const obs = observer(scene, etat.carnet ?? new Carnet());
    const oui = !!obs && changerAuDebut(obs, position);
    e.setCursor(oui ? 0 : 1);
    e.processInput(BOUTON.ACTION);
    return oui ? "change en début de vague" : "ne change pas";
  }

  if (e.awaitingActionInput || mode === ECRAN.CONFIRM) {
    e.processInput(BOUTON.ACTION);
    return "suite";
  }
  return null;
}

/**
 * Rencontre mystère (remarque de Carlos, 01/10 : le mode auto restait bloqué sur « Promos au
 * Centre Commercial »). L'écran du jeu attend la fin de son animation (blockInput) ; ensuite on
 * choisit la première option dont les conditions sont remplies. Une règle simple en attendant que
 * le cerveau juge lui-même chaque rencontre.
 */
export function optionRencontre(type: number | undefined, possibles: number[]): number {
  const rencontres: Record<string, { options: number[] }> = RENCONTRES.rencontres;
  const preferees = type === undefined ? [] : (rencontres[String(type)]?.options ?? []).map(option => option - 1);
  return preferees.find(option => possibles.includes(option)) ?? possibles[0]!;
}

const BERRIES_ABOUND = 19;
const OPTION_COURSE = 1;
const VITESSE = 5;
const MARGE_COURSE = 1.2;

export function courseGagnable(scene: ScenePokerogue): boolean {
  const boss = scene.currentBattle?.mysteryEncounter?.enemyPartyConfigs?.[0]?.pokemonConfigs?.[0];
  if (!boss?.species?.baseStats || !boss.level) {
    return true;
  }
  const vitesseBoss = statsEstimees(boss.species.baseStats, boss.level)[VITESSE] ?? 0;
  const plusRapide = Math.max(0, ...scene.getPlayerParty().filter(p => !p.isFainted()).map(p => p.getStat(VITESSE)));
  return plusRapide > vitesseBoss * MARGE_COURSE;
}

function choisirRencontreMystere(scene: ScenePokerogue, e: Ecran): string | null {
  const ecranRencontre = e as Ecran & { blockInput?: boolean; optionsMeetsReqs?: boolean[]; encounterOptions?: unknown[] };
  if (ecranRencontre.blockInput) {
    return null;
  }
  const nombre = ecranRencontre.encounterOptions?.length ?? 1;
  const possibles = Array.from({ length: nombre }, (_, i) => i).filter(i => ecranRencontre.optionsMeetsReqs?.[i] !== false);
  if (!possibles.length) {
    // Aucune option possible (ex. Delibird-y sans argent ni objet) : le vrai jeu ne propose pas une
    // telle rencontre (ses conditions d'apparition l'en empêchent) ; seul le simulateur, qui la
    // force, y arrive. Choisir l'option 1 malgré tout tournait en rond : on tente Annuler.
    e.processInput(BOUTON.CANCEL);
    return "rencontre mystère : aucune option possible";
  }
  const type = scene.currentBattle?.mysteryEncounter?.encounterType;
  const sures = type === BERRIES_ABOUND && !courseGagnable(scene) ? possibles.filter(i => i !== OPTION_COURSE) : possibles;
  const choix = optionRencontre(type, sures.length ? sures : possibles);
  e.setCursor(choix);
  e.processInput(BOUTON.ACTION);
  return `rencontre mystère : option ${choix + 1}`;
}

function choisirRecompense(scene: ScenePokerogue, e: Ecran, etat: EtatPilote): string {
  const vague = scene.currentBattle?.waveIndex ?? 0;
  if (vague !== etat.vagueRecompenses) {
    etat.vagueRecompenses = vague;
    etat.recompensesEssayees.clear();
    etat.achats = 0;
    etat.achatsRefuses.clear();
    etat.dernierAchat = null;
  }
  // D'abord la boutique : un humain y achète des soins (surtout avant le rival ou un champion)
  // avant de prendre sa récompense gratuite, qui fait passer à la vague suivante.
  const achat = choisirAchat(scene, e, etat);
  if (achat) {
    return achat;
  }
  // Rangée 1 = les récompenses gratuites, notées d'après l'état de l'équipe (observateur/objets.ts).
  // On prend la mieux notée pas encore essayée dans cette vague ; si aucune ne sert, on passe.
  const toutes = optionsRecompensesAffichees(scene, etat.carnet?.vagueDesChampions(), etat.carnet?.typeStarterRival()) ?? [];
  if (!etat.recompensesEssayees.size) {
    for (const o of toutes) {
      etat.offertes[o.nom] = (etat.offertes[o.nom] ?? 0) + 1;
    }
  }
  const notees = toutes.filter(o => !etat.recompensesEssayees.has(o.index));
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

/** Un achat en boutique s'il en vaut la peine (note des objets, prix compris), sinon null. */
function choisirAchat(scene: ScenePokerogue, e: Ecran, etat: EtatPilote): string | null {
  // L'argent n'a pas bougé depuis le dernier achat tenté : le jeu l'a refusé, on n'y revient pas.
  if (etat.dernierAchat && scene.money >= etat.dernierAchat.argent) {
    etat.achatsRefuses.add(etat.dernierAchat.index);
  }
  etat.dernierAchat = null;
  if (etat.achats >= ACHATS_MAX) {
    return null;
  }
  const notes = (optionsBoutiqueAffichees(scene, etat.carnet?.vagueDesChampions(), etat.carnet?.typeStarterRival()) ?? []).filter(o => !etat.achatsRefuses.has(o.index));
  const choix = meilleurAchat(notes);
  if (!choix || !e.setRowCursor) {
    return null;
  }
  const article = notes.find(o => o.index === choix.index)!;
  etat.achats++;
  etat.dernierAchat = { index: choix.index, argent: scene.money };
  etat.essaisCible = 0;
  etat.receveur = choix.cible;
  e.setRowCursor(article.rangee);
  e.setCursor(article.colonne);
  e.processInput(BOUTON.ACTION);
  return `achat : ${choix.nom}`;
}

/**
 * « Quelle attaque oublier pour apprendre la nouvelle ? » (écran de résumé du jeu).
 * Règle en attendant que le cerveau décide : on note chaque option (refuser, ou oublier l'une
 * des 4) avec la note de synergie du jeu d'attaques complet (observateur/synergie.ts), et on
 * garde la mieux notée.
 */
function choisirAttaqueAOublier(scene: ScenePokerogue, e: Ecran, etat: EtatPilote): string | null {
  const resume = e as Ecran & { moveSelect?: boolean };
  const options = optionsApprentissageAffichees(scene, etat.carnet?.typeStarterRival());
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
