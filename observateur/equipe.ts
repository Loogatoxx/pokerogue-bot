/**
 * Note d'équipe : ce que valent les six Pokémon ENSEMBLE (idée de Carlos : « évaluer le tout en
 * même temps, pas faire de doublons »), sur le même principe que la note des attaques
 * (observateur/synergie.ts).
 *
 * Elle sert quand l'équipe est pleine et qu'une capture réussit : garder l'équipe telle quelle,
 * ou remplacer l'un des six par le nouveau. Elle tient compte de :
 *   - la couverture offensive : contre chacun des 18 types, la meilleure attaque de l'équipe,
 *     pondérée par les vraies statistiques (donc le niveau) de celui qui la lance ;
 *   - la profondeur : la force moyenne de CHAQUE membre (les membres tombent l'un après l'autre,
 *     chacun doit pouvoir tenir) ; sans elle, un niveau 5 pourrait remplacer un niveau 50 qui
 *     « doublonne » un autre membre ;
 *   - la défense : avoir, pour chaque type d'attaque, au moins un membre qui y résiste ;
 *   - les faiblesses empilées : trois membres ou plus qui craignent le même type ;
 *   - les doublons : deux membres qui partagent un type (et pire, la même espèce) ;
 *   - la solidité : PV, Défense et Défense Spé. moyennes (valeurs réelles, donc selon le niveau) ;
 *   - le potentiel (idée de Carlos) : le total de statistiques de la forme finale de chaque espèce
 *     (observateur/especes.ts). Un Embrylex niveau 10 a l'air faible ; un joueur sait qu'il
 *     deviendra Tyranocif, et qu'il vaut mieux qu'un Rattata.
 * Une formule lisible, en attendant que le cerveau décide lui-même (étape 5, team build).
 */
import { connaissance } from "./especes";
import { EFFICACITE_TYPES, PokemonType } from "./noms";
import { type AttaqueNotee, meilleurParType } from "./synergie";

export interface Membre {
  nom: string;
  espece: number;
  niveau: number;
  types: number[];
  /** PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse (valeurs réelles). */
  stats: number[];
  attaques: AttaqueNotee[];
}

export interface OptionEquipe {
  /** Place du membre remplacé par le nouveau (0 à 5), ou null pour ne pas garder le nouveau. */
  remplacer: number | null;
  nom: string;
  note: number;
  pour: string[];
  contre: string[];
}

const NB_TYPES = 18;
const POIDS = { couverture: 0.5, profondeur: 3, defense: 25, solidite: 5, faiblesses: 6, typesPartages: 5, memeEspece: 25, potentiel: 12 };

/** Potentiel d'un membre : total de statistiques de sa forme finale, en centaines (6 pour 600). */
const potentielDe = (m: Membre) => (connaissance(m.espece)?.totalFinal ?? 0) / 100;

const moyenne = (valeurs: number[]) => valeurs.reduce((a, b) => a + b, 0) / Math.max(valeurs.length, 1);
const nomType = (t: number) => PokemonType[t]?.fr ?? `type ${t}`;
const types = () => Array.from({ length: NB_TYPES }, (_, t) => t);

/** Multiplicateur d'une attaque de ce type contre ce Pokémon (double type : on multiplie). */
function subit(typeAttaque: number, membre: Membre): number {
  return membre.types.reduce((m, t) => m * (EFFICACITE_TYPES[typeAttaque]?.[t] ?? 1), 1);
}

/** Puissance d'un membre contre chaque type, à l'échelle de ses vraies statistiques d'attaque. */
function offensive(membre: Membre): number[] {
  const force = Math.max(membre.stats[1] ?? 0, membre.stats[3] ?? 0) / 100;
  return meilleurParType(membre.attaques, { types: membre.types, stats: membre.stats }).map(p => p * force);
}

interface Detail {
  offensive: number;
  profondeur: number;
  defense: number;
  solidite: number;
  faiblesses: number;
  typesPartages: number;
  memeEspece: number;
  potentiel: number;
  /** Par type d'attaque : quelqu'un y résiste-t-il ? */
  resiste: boolean[];
  /** Par type d'adversaire : puissance de la meilleure attaque de l'équipe. */
  couverture: number[];
}

function detailler(equipe: Membre[]): Detail {
  const parMembre = equipe.map(offensive);
  const couverture = types().map(t => Math.max(0, ...parMembre.map(m => m[t] ?? 0)));
  const resiste = types().map(a => equipe.some(m => subit(a, m) <= 0.5));
  const neutre = types().map(a => equipe.some(m => subit(a, m) <= 1));
  const faiblesses = types().reduce((n, a) => n + Math.max(0, equipe.filter(m => subit(a, m) >= 2).length - 2), 0);
  let typesPartages = 0;
  let memeEspece = 0;
  equipe.forEach((a, i) =>
    equipe.slice(i + 1).forEach(b => {
      typesPartages += a.types.filter(t => b.types.includes(t)).length;
      memeEspece += a.espece === b.espece ? 1 : 0;
    }),
  );
  return {
    offensive: moyenne(couverture),
    profondeur: moyenne(parMembre.map(moyenne)),
    defense: moyenne(types().map(a => (resiste[a] ? 1 : neutre[a] ? 0.5 : 0))),
    solidite: moyenne(equipe.map(m => ((m.stats[0] ?? 0) + (m.stats[2] ?? 0) + (m.stats[4] ?? 0)) / 100)),
    faiblesses,
    typesPartages,
    memeEspece,
    potentiel: moyenne(equipe.map(potentielDe)),
    resiste,
    couverture,
  };
}

