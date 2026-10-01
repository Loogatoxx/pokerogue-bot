/**
 * Environnement d'entraînement : fait jouer le vrai jeu, sans écran, pour le cerveau Python.
 *
 * Lancé par entraineur/pont.py (un processus par partie jouée en parallèle), il se connecte en
 * TCP au Python puis enchaîne les parties qu'on lui demande. À chaque décision confiée au
 * cerveau (combat, remplacement), il envoie l'observation encodée et les actions permises, et
 * attend l'action choisie. Le reste (messages, récompenses…) suit les règles du pilote.
 *
 * Protocole (une ligne JSON par message) :
 *   Node → Python : pret · decision · fin-partie
 *   Python → Node : nouvelle-partie · action · fin
 */
import { BattleScene } from "#app/battle-scene";
import { BattleStyle } from "#enums/battle-style";
import { allMoves } from "#data/data-lists";
import { MoveCategory } from "#enums/move-category";
import { SpeciesId } from "#enums/species-id";
import { TrainerType } from "#enums/trainer-type";
import { UiMode } from "#enums/ui-mode";
import { GameManager } from "#test/framework/game-manager";
import { PromptHandler } from "#test/helpers/prompt-handler";
import net from "node:net";
import { writeHeapSnapshot } from "node:v8";
import Phaser from "phaser";
import { describe, it, vi } from "vitest";
import { decrireAction, NOMBRE_ACTIONS } from "../../../observateur/actions";
import { planifier } from "../../../observateur/planificateur";
import { prevoir } from "../../../observateur/prevision";
import { Carnet } from "../../../observateur/carnet";
import { encoder, TAILLE_OBSERVATION, VERSION_ENCODAGE } from "../../../observateur/encodeur";
import type { PokemonJeu, ScenePokerogue } from "../../../observateur/jeu";
import { observer } from "../../../observateur/observateur";
import { type Observation, VERSION_OBSERVATION } from "../../../observateur/types";
import {
  decisionCerveauEnAttente,
  executerAction,
  nouvelEtatPilote,
  repondreParRegles,
} from "../../../pilote/pilote";
import {
  compterInstances,
  demarrerPartie,
  minuteriesEnAttente,
  photoDeLaVague,
  reprendrePartie,
  taillesCollections,
  vraiHasard,
} from "./outils-partie";

const PORT = Number(process.env.PONT_PORT);
const ID = Number(process.env.PONT_ID ?? 0);
/** Un compte neuf : les starters ont 15 dans chaque IV. */
const IVS_COMPTE_NEUF = [15, 15, 15, 15, 15, 15];
const STARTERS_PAR_DEFAUT = [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE];
/** Attente maximale d'une réponse du Python (il peut être occupé à apprendre). */
const ATTENTE_MAX_MS = 30 * 60_000;
/**
 * Sans décision du cerveau en attente, si rien n'avance pendant ce délai, c'est qu'un écran du jeu
 * attend une touche que le pilote ne sait pas donner : la partie s'arrête en le signalant.
 */
const BLOCAGE_MS = 60_000;
const DECISIONS_MAX = 20_000;

type MessagePython =
  | {
      type: "nouvelle-partie";
      graine?: string;
      especes?: number[];
      styleCombat?: "fixe" | "changer";
      vagueMax?: number;
      /** Renvoyer aussi le récit de la partie (analyse des défaites) ; ~1 Ko de plus par partie. */
      recit?: boolean;
      /** Repartir d'une photo (sauvegarde du début d'une vague) au lieu d'une nouvelle partie. */
      depart?: string;
      /** Vagues dont on veut la photo du début (pour s'entraîner ensuite sur ces combats). */
      photos?: number[];
    }
  | { type: "action"; action: number }
  | { type: "fin" };

/** Connexion au Python : messages JSON, un par ligne. */
class Canal {
  private tampon = "";
  private recus: MessagePython[] = [];
  private attentes: ((m: MessagePython) => void)[] = [];
  private ferme = false;

