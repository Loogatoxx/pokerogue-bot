/**
 * Note de synergie d'un jeu d'attaques : ce que valent les quatre attaques ENSEMBLE, pas une
 * par une (idée de Carlos : « faire le pour et le contre et garder ce qui donne un avantage »).
 *
 * Pour un Pokémon donné, la note est la puissance moyenne qu'il peut espérer contre un
 * adversaire de n'importe quel type, en prenant à chaque fois sa meilleure attaque. Elle tient
 * compte de :
 *   - la couverture : contre chacun des 18 types, la meilleure attaque (×2, ×½, immunités) ;
 *   - le STAB : ×1,5 quand l'attaque est du type du Pokémon ;
 *   - l'adéquation : une attaque physique vaut selon l'Attaque, spéciale selon l'Attaque Spé. ;
 *   - la précision ;
 *   - une attaque de statut (Rugissement, Danse-Lames…) : une valeur fixe modeste, la première
 *     (limite actuelle : toutes se valent, Trempette autant que Danse-Lames) ;
 *   - l'équipe : un bonus pour couvrir les types que les coéquipiers touchent mal ;
 *   - la variété : un bonus par type d'attaque différent, car deux attaques du même type ne
 *     servent à rien face à une immunité (talent Absorb-Eau, Lévitation…).
 * Ce n'est pas encore le cerveau qui juge : c'est une formule lisible. Plus tard, le cerveau
 * pourra décider lui-même, en recevant cette note comme un avis parmi d'autres.
 */
import { facteurAttaque } from "./contraintes-attaques";
import { typesAPreparer } from "./combats";
import type { MoveJeu, PokemonJeu, ScenePokerogue } from "./jeu";
import { EFFICACITE_TYPES, MoveCategory, PokemonType } from "./noms";
import { ECRAN } from "./valeurs";

export interface AttaqueNotee {
  /** Identifiant du jeu, s'il est connu (attaques trompeuses : contraintes-attaques.ts). */
  id?: number;
  nom: string;
  type: number;
  categorie: number;
  puissance: number;
  /** En pourcentage ; -1 = touche toujours. */
  precision: number;
}

/** Le Pokémon qui porte les attaques. stats : PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse. */
export interface Porteur {
  types: number[];
  stats: number[];
}

export interface OptionApprentissage {
  /** Place de l'attaque oubliée (0 à 3), ou null pour refuser la nouvelle attaque. */
  oublier: number | null;
  nom: string;
  note: number;
  pour: string[];
  contre: string[];
}

const NB_TYPES = 18;
const PHYSIQUE = Number(Object.entries(MoveCategory).find(([, n]) => n.cle === "PHYSICAL")![0]);
const STATUT = Number(Object.entries(MoveCategory).find(([, n]) => n.cle === "STATUS")![0]);
/** Valeur d'une première attaque de statut, en « puissance » (une seconde vaut beaucoup moins). */
const VALEUR_STATUT = [15, 5];
/** Poids du bonus « couvre ce que l'équipe couvre mal ». */
const POIDS_EQUIPE = 0.25;
/** Bonus par type d'attaque offensive différent. */
const BONUS_VARIETE = 3;
/** Poids de la préparation au rival : la puissance contre les types qu'il alignera. */
const POIDS_PREPARATION = 0.5;

const moyenne = (valeurs: number[]) => valeurs.reduce((a, b) => a + b, 0) / Math.max(valeurs.length, 1);
const nomType = (t: number) => PokemonType[t]?.fr ?? `type ${t}`;
const estStatut = (a: AttaqueNotee) => a.categorie === STATUT || a.puissance <= 0;

/** Puissance réellement utile d'une attaque pour ce Pokémon (avant les types de l'adversaire). */
function puissanceUtile(a: AttaqueNotee, porteur: Porteur): number {
  if (estStatut(a)) {
    return 0;
  }
  const precision = a.precision < 0 ? 1 : a.precision / 100;
  const stab = porteur.types.includes(a.type) ? 1.5 : 1;
  const attaque = porteur.stats[1] ?? 1;
  const attaqueSpe = porteur.stats[3] ?? 1;
  const adequation = (a.categorie === PHYSIQUE ? attaque : attaqueSpe) / Math.max(attaque, attaqueSpe, 1);
  // Explosion, Ultralaser, Lance-Soleil… : la puissance affichée trompe (remarque de Carlos, 04/10 :
  // des CT faisaient oublier des attaques plus utiles).
  return a.puissance * precision * stab * adequation * facteurAttaque(a.id);
}

