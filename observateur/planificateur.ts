/**
 * Le planificateur (idée de Carlos : « comme aux échecs, on analyse aussi les positions futures et
 * on cherche le meilleur chemin ; parfois la meilleure attaque n'est pas celle de la situation
 * actuelle mais celle de la suivante »).
 *
 * Pour chaque action possible de combat, il joue la suite à l'avance avec ce qu'un joueur sait :
 * le coup prévu de l'IA adverse (observateur/prevision.ts) et la formule des dégâts.
 *   - Attaquer : qui frappe en premier ; si l'adversaire tombe ce tour-ci ; sinon, la « course au
 *     K.O. » qui suit (combien de tours il me faut pour le mettre K.O., combien il lui en faut).
 *   - Changer de Pokémon : l'IA a choisi son attaque contre celui qui part ; le remplaçant la
 *     reçoit en entrant, puis on joue sa course au K.O. contre l'adversaire.
 *   - Remplacer un Pokémon K.O. : pas de coup à l'entrée, seulement la course au K.O.
 * Chaque chemin reçoit une valeur : environ +1 si on gagne le duel (plus les PV qui restent),
 * environ −1 si on le perd (moins ce qu'on a infligé). C'est une recherche courte et lisible, pas
 * une boule de cristal : les attaques de statut, objets et talents ne sont pas simulés.
 *
 * Les Poké Balls (option `capture`) : chance de capture (observateur/capture.ts) × gain de la
 * capture + chance d'échec × le coup qu'on encaisse pendant ce temps. Contre un Pokémon en pleine
 * forme et difficile à attraper, mieux vaut l'affaiblir d'abord (remarque de Carlos, 01/10). Sans
 * cette option, elles reçoivent la valeur de la meilleure attaque (neutres : le cerveau décide).
 */
import { NOMBRE_ACTIONS, PREMIER_CHANGEMENT, PREMIERE_BALL } from "./actions";
import { chanceCapture } from "./capture";
import { valeursCombatEquipe } from "./combat-equipe";
import { facteurAttaque } from "./contraintes-attaques";
import { connaissance } from "./especes";
import { cibleDe, combattantAdverse, combattantAllie, type Combattant, degats, efficacite, prevoir, prevoirChangement } from "./prevision";
import type { Observation, PokemonAdverse, PokemonAllie } from "./types";

const TOURS_MAX = 8;
/** Amplification des valeurs du combat d'équipe (× poids du plan 30 : le cerveau ne fait que départager). */
const ECHELLE_COMBAT_EQUIPE = 30;
/** Poids des dégâts infligés dans un duel perdu (voir valeurDuel). */
const POIDS_DEGATS_PERDU = 1;
/** Coût d'une attaque plus faible que la meilleure ce tour-ci (à 0,1, le cerveau passait outre). */
const PENALITE_PLUS_FAIBLE = 0.5;

interface Duel {
  /** Tours qu'il me faut pour le mettre K.O. (avec ma meilleure attaque). */
  mesTours: number;
  /** Tours qu'il lui faut pour me mettre K.O. (avec son coup prévu). */
  sesTours: number;
  plusRapide: boolean;
  /** Dégâts par tour, en fraction des PV restants de chacun. */
  parTourMoi: number;
  parTourLui: number;
}

const vitesse = (c: Combattant) => (c.stats[5] ?? 0) * ((c.crans[4] ?? 0) >= 0 ? (2 + (c.crans[4] ?? 0)) / 2 : 2 / (2 - (c.crans[4] ?? 0)));
const tours = (parTour: number) => (parTour <= 0 ? TOURS_MAX + 1 : Math.min(TOURS_MAX + 1, Math.ceil(1 / parTour)));

/** Ce que mes attaques font à cet adversaire, en fraction de ses PV restants. */
function mesDegats(moi: PokemonAllie, lui: PokemonAdverse, pvLui: number): number[] {
  const a = combattantAllie(moi);
  const d = combattantAdverse(lui);
  return moi.attaques.map(x =>
    x.pp > 0 ? degats(a, d, { type: x.type.id, categorie: x.categorie.id, puissance: x.puissance * facteurAttaque(x.id) }) / Math.max(pvLui, 0.01) : 0);
}

