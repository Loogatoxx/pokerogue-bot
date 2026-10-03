/**
 * Le constructeur d'équipe de départ : parmi les starters du compte, le trio qui a le plus de chances.
 *
 * Demande de Carlos (03/10) : « que l'IA construise elle-même l'équipe de starters, avec une plus
 * grosse base, et conseille celle qui a le plus de chances de gagner, en se basant sur les attaques,
 * les IV, le passif, le talent, la nature, les statistiques de base et les tableaux de types ».
 *
 * La note d'un starter :
 *   - sa **force mesurée** : la vague moyenne qu'il atteint comme porteur dans le simulateur
 *     (entraineur/liste_puissance.py, IV 15 et nature neutre ; à défaut, son total de statistiques
 *     de forme finale) — c'est l'essentiel ;
 *   - ses **IV** (au-dessus de 15, surtout sur sa meilleure stat d'attaque, la Vitesse et les PV) ;
 *   - une **nature** débloquée qui augmente sa meilleure stat d'attaque (+10 %) ;
 *   - son **passif** et son **talent caché** débloqués, ses **attaques d'œuf** débloquées ;
 *   - la **chance** (chromatiques : objets de meilleure qualité).
 * Le trio : le porteur compte le plus (il fait l'essentiel du travail), puis le 2e, puis le 3e ; et un
 * bonus quand les types de l'équipe battent chacun des trois types de starter du rival (Plante, Feu,
 * Eau) : mesuré au rival 1, 97 % → 99 % (étape 13). Budget : 10 points de coût, comme le jeu.
 */
import { PUISSANCE_STARTERS } from "./puissance-starters";
import { connaissance } from "./especes";
import { efficacite } from "./prevision";

export interface CandidatStarter {
  espece: number;
  nom: string;
  /** Coût réel (réductions comprises). */
  cout: number;
  types: number[];
  /** Statistiques de base : PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse. */
  statsDeBase: number[];
  /** IV de 0 à 31, dans le même ordre (compte neuf : 15 partout). */
  ivs: number[];
  /** Une nature débloquée augmente-t-elle sa meilleure stat d'attaque ? */
  bonneNature: boolean;
  passif: boolean;
  talentCache: boolean;
  /** Attaques d'œuf débloquées (0 à 4). */
  attaquesOeuf: number;
  /** Chance apportée (0 à 3 : chromatique et variantes). */
  chance: number;
}

export interface EquipeConseillee {
  membres: CandidatStarter[];
  cout: number;
  note: number;
  pourquoi: string[];
}

const BUDGET = 10;
const STARTERS_DU_RIVAL = [11, 9, 10]; // Plante, Feu, Eau

/** Force de l'espèce comme porteur, en « vagues » (mesurée ; sinon estimée par le Pokédex). */
export function forceEspece(espece: number): number {
  const mesuree = PUISSANCE_STARTERS[espece];
  if (mesuree !== undefined) {
    return mesuree;
  }
  const total = connaissance(espece)?.totalFinal ?? 400;
  return 20 + (total - 400) / 5; // repli grossier : 400 → 20 vagues, 600 → 60
}

/** La note d'un starter (en « vagues » environ). */
export function noterStarter(c: CandidatStarter): { note: number; pourquoi: string[] } {
  const pourquoi: string[] = [];
  let note = forceEspece(c.espece);
  pourquoi.push(`${c.nom} : force ${note.toFixed(1)}${PUISSANCE_STARTERS[c.espece] === undefined ? " (estimée)" : ""}`);
  const physique = (c.statsDeBase[1] ?? 0) >= (c.statsDeBase[3] ?? 0);
  const attaque = physique ? 1 : 3;
  const ivUtiles = [(c.ivs[attaque] ?? 15), (c.ivs[5] ?? 15), (c.ivs[0] ?? 15)];
  const bonusIv = ivUtiles.reduce((t, iv) => t + (iv - 15), 0) / 16 * 2; // 31 partout : +6
  if (Math.abs(bonusIv) >= 0.5) {
    note += bonusIv;
    pourquoi.push(`IV ${bonusIv > 0 ? "+" : ""}${bonusIv.toFixed(1)}`);
  }
  if (c.bonneNature) {
    note += 1.5;
    pourquoi.push(`nature +${physique ? "Attaque" : "Attaque Spé."}`);
  }
  if (c.passif) {
    note += 2;
    pourquoi.push("passif");
  }
  if (c.talentCache) {
    note += 0.5;
  }
  if (c.attaquesOeuf > 0) {
    note += 0.5 * c.attaquesOeuf;
  }
  if (c.chance > 0) {
    note += 0.5 * c.chance;
    pourquoi.push(`chance +${c.chance}`);
  }
  return { note, pourquoi };
}

/** Les types de starter du rival que l'équipe bat avec son propre type. */
function couverture(membres: CandidatStarter[]): number {
  return STARTERS_DU_RIVAL.filter(t => membres.some(m => m.types.some(x => efficacite(x, [t]) > 1))).length;
}

/**
 * Les meilleures équipes de 1 à 3 starters dans le budget. `candidats` : les starters du compte.
 * Le porteur (le mieux noté) est mis en premier : il commence les combats et prend l'expérience.
 */
export function conseillerEquipes(candidats: CandidatStarter[], nombre = 3): EquipeConseillee[] {
  const notes = new Map(candidats.map(c => [c.espece, noterStarter(c)]));
  const tries = [...candidats].filter(c => c.cout <= BUDGET).sort((a, b) => notes.get(b.espece)!.note - notes.get(a.espece)!.note);
  // On se limite aux 40 meilleurs : assez pour couvrir les trios utiles, assez peu pour tout essayer.
  const pool = tries.slice(0, 40);
  const equipes: EquipeConseillee[] = [];
  const essayer = (membres: CandidatStarter[]) => {
    const cout = membres.reduce((t, m) => t + m.cout, 0);
    if (cout > BUDGET) {
      return;
    }
    const tri = [...membres].sort((a, b) => notes.get(b.espece)!.note - notes.get(a.espece)!.note);
    const poids = [1, 0.35, 0.2];
    const base = tri.reduce((t, m, i) => t + (poids[i] ?? 0) * notes.get(m.espece)!.note, 0);
    const couverts = couverture(tri);
    const note = base + 2 * couverts; // chaque type de starter du rival couvert : environ +1 point de rival 1
    const pourquoi = [...notes.get(tri[0]!.espece)!.pourquoi, `couvre ${couverts}/3 types de starter du rival`];
    equipes.push({ membres: tri, cout, note, pourquoi });
  };
  for (let i = 0; i < pool.length; i++) {
    essayer([pool[i]!]);
    for (let j = i + 1; j < pool.length; j++) {
      essayer([pool[i]!, pool[j]!]);
      for (let k = j + 1; k < pool.length; k++) {
        essayer([pool[i]!, pool[j]!, pool[k]!]);
      }
    }
  }
  return equipes.sort((a, b) => b.note - a.note).slice(0, nombre);
}
