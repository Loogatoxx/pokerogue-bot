/**
 * La connaissance « Pokédex » (idée de Carlos) : ce qu'une espèce PEUT avoir, comme un joueur qui
 * connaît ses Pokémon, ou un wiki. Jamais ce que l'adversaire a réellement : ses vraies attaques
 * restent inconnues tant qu'il ne les utilise pas, son vrai talent tant que le jeu ne l'affiche pas.
 *
 * Sert à trois choses :
 *   - savoir de quoi se méfier : les attaques qu'un adversaire de cette espèce peut connaître à son
 *     niveau (par type et par puissance), et les types qu'un de ses talents possibles annule
 *     (Lévitation contre Sol…) ;
 *   - reconnaître un bon Pokémon à capturer : le total de statistiques de sa forme finale
 *     (un Embrylex niveau 5 a l'air faible, il deviendra Tyranocif) ;
 *   - l'afficher dans le panneau de l'extension.
 * Données générées depuis le jeu : observateur/donnees-especes.ts (generer-especes.py).
 */
import { ATTAQUES, ESPECES, TALENTS } from "./donnees-especes";
import { EFFICACITE_TYPES } from "./noms";

/** Types de 0 (Normal) à 18 (Stellaire), comme les one-hot de l'encodeur. */
export const NB_TYPES_CONNUS = 19;
const CATEGORIE_STATUT = 2;

export interface AttaquePossible {
  id: number;
  nom: string;
  type: number;
  categorie: number;
  puissance: number;
  /** Niveau auquel l'espèce l'apprend (0 = à l'évolution, 1 = dès le départ). */
  niveau: number;
}

export interface Connaissance {
  nom: string;
  types: readonly number[];
  total: number;
  /** Total de statistiques de sa forme la plus évoluée : son potentiel. */
  totalFinal: number;
  /** Talents possibles : [1, 2, caché] (identifiants du jeu, 0 = aucun). */
  talents: readonly number[];
  /** Taux de capture de l'espèce (3 = légendaire … 255 = très facile). */
  tauxCapture: number;
}

export function connaissance(espece: number): Connaissance | null {
  const e = ESPECES[espece];
  return e ? { nom: e[0], types: e[1], total: e[2], totalFinal: e[3], talents: e[4], tauxCapture: e[6] } : null;
}

/** Les attaques offensives que cette espèce peut connaître à ce niveau (apprises en montant). */
export function attaquesPossibles(espece: number, niveau: number): AttaquePossible[] {
  const e = ESPECES[espece];
  if (!e) {
    return [];
  }
  const liste: AttaquePossible[] = [];
  const vues = new Set<number>();
  for (let i = 0; i < e[5].length; i += 2) {
    const appris = e[5][i]!;
    const id = e[5][i + 1]!;
    const a = ATTAQUES[id];
    if (appris > niveau || !a || a[2] === CATEGORIE_STATUT || a[3] <= 0 || vues.has(id)) {
      continue;
    }
    vues.add(id);
    liste.push({ id, nom: a[0], type: a[1], categorie: a[2], puissance: a[3], niveau: appris });
  }
  return liste;
}

/** Pour chaque type, la puissance de la meilleure attaque de ce type qu'il peut connaître (0 sinon). */
export function puissanceParType(espece: number, niveau: number): number[] {
  const parType = new Array<number>(NB_TYPES_CONNUS).fill(0);
  for (const a of attaquesPossibles(espece, niveau)) {
    if (a.type >= 0 && a.type < NB_TYPES_CONNUS) {
      parType[a.type] = Math.max(parType[a.type]!, a.puissance);
    }
  }
  return parType;
}

/**
 * La pire attaque qu'il pourrait lancer sur ce Pokémon : puissance × bonus de même type (×1,5) ×
 * efficacité contre ses types. C'est « ce dont il faut se méfier ».
 */
export function pireMenace(espece: number, niveau: number, typesCible: readonly number[]): { attaque: AttaquePossible; force: number } | null {
  const typesAttaquant = ESPECES[espece]?.[1] ?? [];
  let pire: { attaque: AttaquePossible; force: number } | null = null;
  for (const a of attaquesPossibles(espece, niveau)) {
    const efficacite = typesCible.reduce((m, t) => m * (EFFICACITE_TYPES[a.type]?.[t] ?? 1), 1);
    const force = a.puissance * (typesAttaquant.includes(a.type) ? 1.5 : 1) * efficacite;
    if (!pire || force > pire.force) {
      pire = { attaque: a, force };
    }
  }
  return pire;
}

/**
 * Les types qu'un de ses talents possibles annule (Lévitation → Sol, Torche → Feu…). Si le jeu a
 * déjà montré son talent, seul celui-là compte.
 */
export function immunitesPossibles(espece: number, talentConnu: number | null): number[] {
  const talents = talentConnu !== null ? [talentConnu] : (ESPECES[espece]?.[4] ?? []);
  const types = new Set<number>();
  for (const t of talents) {
    for (const type of TALENTS[t]?.[1] ?? []) {
      types.add(type);
    }
  }
  return [...types];
}

export function nomTalent(talent: number): string {
  return TALENTS[talent]?.[0] ?? `talent ${talent}`;
}