/** Ses dégâts attendus par tour sur `cible`, en fraction des PV restants de la cible. */
function sesDegats(obs: Observation, lui: PokemonAdverse, cible: PokemonAllie, pvCible: number): number {
  const p = prevoir(obs, lui, cible);
  if (!p) {
    return 0;
  }
  const c = combattantAllie(cible);
  const d = combattantAdverse(lui);
  const parCoup = p.coups.reduce((s, coup) => s + coup.probabilite * degats(d, c, coup.attaque), 0);
  return parCoup / Math.max(pvCible, 0.01);
}

/**
 * `autres` : en combat double, ce que les autres adversaires m'infligent par tour (fraction de mes
 * PV max). Remarque de Carlos (01/10) : en 2 contre 2, il a laissé en place un Pokémon faible face
 * aux deux adversaires, mis K.O. d'un coup ; le plan ne comptait que les coups de celui qu'il visait.
 */
function duel(obs: Observation, moi: PokemonAllie, pvMoi: number, lui: PokemonAdverse, pvLui: number, autres = 0): Duel {
  const parTourMoi = Math.max(0, ...mesDegats(moi, lui, pvLui));
  const parTourLui = sesDegats(obs, lui, moi, pvMoi) + autres / Math.max(pvMoi, 0.01);
  return {
    mesTours: tours(parTourMoi),
    sesTours: tours(parTourLui),
    plusRapide: vitesse(combattantAllie(moi)) > vitesse(combattantAdverse(lui)),
    parTourMoi,
    parTourLui,
  };
}

/** Combat double : ce que les adversaires autres que `lui` infligent par tour à `cible` (fraction de ses PV max). */
function degatsDesAutres(obs: Observation, lui: PokemonAdverse, cible: PokemonAllie, adversaires: PokemonAdverse[]): number {
  return adversaires.filter(a => a.uid !== lui.uid).reduce((t, a) => t + sesDegats(obs, a, cible, 1), 0);
}

/** Valeur d'un duel joué jusqu'au bout : ~+1 gagné (+ PV restants), ~−1 perdu (+ dégâts infligés). */
function valeurDuel(d: Duel): number {
  const gagne = d.plusRapide ? d.mesTours <= d.sesTours : d.mesTours < d.sesTours;
  if (gagne) {
    const coupsRecus = d.plusRapide ? d.mesTours - 1 : d.mesTours;
    return 1 + 0.5 * Math.max(0, 1 - coupsRecus * d.parTourLui);
  }
  const coupsDonnes = d.plusRapide ? d.sesTours : d.sesTours - 1;
  // Duel perdu : les dégâts infligés restent acquis pour le Pokémon suivant (combat d'équipe). Avec
  // un poids 0,5, toutes les options d'un duel perdu valaient environ −1 et le cerveau tranchait seul :
  // attaque du même type que lui, même résistée (Flammèche sur Salamèche…), au lieu de la plus forte.
  return -1 + POIDS_DEGATS_PERDU * Math.min(1, coupsDonnes * d.parTourMoi);
}

/**
 * Combiner les scénarios (un par coup possible de l'adversaire) : l'espérance (somme des valeurs
 * pondérées par leurs probabilités — l'« expectimax » des moteurs de jeu face au hasard), moins une
 * part de prudence qui rapproche du pire scénario plausible (probabilité ≥ 10 %).
 * Idée de Carlos : juger chaque décision face au top 3 des coups de l'adversaire, pas seulement
 * face au coup qu'on croit le plus probable.
 */
function combiner(scenarios: { proba: number; valeur: number }[], prudence: number): number {
  const total = scenarios.reduce((t, x) => t + x.proba, 0) || 1;
  const esperance = scenarios.reduce((t, x) => t + x.proba * x.valeur, 0) / total;
  const plausibles = scenarios.filter(x => x.proba / total >= 0.1);
  const pire = Math.min(...(plausibles.length ? plausibles : scenarios).map(x => x.valeur));
  return esperance - prudence * (esperance - pire);
}