const efficacite = (typeAttaque: number, typeDefense: number) => EFFICACITE_TYPES[typeAttaque]?.[typeDefense] ?? 1;

/** Contre chacun des 18 types, la puissance de la meilleure attaque du jeu. */
export function meilleurParType(jeu: AttaqueNotee[], porteur: Porteur): number[] {
  return Array.from({ length: NB_TYPES }, (_, defense) =>
    Math.max(0, ...jeu.map(a => puissanceUtile(a, porteur) * efficacite(a.type, defense))),
  );
}

/**
 * Note d'un jeu d'attaques. `coequipiers` : pour chaque type, la meilleure puissance du reste de
 * l'équipe (voir couvertureEquipe) ; sans elle, on ne note que le Pokémon seul.
 */
export function noterJeu(jeu: AttaqueNotee[], porteur: Porteur, coequipiers?: number[], cibles?: number[]): number {
  const meilleurs = meilleurParType(jeu, porteur);
  const statuts = jeu.filter(estStatut).length;
  const bonusStatut = VALEUR_STATUT.slice(0, statuts).reduce((a, b) => a + b, 0);
  const bonusEquipe = coequipiers
    ? POIDS_EQUIPE * moyenne(meilleurs.map((m, t) => Math.max(0, m - (coequipiers[t] ?? 0))))
    : 0;
  const bonusVariete = BONUS_VARIETE * typesOffensifs(jeu).size;
  // Préparation au rival (combats.ts, typesAPreparer) : frapper fort les types qu'il alignera.
  const bonusPreparation = cibles?.length ? POIDS_PREPARATION * moyenne(cibles.map(t => meilleurs[t] ?? 0)) : 0;
  return moyenne(meilleurs) + bonusStatut + bonusEquipe + bonusVariete + bonusPreparation;
}

/** Pour chaque type, la meilleure puissance parmi plusieurs Pokémon (le reste de l'équipe). */
export function couvertureEquipe(membres: { jeu: AttaqueNotee[]; porteur: Porteur }[]): number[] {
  const parMembre = membres.map(m => meilleurParType(m.jeu, m.porteur));
  return Array.from({ length: NB_TYPES }, (_, t) => Math.max(0, ...parMembre.map(m => m[t] ?? 0)));
}

/** Les types des attaques offensives du jeu (sans doublon). */
function typesOffensifs(jeu: AttaqueNotee[]): Set<number> {
  return new Set(jeu.filter(a => !estStatut(a)).map(a => a.type));
}

/** Les types touchés super efficacement (×2 ou plus) par au moins une attaque offensive. */
function typesSuperEfficaces(jeu: AttaqueNotee[]): Set<number> {
  const offensives = jeu.filter(a => !estStatut(a));
  return new Set(
    Array.from({ length: NB_TYPES }, (_, t) => t).filter(t => offensives.some(a => efficacite(a.type, t) >= 2)),
  );
}

/** Les « pour » et les « contre » d'un jeu d'attaques par rapport au jeu actuel. */
function comparer(nouveau: AttaqueNotee[], actuel: AttaqueNotee[], porteur: Porteur): { pour: string[]; contre: string[] } {
  const pour: string[] = [];
  const contre: string[] = [];
  const avant = typesSuperEfficaces(actuel);
  const apres = typesSuperEfficaces(nouveau);
  const gagnes = [...apres].filter(t => !avant.has(t)).map(nomType);
  const perdus = [...avant].filter(t => !apres.has(t)).map(nomType);
  if (gagnes.length) {
    pour.push(`touche super efficacement : ${gagnes.join(", ")}`);
  }
  if (perdus.length) {
    contre.push(`ne touche plus super efficacement : ${perdus.join(", ")}`);
  }

  const stab = (jeu: AttaqueNotee[]) => jeu.filter(a => !estStatut(a) && porteur.types.includes(a.type)).length;
  if (stab(nouveau) > stab(actuel)) {
    pour.push("une attaque de plus de son propre type (bonus ×1,5)");
  } else if (stab(nouveau) < stab(actuel)) {
    contre.push("une attaque de moins de son propre type (bonus ×1,5)");
  }

  const puissance = (jeu: AttaqueNotee[]) => moyenne(meilleurParType(jeu, porteur));
  const ecart = puissance(nouveau) - puissance(actuel);
  if (Math.abs(ecart) >= 1) {
    (ecart > 0 ? pour : contre).push(
      `puissance moyenne ${Math.round(puissance(actuel))} → ${Math.round(puissance(nouveau))}`,
    );
  }

  const variete = typesOffensifs(nouveau).size - typesOffensifs(actuel).size;
  if (variete > 0) {
    pour.push("plus de variété de types (utile face aux immunités)");
  } else if (variete < 0) {
    contre.push("moins de variété de types (risqué face aux immunités)");
  }

  const statutsPerdus = actuel.filter(a => estStatut(a) && !nouveau.includes(a)).map(a => a.nom);
  const statutsGagnes = nouveau.filter(a => estStatut(a) && !actuel.includes(a)).map(a => a.nom);
  if (statutsPerdus.length) {
    contre.push(`perd une attaque de statut (${statutsPerdus.join(", ")})`);
  }
  if (statutsGagnes.length) {
    pour.push(`gagne une attaque de statut (${statutsGagnes.join(", ")})`);
  }
  return { pour, contre };
}

