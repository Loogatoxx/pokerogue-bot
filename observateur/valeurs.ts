/**
 * Accès par nom aux valeurs numériques du jeu (ex. le mode d'écran « COMMAND » vaut 2).
 * Les tables viennent de noms.ts, généré depuis le jeu et vérifié par les tests du simulateur.
 */
import { BattlerIndex, Button, Command, MoveTarget, MoveUseMode, type Nom, PartyOption, UiMode } from "./noms";

function valeurDe(table: Readonly<Record<number, Nom>>, cle: string): number {
  const entree = Object.entries(table).find(([, nom]) => nom.cle === cle);
  if (!entree) {
    throw new Error(`Valeur « ${cle} » introuvable : noms.ts ne correspond plus au jeu (relancer generer-noms.py)`);
  }
  return Number(entree[0]);
}

export const ECRAN = {
  COMMAND: valeurDe(UiMode, "COMMAND"),
  CONFIRM: valeurDe(UiMode, "CONFIRM"),
  ECLOSION: valeurDe(UiMode, "EGG_HATCH_SCENE"),
  RESUME_ECLOSIONS: valeurDe(UiMode, "EGG_HATCH_SUMMARY"),
  FIGHT: valeurDe(UiMode, "FIGHT"),
  MODIFIER_SELECT: valeurDe(UiMode, "MODIFIER_SELECT"),
  MYSTERY_ENCOUNTER: valeurDe(UiMode, "MYSTERY_ENCOUNTER"),
  OPTION_SELECT: valeurDe(UiMode, "OPTION_SELECT"),
  PARTY: valeurDe(UiMode, "PARTY"),
  POKEDEX_PAGE: valeurDe(UiMode, "POKEDEX_PAGE"),
  RENAME_POKEMON: valeurDe(UiMode, "RENAME_POKEMON"),
  SUMMARY: valeurDe(UiMode, "SUMMARY"),
  TARGET_SELECT: valeurDe(UiMode, "TARGET_SELECT"),
  TITRE: valeurDe(UiMode, "TITLE"),
};

export const BOUTON = {
  ACTION: valeurDe(Button, "ACTION"),
  CANCEL: valeurDe(Button, "CANCEL"),
};

export const COMMANDE = {
  FIGHT: valeurDe(Command, "FIGHT"),
  BALL: valeurDe(Command, "BALL"),
  POKEMON: valeurDe(Command, "POKEMON"),
  /** Attaquer en Téracristallisant (même curseur d'attaque que FIGHT). */
  TERA: valeurDe(Command, "TERA"),
};

export const USAGE_ATTAQUE_NORMAL = valeurDe(MoveUseMode, "NORMAL");

/**
 * Attaques qui visent UN seul adversaire au choix : ce sont les seules où, en combat double,
 * viser l'ennemi 1 ou l'ennemi 2 sont deux décisions différentes.
 */
export const CIBLES_AU_CHOIX = new Set(["NEAR_OTHER", "OTHER", "NEAR_ENEMY"].map(cle => valeurDe(MoveTarget, cle)));

export const CIBLE = {
  ENNEMI_1: valeurDe(BattlerIndex, "ENEMY"),
  ENNEMI_2: valeurDe(BattlerIndex, "ENEMY_2"),
};

/** Options du menu d'un Pokémon dans l'écran d'équipe (Envoyer, Relâcher, Appliquer…). */
export const OPTION_EQUIPE = {
  ENVOYER: valeurDe(PartyOption, "SEND_OUT"),
  APPLIQUER: valeurDe(PartyOption, "APPLY"),
  ENSEIGNER: valeurDe(PartyOption, "TEACH"),
  RELACHER: valeurDe(PartyOption, "RELEASE"),
  CHOISIR: valeurDe(PartyOption, "SELECT"),
  ATTAQUE_1: valeurDe(PartyOption, "MOVE_1"),
};