/** Les coups possibles de l'adversaire contre `cible` ce tour-ci : probabilité et dégâts (fraction des PV restants). */
function scenariosContre(obs: Observation, lui: PokemonAdverse, visee: PokemonAllie, recoit: PokemonAllie): { proba: number; recu: number }[] {
  const p = prevoir(obs, lui, visee); // il choisit contre celui qui est en face (visee)
  const pvR = recoit.pv / Math.max(recoit.pvMax, 1);
  const r = combattantAllie(recoit);
  const d = combattantAdverse(lui);
  return (p?.coups ?? []).map(c => ({ proba: c.probabilite, recu: degats(d, r, c.attaque) / Math.max(pvR, 0.01) }));
}

/** Attaquer avec l'attaque `i`, en recevant `recu` (fraction de mes PV restants) ce tour-ci. */
function valeurAttaqueSelon(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, ceTour: number, d: Duel, recu: number, autres = 0): number {
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  if (ceTour >= 1 && (d.plusRapide || recu < 1)) {
    return 1.5 + 0.5 * (d.plusRapide ? 1 : 1 - recu); // il tombe ce tour-ci
  }
  if (!d.plusRapide && recu >= 1) {
    return -1; // il me met K.O. avant que je frappe
  }
  if (d.plusRapide && recu >= 1) {
    return -1 + POIDS_DEGATS_PERDU * Math.min(1, ceTour); // je frappe, puis je tombe
  }
  // Les deux encaissent ; la suite est une course au K.O. avec ma meilleure attaque.
  const pvLuiApres = pvLui * (1 - ceTour);
  const pvMoiApres = pvMoi * (1 - recu);
  return valeurDuel(duel(obs, moi, pvMoiApres, lui, pvLuiApres, autres)) - PENALITE_PLUS_FAIBLE * (1 - ceTour / Math.max(d.parTourMoi, 0.01));
}

/** Attaquer avec l'attaque `i` cet adversaire ce tour-ci, puis jouer au mieux. */
function valeurAttaque(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, i: number, options: OptionsPlan, autres = 0): number {
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  const ceTour = mesDegats(moi, lui, pvLui)[i] ?? 0;
  const d = duel(obs, moi, pvMoi, lui, pvLui, autres);
  const scenarios = options.scenarios ? scenariosContre(obs, lui, moi, moi) : [];
  const recuDesAutres = autres / Math.max(pvMoi, 0.01);
  const valeur = scenarios.length
    ? combiner(scenarios.map(x => ({ proba: x.proba, valeur: valeurAttaqueSelon(obs, moi, lui, ceTour, d, x.recu + recuDesAutres, autres) })), options.prudence ?? 0)
    : valeurAttaqueSelon(obs, moi, lui, ceTour, d, d.parTourLui, autres); // dégâts moyens
  // S'il change pour X, mon attaque frappe X, et je ne reçois rien ce tour-ci.
  return avecChangement(obs, lui, moi, options, valeur, vers => {
    const x = vers ?? inconnuComme(lui);
    const pvX = x.pvPourcent / 100;
    const surX = mesDegats(moi, x, pvX)[i] ?? 0;
    return surX >= 1 ? 1.5 : valeurDuel(duel(obs, moi, pvMoi, x, pvX * (1 - surX), autres));
  });
}

/** Changer pour `remplacant` : il reçoit le coup choisi contre celui qui part, puis la course. */
function valeurChangement(obs: Observation, partant: PokemonAllie, remplacant: PokemonAllie, lui: PokemonAdverse, options: OptionsPlan,
  autres = 0): number {
  const pvR = remplacant.pv / Math.max(remplacant.pvMax, 1);
  const scenarios = scenariosContre(obs, lui, partant, remplacant);
  if (!scenarios.length) {
    return 0;
  }
  // En double, le remplaçant encaisse aussi les coups des autres adversaires dès ce tour-ci.
  const recuDesAutres = autres / Math.max(pvR, 0.01);
  const valeur = (recu: number) => (recu + recuDesAutres >= 1
    ? -1.5
    : valeurDuel(duel(obs, remplacant, pvR * (1 - recu - recuDesAutres), lui, lui.pvPourcent / 100, autres)) - 0.15);
  const reste = options.scenarios
    ? combiner(scenarios.map(x => ({ proba: x.proba, valeur: valeur(x.recu) })), options.prudence ?? 0)
    : valeur(scenarios.reduce((t, x) => t + x.proba * x.recu, 0)); // dégâts moyens
  // S'il change aussi (il décide contre celui qui part) : mon remplaçant affronte X, sans coup reçu.
  const v = avecChangement(obs, lui, partant, options, reste,
    vers => {
      const x = vers ?? inconnuComme(lui);
      return valeurDuel(duel(obs, remplacant, pvR, x, x.pvPourcent / 100, autres)) - 0.15;
    });
  // Le remplaçant perd aussi son duel : changer ne fait que perdre un tour et des PV. Si celui en
  // place tombe, le remplaçant entrera ensuite sans encaisser de coup. Sans cette règle, chaque
  // changement « esquivait » le coup prévu et paraissait meilleur qu'une attaque notée −1 ; au tour
  // suivant, le même calcul faisait rechanger (remarque de Carlos, 04/10 : il perd des tours).
  return reste < 0 ? Math.min(v, CHANGEMENT_PERDU) : v;
}