  constructor(private readonly socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (morceau: string) => {
      this.tampon += morceau;
      let fin: number;
      while ((fin = this.tampon.indexOf("\n")) >= 0) {
        const message = JSON.parse(this.tampon.slice(0, fin)) as MessagePython;
        this.tampon = this.tampon.slice(fin + 1);
        const attente = this.attentes.shift();
        attente ? attente(message) : this.recus.push(message);
      }
    });
    // Le Python s'est arrêté : on débloque tout le monde avec « fin ».
    socket.on("close", () => {
      this.ferme = true;
      this.attentes.splice(0).forEach(a => a({ type: "fin" }));
    });
  }

  envoyer(message: object): void {
    this.socket.write(`${JSON.stringify(message)}\n`);
  }

  recevoir(): Promise<MessagePython> {
    const message = this.recus.shift() ?? (this.ferme ? ({ type: "fin" } as const) : undefined);
    return message ? Promise.resolve(message) : new Promise(r => this.attentes.push(r));
  }

  static ouvrir(port: number): Promise<Canal> {
    return new Promise((ok, ko) => {
      const socket = net.connect(port, "127.0.0.1", () => ok(new Canal(socket)));
      socket.on("error", ko);
    });
  }
}

type Horloge = { _active?: { callback?: unknown; remove(declencher?: boolean): void }[]; removeAllEvents(): void };

/**
 * Sans écran, certaines minuteries du jeu ne s'arrêtent jamais (minuteries sans action, effets de
 * particules) : elles s'accumulent partie après partie et l'horloge simulée les parcourt toutes,
 * chaque milliseconde. Mesuré : 22 → 118 ms par décision en 120 parties. On fait donc le ménage.
 */
function retirerMinuteriesVides(horloge: Horloge): void {
  for (const minuterie of horloge._active ?? []) {
    if (!minuterie.callback) {
      minuterie.remove(false);
    }
  }
}

/** Ce que le Python reçoit à chaque décision pour calculer la récompense. */
function infoPartie(obs: Observation) {
  const pvEquipe = obs.equipe.reduce((s, p) => s + p.pv, 0) / Math.max(obs.equipe.reduce((s, p) => s + p.pvMax, 0), 1);
  return {
    vague: obs.partie.vague,
    tour: obs.partie.tour,
    pvEquipe,
    koEquipe: obs.equipe.filter(p => p.ko).length,
    tailleEquipe: obs.equipe.length,
    pvAdversaires: obs.adversaires.reduce((s, a) => s + a.pvPourcent / 100, 0) / Math.max(obs.adversaires.length, 1),
  };
}

// ─── Récit d'une partie (pour l'analyse des défaites, pas pour le cerveau) ──────────────────────

interface PokemonRecit {
  name: string;
  level: number;
  hp: number;
  getMaxHp(): number;
  isFainted(): boolean;
  getMoveset(): { getName(): string }[];
}

/** Ce qu'on retient de chaque vague : les forces en présence au moment où elle commence. */
interface EtapeRecit {
  vague: number;
  /** Type de dresseur (ex. RIVAL), ou null pour un Pokémon sauvage. */
  dresseur: string | null;
  /** Niveaux de l'équipe, et ses PV restants en % du total. */
  equipe: number[];
  pvEquipe: number;
  adversaires: number[];
  /** Nombre d'objets portés par l'équipe (piles comprises). */
  objets: number;
  /** Attaques choisies pendant la vague alors qu'une attaque offensive était utilisable :
   * de statut (Rugissement, Mimi-Queue…) ou offensives. */
  attaquesStatut: number;
  attaquesOffensives: number;
}

const resumer = (p: PokemonRecit) => ({
  nom: p.name,
  niveau: p.level,
  pv: Math.round((100 * p.hp) / Math.max(p.getMaxHp(), 1)),
  attaques: p.getMoveset().map(a => a.getName()),
});

