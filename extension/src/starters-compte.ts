/**
 * À l'écran de choix des starters : les starters du compte, lus dans le jeu, pour le constructeur
 * d'équipe (observateur/constructeur-equipe.ts). Côté capteur (monde de la page).
 *
 * Ce qu'on lit — ce que le joueur voit lui-même sur cet écran : l'espèce (types, statistiques de
 * base), son coût réel, ses IV, ses natures débloquées, son passif et son talent caché débloqués,
 * ses attaques d'œuf débloquées, et ses variantes chromatiques (la chance).
 */
import type { CandidatStarter } from "../../observateur/constructeur-equipe";

interface EspeceJeu {
  speciesId: number;
  name: string;
  type1: number;
  type2: number | null;
  baseStats: number[];
}

interface DonneesJeu {
  dexData: Record<number, { caughtAttr: bigint; natureAttr: number; ivs: number[] } | undefined>;
  starterData: Record<number, { abilityAttr: number; passiveAttr: number; eggMoves: number } | undefined>;
  getSpeciesStarterValue(espece: number): number;
  getNaturesForAttr(natureAttr: number): number[];
}

/** Natures du jeu qui augmentent l'Attaque (Solo, Brave, Rigide, Mauvais) ou l'Attaque Spé. (Modeste, Doux, Discret, Foufou). */
const NATURES_ATTAQUE = [1, 2, 3, 4];
const NATURES_ATTAQUE_SPE = [15, 16, 17, 19];
const CHROMATIQUE = 2n;
const VARIANTE_2 = 32n;
const VARIANTE_3 = 64n;
const PASSIF_DEBLOQUE = 1;
const TALENT_CACHE = 4;

const compter = (n: number) => n.toString(2).split("").filter(b => b === "1").length;

/** Les starters attrapés du compte, ou null si l'écran n'est pas celui du choix des starters. */
export function lireStartersDuCompte(scene: unknown): CandidatStarter[] | null {
  const s = scene as { ui?: { getHandler(): unknown }; gameData?: DonneesJeu };
  const ecran = s.ui?.getHandler() as { starterContainers?: { species: EspeceJeu }[] } | undefined;
  const donnees = s.gameData;
  if (!ecran?.starterContainers?.length || !donnees) {
    return null;
  }
  const candidats: CandidatStarter[] = [];
  for (const { species } of ecran.starterContainers) {
    const dex = donnees.dexData[species.speciesId];
    const starter = donnees.starterData[species.speciesId];
    if (!dex || !starter || !dex.caughtAttr) {
      continue;
    }
    const base = species.baseStats;
    const physique = (base[1] ?? 0) >= (base[3] ?? 0);
    const natures = donnees.getNaturesForAttr(dex.natureAttr);
    const chance = !(dex.caughtAttr & CHROMATIQUE) ? 0 : dex.caughtAttr & VARIANTE_3 ? 3 : dex.caughtAttr & VARIANTE_2 ? 2 : 1;
    candidats.push({
      espece: species.speciesId,
      nom: species.name,
      cout: donnees.getSpeciesStarterValue(species.speciesId),
      types: species.type2 === null || species.type2 === undefined ? [species.type1] : [species.type1, species.type2],
      statsDeBase: base,
      ivs: dex.ivs,
      bonneNature: natures.some(n => (physique ? NATURES_ATTAQUE : NATURES_ATTAQUE_SPE).includes(n)),
      passif: (starter.passiveAttr & PASSIF_DEBLOQUE) !== 0,
      talentCache: (starter.abilityAttr & TALENT_CACHE) !== 0,
      attaquesOeuf: compter(starter.eggMoves & 15),
      chance,
    });
  }
  return candidats;
}