const DEPARTAGE_DEGATS = 0.002;
const GAIN_RARE = 3;
const PENALITE_KO_RARE = 1;
const BONUS_RARE = 0.5;
const PV_AVANT_BALL = 30;

const rareACapturer = (lui: PokemonAdverse) => !!lui.rare && (!lui.boss || lui.boss.segmentsRestants <= 1);

function valeursContreUnRare(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, valeurs: number[], masque: boolean[]): number[] {
  const degats = mesDegats(moi, lui, lui.pvPourcent / 100);
  const attaques = Array.from({ length: PREMIER_CHANGEMENT }, (_, a) => a).filter(a => masque[a]);
  const coup = (a: number) => degats[Math.floor(a / 2)] ?? 0;
  for (const a of attaques) {
    if (coup(a) >= 1) {
      valeurs[a] = (valeurs[a] ?? 0) - PENALITE_KO_RARE;
    }
  }
  const sansKo = attaques.filter(a => coup(a) > 0 && coup(a) < 1);
  const affaiblir = lui.pvPourcent > PV_AVANT_BALL && sansKo.length > 0;
  if (affaiblir) {
    for (const a of sansKo) {
      valeurs[a] = (valeurs[a] ?? 0) + BONUS_RARE;
    }
  }
  const plancher = Math.min(...sansKo.map(a => valeurs[a] ?? 0), Infinity);
  for (let action = PREMIERE_BALL; action < NOMBRE_ACTIONS; action++) {
    valeurs[action] = !masque[action] ? 0
      : affaiblir ? Math.min(valeurBallRatee(obs, moi, lui), plancher) - BONUS_RARE
        : valeurBall(obs, moi, lui, action - PREMIERE_BALL, GAIN_RARE) + BONUS_RARE;
  }
  return valeurs;
}

/** Valeur d'un changement vers un duel perdu : sous toute attaque (au pire −1). */
const CHANGEMENT_PERDU = -1.2;

/** Lancer la Ball n° `ball` : capture (combat gagné sans un coup de plus) ou échec (il frappe). */
function valeurBall(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse, ball: number, gainCapture?: number): number {
  const p = chanceCapture(lui, ball);
  // Une capture vaut un K.O. (combat gagné, expérience donnée) plus un membre : utile tant que
  // l'équipe n'est pas pleine, ensuite seulement si l'espèce promet plus que le plus faible des six.
  const potentiel = (espece: number) => connaissance(espece)?.totalFinal ?? 0;
  const plusFaible = Math.min(...obs.equipe.map(m => potentiel(m.espece)));
  const membre = obs.equipe.length < 6 ? 0.3 : Math.max(0, Math.min(0.3, (potentiel(lui.espece) - plusFaible) / 300));
  // Mesuré (v4, 160 parties, arrêt à 50) : Balls neutres 37,1 ; jugées avec gain 2 + 0,5 : 35,3 ;
  // avec 1,6 + 0,3 : 31,9. Les captures fréquentes rapportent plus qu'elles ne coûtent : l'option
  // reste désactivée par défaut (extension et entraînement), le calcul sert à l'affichage.
  const gain = gainCapture ?? 1.6 + membre;
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  const d = duel(obs, moi, pvMoi, lui, pvLui);
  const echec = d.parTourLui >= 1 ? -1 : valeurDuel(duel(obs, moi, pvMoi * (1 - d.parTourLui), lui, pvLui)) - 0.1;
  return p * gain + (1 - p) * echec;
}