type SceneRecit = {
  currentBattle?: { waveIndex: number; turn: number; double: boolean; trainer?: { config: { trainerType: number } } | null };
  getPlayerParty(): PokemonRecit[];
  getEnemyParty(): PokemonRecit[];
  modifiers: { type: { id: string }; getStackCount(): number }[];
};

function dresseurDe(scene: SceneRecit): string | null {
  const type = scene.currentBattle?.trainer?.config.trainerType;
  return type === undefined ? null : (TrainerType[type] ?? String(type));
}

function objetsPortes(scene: SceneRecit): Record<string, number> {
  const objets: Record<string, number> = {};
  for (const m of scene.modifiers) {
    objets[m.type.id] = (objets[m.type.id] ?? 0) + m.getStackCount();
  }
  return objets;
}

/**
 * Un objet graphique détruit ? Phaser efface `scene` d'un objet qu'il détruit ; un faux sprite de
 * l'outil de test enveloppe un vrai sprite Phaser. Les autres faux objets (textes, rectangles…) ne
 * disent pas s'ils sont détruits : on les garde (le jeu en cherche parfois un par sa position).
 */
function estDetruit(objet: unknown): boolean {
  if (objet instanceof Phaser.GameObjects.GameObject) {
    return objet.scene === undefined;
  }
  const faux = objet as { phaserSprite?: Phaser.GameObjects.Sprite } | null;
  return faux?.phaserSprite !== undefined && faux.phaserSprite.scene === undefined;
}

/** Retire les objets détruits de ce conteneur et, récursivement, de ses sous-conteneurs. */
function retirerDetruits(conteneur: unknown, vus = new Set<unknown>()): void {
  const liste = (conteneur as { list?: unknown } | null)?.list;
  if (!Array.isArray(liste) || vus.has(conteneur)) {
    return;
  }
  vus.add(conteneur);
  const vivants = liste.filter(o => !estDetruit(o));
  if (vivants.length !== liste.length) {
    liste.splice(0, liste.length, ...vivants);
  }
  for (const enfant of liste) {
    retirerDetruits(enfant, vus);
  }
}

/**
 * Ménage entre deux parties d'un même processus. L'outil de test du jeu est fait pour des tests
 * courts : ici, des milliers de parties s'enchaînent dans la même scène, et tout ce qu'il garde
 * s'accumulait (mémoire ×5, copie 7 fois plus lente en 40 parties). Chaque point a été trouvé en
 * mesurant (PONT_COMPTAGE=1 : objets vivants par classe ; PONT_INSTANTANE : photo de la mémoire,
 * puis plus court chemin des racines jusqu'aux Pokémon des parties finies).
 * Appelé en fin de partie, et au début de la suivante, une fois la scène remise à zéro (c'est là
 * que l'ancienne équipe est détruite).
 */