export function noterEquipe(equipe: Membre[]): number {
  const d = detailler(equipe);
  return (
    POIDS.couverture * d.offensive
    + POIDS.profondeur * d.profondeur
    + POIDS.defense * d.defense
    + POIDS.solidite * d.solidite
    + POIDS.potentiel * d.potentiel
    - POIDS.faiblesses * d.faiblesses
    - POIDS.typesPartages * d.typesPartages
    - POIDS.memeEspece * d.memeEspece
  );
}

/** Le pour et le contre d'une équipe par rapport à l'équipe actuelle. */
function comparer(nouvelle: Membre[], actuelle: Membre[], arrivant: Membre, parti: Membre | null) {
  const pour: string[] = [];
  const contre: string[] = [];
  const avant = detailler(actuelle);
  const apres = detailler(nouvelle);

  const resistances = types().filter(a => apres.resiste[a] && !avant.resiste[a]).map(nomType);
  const perdues = types().filter(a => avant.resiste[a] && !apres.resiste[a]).map(nomType);
  if (resistances.length) {
    pour.push(`quelqu'un résiste enfin à : ${resistances.join(", ")}`);
  }
  if (perdues.length) {
    contre.push(`plus personne ne résiste à : ${perdues.join(", ")}`);
  }
  const ecart = apres.offensive - avant.offensive;
  if (Math.abs(ecart) >= 2) {
    (ecart > 0 ? pour : contre).push(`couverture offensive ${Math.round(avant.offensive)} → ${Math.round(apres.offensive)}`);
  }
  const profondeur = apres.profondeur - avant.profondeur;
  if (Math.abs(profondeur) >= 1) {
    (profondeur > 0 ? pour : contre).push(
      `force moyenne par membre ${Math.round(avant.profondeur)} → ${Math.round(apres.profondeur)}`,
    );
  }
  if (apres.typesPartages > avant.typesPartages) {
    contre.push(`plus de types en double dans l'équipe (${avant.typesPartages} → ${apres.typesPartages})`);
  } else if (apres.typesPartages < avant.typesPartages) {
    pour.push(`moins de types en double (${avant.typesPartages} → ${apres.typesPartages})`);
  }
  if (apres.memeEspece > avant.memeEspece) {
    contre.push(`deux fois la même espèce (${arrivant.nom})`);
  }
  if (apres.faiblesses > avant.faiblesses) {
    contre.push("plus de membres qui craignent le même type");
  } else if (apres.faiblesses < avant.faiblesses) {
    pour.push("moins de faiblesses partagées");
  }
  if (parti) {
    const gain = potentielDe(arrivant) - potentielDe(parti);
    if (Math.abs(gain) >= 0.5) {
      const final = (m: Membre) => `${m.nom} (forme finale : ${Math.round(potentielDe(m) * 100)})`;
      (gain > 0 ? pour : contre).push(`potentiel : ${final(arrivant)} contre ${final(parti)}`);
    }
    const plusFort = Math.max(...actuelle.map(m => m.niveau));
    if (parti.niveau === plusFort) {
      contre.push(`perd son membre le plus avancé (${parti.nom}, niv. ${parti.niveau})`);
    }
    if (arrivant.niveau < parti.niveau - 5) {
      contre.push(`${arrivant.nom} (niv. ${arrivant.niveau}) est bien moins avancé que ${parti.nom} (niv. ${parti.niveau})`);
    }
  }
  return { pour, contre };
}

/**
 * Options quand l'équipe est pleine et que `arrivant` vient d'être capturé : ne pas le garder,
 * ou remplacer l'un des membres. Chacune avec sa note, ses pour et ses contre.
 */
export function evaluerArrivee(equipe: Membre[], arrivant: Membre): OptionEquipe[] {
  const options: OptionEquipe[] = [
    { remplacer: null, nom: `Ne pas garder ${arrivant.nom}`, note: noterEquipe(equipe), pour: [], contre: [] },
  ];
  equipe.forEach((parti, place) => {
    const nouvelle = equipe.map((m, i) => (i === place ? arrivant : m));
    options.push({
      remplacer: place,
      nom: `Remplacer ${parti.nom} par ${arrivant.nom}`,
      note: noterEquipe(nouvelle),
      ...comparer(nouvelle, equipe, arrivant, parti),
    });
  });
  return options.map(o => ({ ...o, note: Math.round(o.note * 10) / 10 }));
}

/** L'option la mieux notée (en cas d'égalité, on garde l'équipe telle quelle). */
export function meilleureOptionEquipe(options: OptionEquipe[]): OptionEquipe {
  return options.reduce((meilleure, o) => (o.note > meilleure.note ? o : meilleure), options[0]!);
}