/**
 * La règle de capture de Carlos (01/10) : « que la capture s'active uniquement si l'équipe n'est
 * pas complète ou que le Pokémon servira à en remplacer un autre, et sans risque pour nos propres
 * Pokémon — pas qu'il se retrouve face à un Mewtwo et veuille absolument l'avoir au lieu de le
 * battre ». Mesuré (01/10, 240 parties, arrêt à la vague 26) : forcer en plus l'affaiblissement
 * avant la Ball faisait arriver l'équipe blessée au rival (rival 1 : 91 % → 76 %, rival 2 :
 * 72 % → 55 %). Et interdire toute Ball contre un Pokémon dangereux faisait perdre contre les boss
 * des vagues 20 et 50 (480 parties : 52 défaites → 87) : capturer un boss affaibli termine le
 * combat. On interdit donc la Ball inutile ou dangereuse seulement quand sa chance est faible
 * (sous 50 %) : c'est le cas vu par Carlos, Balls ratées pendant que l'équipe tombe. Sinon, le
 * cerveau garde la main.
 */
const TOURS_SURS = 3;             // il lui faut au moins 3 tours pour mettre mon Pokémon K.O.
const MARGE_POTENTIEL = 30;       // équipe pleine : l'espèce doit dépasser la plus faible de 30 points
const MASTER_BALL = 4;
const CHANCE_SURE = 0.5;          // au-dessus, une Ball termine souvent le combat : toujours permise
const POTENTIEL_MASTER = 580;     // la Master Ball reste pour les espèces d'exception
/**
 * Équipe pleine : une Ball « utile » (le Pokémon remplacerait un membre) n'est permise qu'à partir de
 * cette chance. Remarque de Carlos (04/10) : il lançait une Poké Ball sur un Pokémon en pleine forme
 * qu'il pouvait mettre K.O. d'un coup, puis devait racheter des Balls.
 */
const CHANCE_MIN_EQUIPE_PLEINE = 0.3;

/** L'équipe n'est pas pleine, ou l'espèce remplacerait avantageusement la plus faible des six, ou
 * elle comble un trou face aux starters possibles du rival qui approche. */
function captureUtile(obs: Observation, lui: PokemonAdverse): boolean {
  if (obs.equipe.length < 6) {
    return true;
  }
  const potentiel = (espece: number) => connaissance(espece)?.totalFinal ?? 0;
  return potentiel(lui.espece) - Math.min(...obs.equipe.map(m => potentiel(m.espece))) >= MARGE_POTENTIEL
    || comblePreparation(obs, lui);
}

/** Avant un rival (vagues 1 à 25) : ce sauvage frappe-t-il en super efficace (avec son propre type)
 * un des starters possibles du rival que personne de l'équipe ne frappe ainsi ? */
function comblePreparation(obs: Observation, lui: PokemonAdverse): boolean {
  if (obs.partie.vague > 25) {
    return false;
  }
  const niveauMax = Math.max(...obs.equipe.map(m => m.niveau), 1);
  const couvert = (t: number) => obs.equipe.some(m => m.niveau >= niveauMax - 2
    && m.attaques.some(a => a.categorie.id !== 2 && a.puissance > 0 && efficacite(a.type.id, [t]) > 1));
  return STARTERS_DU_RIVAL.some(t => !couvert(t) && lui.types.some(x => efficacite(x.id, [t]) > 1));
}

/** Lancer une Ball pour rien : on encaisse son coup sans rien lui faire. */
function valeurBallRatee(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse): number {
  const pvMoi = moi.pv / Math.max(moi.pvMax, 1);
  const pvLui = lui.pvPourcent / 100;
  const d = duel(obs, moi, pvMoi, lui, pvLui);
  return d.parTourLui >= 1 ? -1 : valeurDuel(duel(obs, moi, pvMoi * (1 - d.parTourLui), lui, pvLui)) - 0.1;
}

/** Sans risque : il lui faut au moins 3 tours pour mettre mon Pokémon K.O., et je gagne le duel. */
function captureSansRisque(obs: Observation, moi: PokemonAllie, lui: PokemonAdverse): boolean {
  const d = duel(obs, moi, moi.pv / Math.max(moi.pvMax, 1), lui, lui.pvPourcent / 100);
  return d.sesTours >= TOURS_SURS && valeurDuel(d) > 0;
}