function menageEntreParties(game: GameManager): void {
  // Plus aucune minuterie n'a de raison de continuer (voir retirerMinuteriesVides).
  (game.scene.time as unknown as Horloge).removeAllEvents();
  // L'outil range dans une liste chaque objet graphique simulé qu'il crée (sprites, textes,
  // conteneurs…), même détruit, et ne la lit jamais. Même chose pour l'historique des appels des
  // fonctions espionnes (vi.fn), sans toucher à ce qu'elles renvoient.
  (game.scene.textures as unknown as { list: unknown[] }).list.length = 0;
  vi.clearAllMocks();
  // Chaque sprite s'inscrit auprès du gestionnaire d'animations global (événement « remove », pour
  // s'arrêter si on supprime l'animation qu'il joue) et ne s'en désinscrit qu'à sa destruction, que
  // le jeu n'appelle pas toujours (+500 écouteurs par courte partie). Inutile sans écran.
  (game.scene.sys as unknown as { anims: { removeAllListeners(nom: string): void } }).anims.removeAllListeners("remove");
  // Le terrain, les cadres d'info et toute l'interface sont rangés dans des conteneurs simulés : un
  // faux sprite détruit ne s'en retire pas, et un vrai objet Phaser (dresseur, Pokémon, option de
  // récompense…) ne sait pas qu'il y est rangé. L'écran des récompenses, par exemple, gardait les
  // options de chaque vague (+850). On retire, partout, les objets détruits.
  for (const racine of [game.scene.field, game.scene.fieldUI, game.scene.ui]) {
    retirerDetruits(racine);
  }
  // Le gestionnaire des étincelles (Pokémon chromatiques) garde chaque sprite de Pokémon, et les
  // écrans (équipe…) une table d'animation de chaque icône de Pokémon affichée (+1 000 en quelques
  // parties) : ils retenaient les Pokémon de toutes les parties.
  (game.scene as unknown as { spriteSparkleHandler: { sprites: Set<unknown> } }).spriteSparkleHandler.sprites.clear();
  for (const ecran of (game.scene.ui as unknown as { handlers: ({ iconAnimHandler?: { icons?: Map<unknown, unknown> } } | undefined)[] }).handlers) {
    ecran?.iconAnimHandler?.icons?.clear();
  }
  // Sans écran, la boucle d'affichage de Phaser ne tourne jamais : les objets à animer s'empilent
  // dans sa file d'attente sans jamais être traités.
  const aAnimer = game.scene.sys.updateList as unknown as { _pending: unknown[]; _destroy: unknown[] };
  aAnimer._pending.length = 0;
  aAnimer._destroy.length = 0;
  // Les journaux de l'outil (phases jouées, textes affichés, touches) grossissent aussi.
  game.phaseInterceptor.clearLogs();
  game.textInterceptor.clearLogs();
  // (le gestionnaire de touches n'existe pas toujours : `?.`)
  game.inputsHandler?.log.splice(0);
  game.inputsHandler?.logUp.splice(0);
}

/** Parties jouées par ce processus (pour la photo de la mémoire du diagnostic). */
let partiesJouees = 0;

