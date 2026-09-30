/**
 * Accès par nom aux valeurs numériques du jeu (ex. le mode d'écran « COMMAND » vaut 2).
 * Les tables viennent de noms.ts, généré depuis le jeu et vérifié par les tests du simulateur.
 */
import { BattlerIndex, Button, Command, MoveTarget, MoveUseMode, type Nom, UiMode } from "./noms";

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
  MODIFIER_SELECT: valeurDe(UiMode, "MODIFIER_SELECT"),
  OPTION_SELECT: valeurDe(UiMode, "OPTION_SELECT"),
  PARTY: valeurDe(UiMode, "PARTY"),
  SUMMARY: valeurDe(UiMode, "SUMMARY"),
  TARGET_SELECT: valeurDe(UiMode, "TARGET_SELECT"),
};

export const BOUTON = {
  ACTION: valeurDe(Button, "ACTION"),
  CANCEL: valeurDe(Button, "CANCEL"),
};

export const COMMANDE = {
  FIGHT: valeurDe(Command, "FIGHT"),
  POKEMON: valeurDe(Command, "POKEMON"),
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