export interface OptionsPlan {
  /** Ancienne évaluation des Balls (chance de capture partout, sans la règle de Carlos). */
  capture?: boolean;
  /** Juger chaque action contre chaque coup possible de l'adversaire (sinon : ses dégâts moyens). */
  scenarios?: boolean;
  /** 0 = espérance seule ; 1 = le pire scénario plausible. */
  prudence?: number;
  /** Prévoir ses changements de Pokémon (dresseurs, banc déjà vu) et en tenir compte. */
  changements?: boolean;
  /** Contre un dresseur (combat simple) : juger attaques et changements par le combat d'équipe simulé
   * (par défaut ; false pour revenir aux duels). */
  combatEquipe?: boolean;
}

/**
 * Mêler la valeur « il reste » et la valeur « il change pour X », selon la chance qu'il change.
 * X peut être encore inconnu (null) : on joue alors le duel contre un Pokémon de force comparable.
 */
function avecChangement(obs: Observation, lui: PokemonAdverse, enFace: PokemonAllie, options: OptionsPlan,
  valeur: number, siChange: (x: PokemonAdverse | null) => number): number {
  const change = options.changements ? prevoirChangement(obs, lui, enFace) : null;
  return change ? (1 - change.probabilite) * valeur + change.probabilite * siChange(change.vers) : valeur;
}

/** Un Pokémon jamais vu : force comparable à l'actuel, en pleine forme, types inconnus (efficacité neutre). */
function inconnuComme(lui: PokemonAdverse): PokemonAdverse {
  return { ...lui, uid: -1, types: [], pvPourcent: 100, modifStats: lui.modifStats.map(() => 0), boss: null, attaquesVues: [] };
}

/**
 * Le porteur (le plus haut niveau de l'équipe) doit jouer pour monter : quand il gagne son duel,
 * il passe devant un autre membre qui le gagnerait aussi. Remarque de Carlos (01/10) : « quand le
 * porteur meurt et qu'il est réanimé, il ne le joue plus vraiment pour le monter ».
 */
const BONUS_PORTEUR = 0.4;

/**
 * Le rival 1 (vague 8) tire son starter au hasard (Plante, Feu ou Eau) ; mesuré sur 2 074 combats :
 * quand ce starter bat le type de notre porteur, on perd 15 % du temps (1 % quand c'est l'inverse),
 * et ce cas fait les trois quarts des défaites — derrière le porteur, personne (2e meilleur niveau :
 * 5,3). Le « second » : le membre qui bat le mieux ce qui contre le porteur ; avant le rival 1, il
 * prend des niveaux pendant les vagues sauvages qu'il gagne (changement gratuit de début de vague).
 */
const STARTERS_DU_RIVAL = [11, 9, 10]; // Plante, Feu, Eau (jeu : rival-party-config.ts)
const VAGUE_RIVAL_1 = 8;
const BONUS_SECOND = 0.6;
/** Retard toléré du second sur le porteur (en niveaux) avant qu'on le fasse combattre. */
const RETARD_SECOND = 99; // désactivé (03/10) : avec le moteur d'équipe, le porteur qui garde l'expérience fait mieux (97 %)

/** Ce qui contre le porteur : les types de starter du rival super efficaces contre lui. */
function menacesDuPorteur(porteur: PokemonAllie): number[] {
  const types = porteur.types.map(t => t.id);
  return STARTERS_DU_RIVAL.filter(t => efficacite(t, types) > 1);
}

/** Le second combattant à faire monter avant le rival 1, ou null. */
export function secondCombattant(obs: Observation): PokemonAllie | null {
  const vivants = obs.equipe.filter(m => !m.ko);
  const porteur = vivants.reduce<PokemonAllie | undefined>((p, m) => (!p || m.niveau > p.niveau ? m : p), undefined);
  if (!porteur) {
    return null;
  }
  const menaces = menacesDuPorteur(porteur);
  if (!menaces.length) {
    return null;
  }
  const note = (m: PokemonAllie) => {
    const types = m.types.map(t => t.id);
    return Math.min(...menaces.map(menace => {
      const attaque = Math.max(0, ...m.attaques.filter(a => a.categorie.id !== 2 && a.puissance > 0)
        .map(a => efficacite(a.type.id, [menace]) * (types.includes(a.type.id) ? 1.5 : 1)));
      const defense = 1 / Math.max(efficacite(menace, types), 0.25);
      return attaque * defense;
    }));
  };
  const candidats = vivants.filter(m => m.uid !== porteur.uid).map(m => ({ m, n: note(m) })).filter(x => x.n >= 2);
  candidats.sort((x, y) => y.n - x.n || y.m.niveau - x.m.niveau);
  return candidats[0]?.m ?? null;
}