async function jouerPartie(
  phaserGame: Phaser.Game,
  canal: Canal,
  demande: {
    graine?: string;
    especes?: number[];
    styleCombat?: "fixe" | "changer";
    vagueMax?: number;
    recit?: boolean;
    depart?: string;
    photos?: number[];
  },
) {
  // Nettoyage entre deux parties d'un même processus (normalement fait par l'outil de test
  // entre deux tests) : sans lui, les « espions » de l'outil s'empileraient partie après partie.
  // clearAllMocks vide l'historique d'appels que chaque espion garde (sinon la mémoire grossit
  // à chaque partie) ; restoreAllMocks remet les fonctions d'origine.
  vi.clearAllMocks();
  vi.restoreAllMocks();
  // Diagnostic : photo de la mémoire au début de la partie n° PONT_INSTANTANE_PARTIE. À ce moment,
  // tout Pokémon encore en mémoire appartient à une partie finie, donc fuit.
  if (process.env.PONT_INSTANTANE && ++partiesJouees === Number(process.env.PONT_INSTANTANE_PARTIE ?? 6)) {
    writeHeapSnapshot(process.env.PONT_INSTANTANE);
  }
  if (PromptHandler.runInterval) {
    clearInterval(PromptHandler.runInterval);
    PromptHandler.runInterval = undefined;
  }
  const game = new GameManager(phaserGame);
  // La scène vient d'être remise à zéro (l'équipe de la partie précédente est détruite) : ménage.
  menageEntreParties(game);
  BattleScene.prototype.randBattleSeedInt = vraiHasard;
  game.override.normalizeIVs = false;
  game.override.normalizeNatures = false;
  game.override.disableShinies = false;
  game.override.removeEnemyStartingItems = false;
  // Style « Changer » : le jeu demande « Changer de Pokémon ? » après chaque K.O. adverse
  // (réglage possible du joueur en ligne) ; « Fixe » : il ne demande rien.
  game.settings.battleStyle(demande.styleCombat === "changer" ? BattleStyle.SWITCH : BattleStyle.SET);

  const scene: ScenePokerogue = game.scene;
  const intercepteur = game.phaseInterceptor as unknown as { state: string };
  const carnet = new Carnet();
  const etat = nouvelEtatPilote();
  const graine = demande.graine ?? Math.random().toString(36).slice(2, 12);
  const debut = performance.now();
  let decisions = 0;
  let phases = 0;
  /** Pokémon capturés et gardés pendant la partie (l'équipe s'agrandit). */
  let captures = 0;
  /**
   * Nouveaux venus dans l'équipe depuis le départ, y compris à la place d'un membre (un identifiant
   * de Pokémon jamais vu dans l'équipe). C'est ce que récompense l'entraînement : avec l'équipe
   * pleine, capturer un meilleur Pokémon que l'un des six compte aussi (idée de Carlos).
   */
  let recrues = 0;
  const membresConnus = new Set<number>();
  const compterRecrues = (o: Observation) => {
    const depart = membresConnus.size === 0;
    for (const membre of o.equipe) {
      if (!membresConnus.has(membre.uid)) {
        membresConnus.add(membre.uid);
        recrues += depart ? 0 : 1;
      }
    }
    return recrues;
  };
  let tailleEquipe = 0;
  let enAttente = false;
  let erreur: string | undefined;
  let victoire = false;
  /** Vrai si la partie a été arrêtée à la vague maximale demandée (programme progressif). */
  let tronquee = false;
  /** Combien de fois chaque règle du pilote a servi (ex. « récompense », « ne change pas »). */
  const regles: Record<string, number> = {};
  const sceneRecit = game.scene as unknown as SceneRecit;
  const recit: EtapeRecit[] = [];
  /** Photos du début des vagues demandées (texte de la sauvegarde du jeu). */
  const photos: Record<number, string> = {};
  let defaite: Record<string, unknown> | undefined;
  /**
   * Précision du prédicteur de l'IA adverse (observateur/prevision.ts), mesurée en jouant : à
   * chaque décision, ce qu'il annonce pour chaque adversaire ; une fois les ordres de l'adversaire
   * donnés, ce qu'il joue vraiment.
   */
  const prediction = { tours: 0, exacts: 0, memeType: 0, probabilite: 0, changements: 0, statut: 0, horsPrevision: 0 };
  // (dans un objet : la minuterie le remplit, la boucle le lit — TypeScript ne suit pas une variable modifiée ailleurs)
  const annonces: { courantes: Map<number, { ids: number[]; probas: number[]; types: number[] }> | null } = { courantes: null };
  // Actions refusées par le jeu pour la décision en cours (ex. changement alors qu'on est piégé).
  let cleDecision = "";
  const refusees = new Set<number>();
  /** Dernière action jouée pour la décision en cours (pour repérer un refus silencieux). */
  let derniereAction: number | null = null;
  /** Dernière fois que quelque chose a avancé (phase lancée, touche pressée, réponse du cerveau). */
  let derniereActivite = performance.now();
  const bloque = () => {
    if (!enAttente && performance.now() - derniereActivite > BLOCAGE_MS) {
      const ecran = UiMode[game.scene.ui.getMode()];
      erreur = `bloqué ${BLOCAGE_MS / 1000} s sur ${game.scene.phaseManager.getCurrentPhase()?.phaseName} / ${ecran}`;
    }
    return !!erreur;
  };

  /** Récit : l'attaque choisie était-elle de statut alors qu'il pouvait frapper ? */
  const noterAttaque = (action: number) => {
    const decrite = decrireAction(action);
    const etape = recit.at(-1);
    const phase = game.scene.phaseManager.getCurrentPhase() as unknown as { getPokemon?(): PokemonJeu };
    const pokemon = phase.getPokemon?.();
    if (decrite.type !== "attaque" || !etape || !pokemon) {
      return;
    }
    const attaques = pokemon.getMoveset();
    const offensivePossible = attaques.some(
      a => a.getMove().category !== MoveCategory.STATUS && a.isUsable(pokemon, false, true)[0],
    );
    const choisie = attaques[decrite.attaque]?.getMove();
    if (offensivePossible && choisie) {
      if (choisie.category === MoveCategory.STATUS) {
        etape.attaquesStatut++;
      } else {
        etape.attaquesOffensives++;
      }
    }
  };

  const minuteur = setInterval(() => {
    if (enAttente || erreur) {
      return;
    }
    try {
      if (!decisionCerveauEnAttente(scene)) {
        const fait = repondreParRegles(scene, etat)?.split(" :")[0];
        if (fait) {
          derniereActivite = performance.now();
        }
        if (fait && fait !== "suite") {
          regles[fait] = (regles[fait] ?? 0) + 1;
        }
        return;
      }
      carnet.mettreAJour(scene);
      const obs = observer(scene, carnet);
      if (!obs?.decision.masque) {
        return;
      }
      const cle = `${obs.partie.vague}:${obs.partie.tour}:${obs.decision.phase}:${obs.decision.positionActeur}`;
      if (cle !== cleDecision) {
        cleDecision = cle;
        refusees.clear();
      } else if (derniereAction !== null) {
        // La même décision revient après qu'on a joué : l'action n'a pas marché (le jeu l'a
        // refusée sans le dire, ex. un remplaçant qu'il n'accepte pas). On l'interdit ici.
        refusees.add(derniereAction);
      }
      if (decisions > DECISIONS_MAX) {
        erreur = `plus de ${DECISIONS_MAX} décisions`;
        return;
      }
      if (demande.recit && obs.decision.type === "combat") {
        const parPlace = new Map<number, { ids: number[]; probas: number[]; types: number[] }>();
        for (const a of obs.adversaires) {
          const p = prevoir(obs, a);
          if (p) {
            parPlace.set(a.position, {
              ids: p.coups.map(c => c.attaque.id),
              probas: p.coups.map(c => c.probabilite),
              types: p.coups.map(c => c.attaque.type),
            });
          }
        }
        annonces.courantes = parPlace;
      }
      const etape = recit.at(-1);
      if (demande.recit && etape && etape.adversaires.length === 0) {
        etape.adversaires = sceneRecit.getEnemyParty().map(p => p.level);
        etape.dresseur = dresseurDe(sceneRecit);
      }
      const masque = obs.decision.masque.map((permise, i) => permise && !refusees.has(i));
      if (!masque.some(Boolean)) {
        erreur = "aucune action permise";
        return;
      }
      enAttente = true;
      decisions++;
      canal.envoyer({
        type: "decision",
        // Les 1 290 nombres en binaire (base64) : plus rapide et plus exact que du texte.
        observation: Buffer.from(encoder(obs).buffer).toString("base64"),
        masque: masque.map(Number),
        // La valeur de chaque action selon le planificateur (observateur/planificateur.ts).
        plan: planifier(obs),
        info: { ...infoPartie(obs), recrues: compterRecrues(obs) },
      });
      canal.recevoir().then(message => {
        if (message.type !== "action") {
          erreur = message.type === "fin" ? "arrêt demandé" : `message inattendu : ${message.type}`;
        } else {
          if (demande.recit) {
            noterAttaque(message.action);
          }
          if (!executerAction(scene, message.action, etat)) {
            refusees.add(message.action);
          }
          derniereAction = message.action;
        }
        derniereActivite = performance.now();
        enAttente = false;
      });
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }, 0);

  try {
    if (demande.depart) {
      await reprendrePartie(game, demande.depart, graine);
    } else {
      await demarrerPartie(game, (demande.especes ?? STARTERS_PAR_DEFAUT) as SpeciesId[], graine, IVS_COMPTE_NEUF);
    }
    let vagueSuivie = -1;
    let phasesDansLaVague = 0;
    for (;;) {
      await vi.waitUntil(() => intercepteur.state === "idling" || bloque(), { interval: 0, timeout: ATTENTE_MAX_MS });
      if (erreur) {
        break;
      }
      if (minuteriesEnAttente(game)) {
        await vi.waitUntil(() => !minuteriesEnAttente(game), { interval: 0, timeout: 20_000 });
      }
      carnet.mettreAJour(scene);
      const taille = game.scene.getPlayerParty().length;
      if (tailleEquipe > 0 && taille > tailleEquipe) {
        captures += taille - tailleEquipe;
      }
      tailleEquipe = taille;
      const phase = game.scene.phaseManager.getCurrentPhase();
      if (phase.is("GameOverPhase")) {
        victoire = !!(phase as unknown as { isVictory?: boolean }).isVictory;
        if (demande.recit && !victoire) {
          defaite = {
            vague: sceneRecit.currentBattle?.waveIndex ?? 0,
            dresseur: dresseurDe(sceneRecit),
            double: sceneRecit.currentBattle?.double ?? false,
            tours: sceneRecit.currentBattle?.turn ?? 0,
            equipe: sceneRecit.getPlayerParty().map(resumer),
            adversaires: sceneRecit.getEnemyParty().map(resumer),
            objets: objetsPortes(sceneRecit),
          };
        }
        break;
      }
      if (demande.recit && annonces.courantes && phase.is("TurnStartPhase")) {
        // Tous les ordres sont donnés : on compare l'annonce à ce que l'adversaire a choisi.
        const ordres = (game.scene.currentBattle as unknown as { turnCommands: Record<number, { command: number; move?: { move: number } } | null> }).turnCommands;
        for (const [place, annonce] of annonces.courantes) {
          const ordre = ordres[2 + place]; // BattlerIndex.ENEMY = 2
          if (!ordre) {
            continue;
          }
          prediction.tours++;
          if (ordre.command === 2) {
            prediction.changements++; // Command.POKEMON : il change de Pokémon
            continue;
          }
          const id = ordre.move?.move ?? -1;
          const attaque = allMoves[id];
          if (attaque && attaque.category === MoveCategory.STATUS) {
            prediction.statut++; // attaque de statut : le prédicteur ne vise que les attaques offensives
            continue;
          }
          const i = annonce.ids.indexOf(id);
          prediction.exacts += i === 0 ? 1 : 0;
          prediction.memeType += attaque && attaque.type === annonce.types[0] ? 1 : 0;
          prediction.probabilite += i >= 0 ? annonce.probas[i]! : 0;
          prediction.horsPrevision += i < 0 ? 1 : 0;
        }
        annonces.courantes = null;
      }
      if (phase.is("ScanIvsPhase")) {
        // L'écran du Scanner d'IV plante sans graphismes ; on saute seulement l'affichage.
        intercepteur.state = "running";
        phase.end();
        continue;
      }
      const vague = game.scene.currentBattle?.waveIndex ?? 0;
      if (demande.photos?.includes(vague) && !(vague in photos)) {
        const photo = photoDeLaVague(game);
        if (photo?.vague === vague) {
          photos[vague] = photo.texte;
        }
      }
      if (demande.vagueMax && vague > demande.vagueMax) {
        tronquee = true;
        break;
      }
      if (vague !== vagueSuivie) {
        vagueSuivie = vague;
        phasesDansLaVague = 0;
        if (demande.recit) {
          const equipe = sceneRecit.getPlayerParty();
          const pv = equipe.reduce((n, p) => n + p.hp, 0);
          const pvMax = equipe.reduce((n, p) => n + p.getMaxHp(), 0);
          recit.push({
            vague,
            dresseur: null,
            equipe: equipe.map(p => p.level),
            pvEquipe: Math.round((100 * pv) / Math.max(pvMax, 1)),
            adversaires: [],
            objets: Object.values(objetsPortes(sceneRecit)).reduce((a, b) => a + b, 0),
            attaquesStatut: 0,
            attaquesOffensives: 0,
          });
        }
        retirerMinuteriesVides(game.scene.time as unknown as Horloge);
      }
      if (++phasesDansLaVague > 5000 || decisions > DECISIONS_MAX) {
        erreur = `boucle à la vague ${vague}`;
        break;
      }
      phases++;
      derniereActivite = performance.now();
      intercepteur.state = "running";
      phase.start();
    }
  } catch (e) {
    erreur = e instanceof Error ? e.message.split("\n")[0] : String(e);
  } finally {
    clearInterval(minuteur);
  }
  type Emetteur = { eventNames(): (string | symbol)[]; listenerCount(nom: string | symbol): number };
  const ecouteurs = (e: Emetteur | undefined) =>
    Object.fromEntries((e?.eventNames() ?? []).map(n => [String(n), e!.listenerCount(n)]).filter(([, c]) => (c as number) > 5));
  const systemes = game.scene.sys as unknown as { events?: Emetteur; displayList?: { length: number }; updateList?: { length: number } };
  const diagnostic = {
    minuteries: (game.scene.time as unknown as Horloge)._active?.length ?? 0,
    objetsGraphiques: (game.scene.textures as unknown as { list: unknown[] }).list.length,
    affiches: systemes.displayList?.length ?? 0,
    misAJour: systemes.updateList?.length ?? 0,
    ecouteursScene: ecouteurs(systemes.events),
    ecouteursJeu: ecouteurs((game.scene as unknown as { game?: { events?: Emetteur } }).game?.events),
    ecouteursAnimations: ecouteurs((game.scene.sys as unknown as { anims?: Emetteur }).anims),
    memoireMo: Math.round(process.memoryUsage().heapUsed / 1e6),
    // Objets vivants par classe (lent, seulement pour chercher une fuite : PONT_COMPTAGE=1).
    ...(process.env.PONT_COMPTAGE
      ? {
          instances: await compterInstances(),
          collections: taillesCollections(game.scene),
          terrain: (game.scene.field as unknown as { list: object[] }).list.reduce<Record<string, number>>((n, o) => {
            const nom = o.constructor.name;
            n[nom] = (n[nom] ?? 0) + 1;
            return n;
          }, {}),
        }
      : {}),
  };
  menageEntreParties(game);

  return {
    vague: game.scene.currentBattle?.waveIndex ?? 0,
    victoire,
    tronquee,
    captures,
    recrues,
    decisions,
    phases,
    secondes: (performance.now() - debut) / 1000,
    graine,
    regles,
    // Ce qui pourrait s'accumuler d'une partie à l'autre dans ce processus (à surveiller).
    diagnostic,
    ...(demande.recit ? { recit, defaite, prediction } : {}),
    ...(demande.photos ? { photos } : {}),
    ...(erreur ? { erreur, phase: game.scene.phaseManager.getCurrentPhase()?.phaseName, ecran: UiMode[game.scene.ui.getMode()] } : {}),
  };
}

describe("Environnement d'entraînement", () => {
  it.runIf(PORT)(
    `simulateur n° ${ID}`,
    async () => {
      // Le jeu écrit énormément dans la console ; l'outil de test garderait tout en mémoire.
      for (const methode of ["log", "info", "debug", "warn", "error", "trace"] as const) {
        console[methode] = () => {};
      }
      const phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
      const canal = await Canal.ouvrir(PORT);
      canal.envoyer({
        type: "pret",
        id: ID,
        tailleEntree: TAILLE_OBSERVATION,
        nombreActions: NOMBRE_ACTIONS,
        versionObservation: VERSION_OBSERVATION,
        versionEncodage: VERSION_ENCODAGE,
      });
      for (;;) {
        const message = await canal.recevoir();
        if (message.type === "fin") {
          break;
        }
        if (message.type === "nouvelle-partie") {
          canal.envoyer({ type: "fin-partie", info: await jouerPartie(phaserGame, canal, message) });
        }
      }
    },
    7 * 24 * 3600_000,
  );
});
