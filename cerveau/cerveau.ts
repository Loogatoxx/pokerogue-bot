/**
 * Lecture d'un fichier .cerveau et calcul de ses décisions, en TypeScript pur.
 *
 * Pourquoi pas un moteur standard (ONNX Runtime) : il pèse ~10 Mo et exige du WebAssembly,
 * que les extensions encadrent strictement. Notre réseau est petit (quelques couches), un calcul
 * écrit à la main suffit, et il laisse voir l'intérieur du réseau pour analyser ses décisions.
 * Le fichier est écrit par entraineur/format_cerveau.py ; un test vérifie que ce calcul donne
 * les mêmes résultats que PyTorch.
 *
 * Format .cerveau (version 1) :
 *   « CRVO » (4 octets) · longueur de l'en-tête (uint32) · en-tête JSON (UTF-8)
 *   · bourrage jusqu'à un multiple de 4 · poids en float32 (petit-boutiste)
 */

export const SIGNATURE = "CRVO";

export interface Couche {
  entree: number;
  sortie: number;
  activation: "relu" | "aucune";
  /** Position (en nombre de float32) des poids, rangés ligne par ligne (sortie × entree). */
  poids: number;
  /** Position des biais (sortie valeurs). */
  biais: number;
}

export interface EnteteCerveau {
  format: "cerveau-pokerogue";
  versionFormat: 1;
  nom: string;
  description: string;
  creeLe: string;
  versionObservation: number;
  versionEncodage: number;
  tailleEntree: number;
  nombreActions: number;
  entrainement: { parties: number; decisions: number };
  /** Résultats mesurés dans le simulateur au moment de l'export (facultatif). */
  evaluation?: { parties: number; vagueMoyenne: number; vagueMax: number };
  tronc: Couche[];
  politique: Couche[];
  valeur: Couche[];
}

export interface Cerveau {
  entete: EnteteCerveau;
  poids: Float32Array;
}

export interface Reponse {
  /** Probabilité de chaque action (0 pour les actions interdites). */
  probabilites: number[];
  /** Estimation par le cerveau de la valeur de la situation (plus haut = plus favorable). */
  valeur: number;
}

export function lireCerveau(fichier: ArrayBuffer): Cerveau {
  const vue = new DataView(fichier);
  const signature = String.fromCharCode(...new Uint8Array(fichier, 0, 4));
  if (signature !== SIGNATURE) {
    throw new Error("Ce fichier n'est pas un cerveau PokeRogue (.cerveau).");
  }
  const longueur = vue.getUint32(4, true);
  const entete = JSON.parse(new TextDecoder().decode(new Uint8Array(fichier, 8, longueur))) as EnteteCerveau;
  if (entete.format !== "cerveau-pokerogue" || entete.versionFormat !== 1) {
    throw new Error(`Format de cerveau inconnu (${entete.format} v${entete.versionFormat}).`);
  }
  const debut = Math.ceil((8 + longueur) / 4) * 4;
  // On copie les poids dans un tableau à part : Float32Array exige un départ aligné sur 4 octets.
  const poids = new Float32Array(fichier.slice(debut));
  return { entete, poids };
}

function appliquer(couches: Couche[], poids: Float32Array, entree: Float32Array): Float32Array {
  let x = entree;
  for (const c of couches) {
    const y = new Float32Array(c.sortie);
    for (let o = 0; o < c.sortie; o++) {
      let somme = poids[c.biais + o]!;
      const ligne = c.poids + o * c.entree;
      for (let i = 0; i < c.entree; i++) {
        somme += poids[ligne + i]! * x[i]!;
      }
      y[o] = c.activation === "relu" ? Math.max(0, somme) : somme;
    }
    x = y;
  }
  return x;
}

/**
 * Fait réfléchir le cerveau : observation encodée + actions permises → probabilités et valeur.
 * Les actions interdites reçoivent une probabilité nulle (« masquage »).
 */
export function penser(cerveau: Cerveau, entree: Float32Array, masque: boolean[]): Reponse {
  const { entete, poids } = cerveau;
  if (entree.length !== entete.tailleEntree) {
    throw new Error(`Ce cerveau attend ${entete.tailleEntree} nombres, l'observation en donne ${entree.length}.`);
  }
  const commun = appliquer(entete.tronc, poids, entree);
  const scores = appliquer(entete.politique, poids, commun);
  const valeur = appliquer(entete.valeur, poids, commun)[0]!;

  // « Softmax » masqué : transforme les scores en probabilités qui somment à 1.
  let max = -Infinity;
  scores.forEach((s, i) => {
    if (masque[i] && s > max) {
      max = s;
    }
  });
  const exp = Array.from(scores, (s, i) => (masque[i] ? Math.exp(s - max) : 0));
  const total = exp.reduce((a, b) => a + b, 0) || 1;
  return { probabilites: exp.map(e => e / total), valeur };
}

/** L'action la plus probable parmi les permises. */
export function meilleureAction(reponse: Reponse): number {
  let meilleure = 0;
  reponse.probabilites.forEach((p, i) => {
    if (p > reponse.probabilites[meilleure]!) {
      meilleure = i;
    }
  });
  return meilleure;
}