/** Entrer en jeu sans recevoir de coup (remplacement, changement gratuit) : le pire de ses duels. */
function valeurEntree(obs: Observation, m: PokemonAllie, adversaires: PokemonAdverse[]): number {
  const pv = m.pv / Math.max(m.pvMax, 1);
  const v = Math.min(...adversaires.map(lui => valeurDuel(duel(obs, m, pv, lui, lui.pvPourcent / 100, degatsDesAutres(obs, lui, m, adversaires)))));
  const porteur = Math.max(...obs.equipe.map(e => e.niveau));
  // Avant le rival 1, contre des sauvages, le second passe devant tant qu'il a du retard (et le
  // porteur perd alors son propre bonus : sinon, plus fort, il gardait toujours la place).
  const second = !obs.partie.dresseur && obs.partie.vague < VAGUE_RIVAL_1 ? secondCombattant(obs) : null;
  if (second && second.niveau < porteur - RETARD_SECOND) {
    return v + (m.uid === second.uid && v > 0 ? BONUS_SECOND : 0);
  }
  return v + (m.niveau >= porteur && v > 0 ? BONUS_PORTEUR : 0);
}

/** Gain minimal pour accepter le changement gratuit du début de vague. */
const GAIN_CHANGEMENT_GRATUIT = 0.3;

/**
 * « Changer de Pokémon ? » au début d'une vague contre des sauvages (style de combat « Changer ») :
 * un changement gratuit, l'adversaire déjà visible. Oui si un membre du banc fait nettement mieux
 * que celui en place (porteur compris). Le remplaçant est ensuite choisi par le cerveau, guidé par
 * les mêmes valeurs (mode remplacement). `position` : la place sur le terrain (0, ou 1 en double).
 */
export function changerAuDebut(obs: Observation, position: number): boolean {
  const adversaires = obs.adversaires.filter(a => !a.ko);
  const actuel = obs.equipe.find(p => p.surTerrain && !p.ko && (p.position ?? 0) === position);
  const banc = obs.equipe.filter(p => !p.surTerrain && !p.ko);
  if (!adversaires.length || !actuel || !banc.length) {
    return false;
  }
  // Avant le rival 1 : le porteur garde l'expérience tant qu'il gagne son duel.
  const porteur = Math.max(...obs.equipe.map(m => m.niveau));
  if (obs.partie.vague < VAGUE_RIVAL_1 && actuel.niveau >= porteur
      && Math.min(...adversaires.map(lui => valeurDuel(duel(obs, actuel, actuel.pv / Math.max(actuel.pvMax, 1), lui, lui.pvPourcent / 100)))) > 0) {
    return false;
  }
  const meilleur = Math.max(...banc.map(m => valeurEntree(obs, m, adversaires)));
  return meilleur >= valeurEntree(obs, actuel, adversaires) + GAIN_CHANGEMENT_GRATUIT;
}

/**
 * La valeur de chaque action de combat (index = action du cerveau, observateur/actions.ts) ; null
 * hors combat. Les actions interdites par le masque gardent une valeur sans importance.
 */