/**
 * Toutes les options quand un Pokémon qui connaît déjà 4 attaques veut en apprendre une :
 * refuser, ou oublier l'une des 4. Chacune avec sa note, ses pour et ses contre.
 */
export function evaluerApprentissage(
  porteur: Porteur,
  actuelles: AttaqueNotee[],
  nouvelle: AttaqueNotee,
  coequipiers?: number[],
  cibles?: number[],
): OptionApprentissage[] {
  const options: OptionApprentissage[] = [
    {
      oublier: null,
      nom: `Ne pas apprendre ${nouvelle.nom}`,
      note: noterJeu(actuelles, porteur, coequipiers, cibles),
      pour: [],
      contre: [],
    },
  ];
  actuelles.forEach((ancienne, place) => {
    const jeu = actuelles.map((a, i) => (i === place ? nouvelle : a));
    options.push({
      oublier: place,
      nom: `Oublier ${ancienne.nom}`,
      note: noterJeu(jeu, porteur, coequipiers, cibles),
      ...comparer(jeu, actuelles, porteur),
    });
  });
  return options.map(o => ({ ...o, note: Math.round(o.note * 10) / 10 }));
}

/** L'option la mieux notée (en cas d'égalité, on garde ses attaques). */
export function meilleureOption(options: OptionApprentissage[]): OptionApprentissage {
  return options.reduce((meilleure, o) => (o.note > meilleure.note ? o : meilleure), options[0]!);
}

// ─── Depuis le jeu ────────────────────────────────────────────────────────────────────────────

const versNotee = (m: MoveJeu): AttaqueNotee => ({
  id: m.id, nom: m.name, type: m.type, categorie: m.category, puissance: m.power, precision: m.accuracy,
});
const porteurDe = (p: PokemonJeu): Porteur => ({ types: p.getTypes(), stats: [0, 1, 2, 3, 4, 5].map(s => p.getStat(s)) });

/**
 * Si le jeu affiche l'écran « quelle attaque oublier ? », les options notées ; sinon null.
 * (L'écran de résumé du jeu garde le Pokémon et la nouvelle attaque dans ses propriétés.)
 */
export function optionsApprentissageAffichees(scene: ScenePokerogue, starterRival?: number): OptionApprentissage[] | null {
  if (scene.ui.getMode() !== ECRAN.SUMMARY) {
    return null;
  }
  const resume = scene.ui.getHandler() as { pokemon?: PokemonJeu; newMove?: MoveJeu | null } | null;
  if (!resume?.pokemon || !resume.newMove) {
    return null;
  }
  const pokemon = resume.pokemon;
  const autres = scene
    .getPlayerParty()
    .filter(p => p.id !== pokemon.id)
    .map(p => ({ jeu: p.getMoveset().map(a => versNotee(a.getMove())), porteur: porteurDe(p) }));
  return evaluerApprentissage(
    porteurDe(pokemon),
    pokemon.getMoveset().map(a => versNotee(a.getMove())),
    versNotee(resume.newMove),
    couvertureEquipe(autres),
    typesAPreparer(scene.currentBattle?.waveIndex ?? 0, starterRival),
  );
}