export function planifier(obs: Observation, options: OptionsPlan = {}): number[] | null {
  const masque = obs.decision.masque;
  const adversaires = obs.adversaires.filter(a => !a.ko);
  if (!masque || !adversaires.length) {
    return null;
  }
  const valeurs = new Array<number>(NOMBRE_ACTIONS).fill(0);
  if (obs.decision.type === "remplacement" && options.combatEquipe !== false) {
    // Contre un dresseur, le remplaçant aussi est choisi par le combat d'équipe simulé.
    const equipe = valeursCombatEquipe(obs);
    if (equipe) {
      return equipe.map(v => v * ECHELLE_COMBAT_EQUIPE);
    }
  }
  if (obs.decision.type === "remplacement") {
    // Après un K.O. (ou un changement gratuit en début de vague) : le remplaçant entre sans
    // recevoir de coup ; seul compte le duel qui suit.
    for (let action = PREMIER_CHANGEMENT; action < PREMIERE_BALL; action++) {
      const r = obs.equipe[action - PREMIER_CHANGEMENT];
      if (masque[action] && r && !r.ko) {
        valeurs[action] = valeurEntree(obs, r, adversaires);
      }
    }
    return valeurs;
  }
  const moi = cibleDe(obs);
  if (obs.decision.type !== "combat" || !moi) {
    return null;
  }
  for (let action = 0; action < PREMIER_CHANGEMENT; action++) {
    const lui = adversaires.find(a => a.position === action % 2) ?? adversaires[0]!;
    valeurs[action] = masque[action]
      ? valeurAttaque(obs, moi, lui, Math.floor(action / 2), options, degatsDesAutres(obs, lui, moi, adversaires))
        + DEPARTAGE_DEGATS * Math.min(5, mesDegats(moi, lui, lui.pvPourcent / 100)[Math.floor(action / 2)] ?? 0)
      : 0;
  }
  for (let action = PREMIER_CHANGEMENT; action < PREMIERE_BALL; action++) {
    const remplacant = obs.equipe[action - PREMIER_CHANGEMENT];
    if (!masque[action] || !remplacant || remplacant.ko) {
      continue;
    }
    // Contre plusieurs adversaires : le pire des duels.
    valeurs[action] = Math.min(...adversaires.map(lui =>
      valeurChangement(obs, moi, remplacant, lui, options, degatsDesAutres(obs, lui, remplacant, adversaires))));
  }
  if (options.combatEquipe !== false) {
    const equipe = valeursCombatEquipe(obs);
    if (equipe) {
      // Contre un dresseur, le moteur décide : ses valeurs sont amplifiées pour que le cerveau ne
      // fasse que départager les égalités. Mesuré (02/10, 960 parties, rival 1) : moteur + cerveau
      // à poids égal 91 % ; moteur seul 96 % (rival qui contre notre porteur : 5 % de défaites
      // au lieu de 11-15 %).
      return equipe.map(v => v * ECHELLE_COMBAT_EQUIPE);
    }
  }
  const sauvage = adversaires.length === 1 && !obs.partie.dresseur ? adversaires[0]! : null;
  if (!sauvage) {
    return valeurs; // pas de Ball contre un dresseur (le masque les interdit)
  }
  if (rareACapturer(sauvage)) {
    return valeursContreUnRare(obs, moi, sauvage, valeurs, masque);
  }
  if (options.capture) {
    for (let action = PREMIERE_BALL; action < NOMBRE_ACTIONS; action++) {
      valeurs[action] = masque[action] ? valeurBall(obs, moi, sauvage, action - PREMIERE_BALL) : 0;
    }
    return valeurs;
  }
  // Ball inutile ou dangereuse : une Ball ratée (on encaisse son coup pour rien). Sinon, valeur
  // neutre (celle de la meilleure attaque) : le cerveau choisit.
  const ratee = valeurBallRatee(obs, moi, sauvage) - 0.2;
  const meilleureAttaque = Math.max(...valeurs.slice(0, PREMIER_CHANGEMENT).filter((_, i) => masque[i]), -2);
  const utileEtSure = captureUtile(obs, sauvage) && captureSansRisque(obs, moi, sauvage);
  const exceptionnel = (connaissance(sauvage.espece)?.totalFinal ?? 0) >= POTENTIEL_MASTER || !!sauvage.boss;
  for (let action = PREMIERE_BALL; action < NOMBRE_ACTIONS; action++) {
    const ball = action - PREMIERE_BALL;
    const chance = chanceCapture(sauvage, ball);
    const pleine = obs.equipe.length >= 6 && !exceptionnel;
    const permis = ball === MASTER_BALL ? exceptionnel
      : (utileEtSure && (!pleine || chance >= CHANCE_MIN_EQUIPE_PLEINE)) || chance >= CHANCE_SURE;
    valeurs[action] = !masque[action] ? 0 : permis ? meilleureAttaque : ratee;
  }
  return valeurs;
}
