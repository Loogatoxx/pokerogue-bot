/**
 * Les combats qu'un joueur voit venir en mode Classique. C'est une connaissance publique du jeu
 * (wiki, communauté, et l'expérience d'une seule partie) : un humain la connaît, le cerveau aussi.
 *   - les combats fixes : Gamin (vague 5), rival (8, 25, 55, 95, 145, 195), Team (35, 62…),
 *     Conseil 4 (182 à 188), Maître (190) ;
 *   - toutes les 10 vagues, un boss : champion d'arène, ou Pokémon sauvage boss.
 * L'analyse des défaites (entraineur/analyse_defaites.py) a montré que 55 % d'entre elles ont lieu
 * contre le rival, souvent avec une équipe entrée blessée : d'où l'intérêt de les voir venir.
 */
import IMPORTANCE from "../donnees/importance-combats.json";
import { ClassicFixedBossWaves } from "./noms";

export type GenreCombat = "rival" | "dresseur" | "boss";

export interface CombatImportant {
  vague: number;
  /** Vagues d'ici là : 0 = c'est la vague indiquée elle-même. */
  dans: number;
  genre: GenreCombat;
  nom: string;
  rang: number;
}

const RANGS: Readonly<Record<string, number>> = IMPORTANCE.rangs;
const VAGUE_FINALE = 200;

const rangDe = (cle: string) => RANGS[Object.keys(RANGS).find(prefixe => cle.startsWith(prefixe)) ?? ""] ?? 3;

function estChampion(vague: number, serieChampions: number | undefined): boolean {
  if (serieChampions === undefined) {
    return vague % 30 === 20 || vague % 30 === 0;
  }
  return vague % 30 === serieChampions % 30;
}

const FIXES = new Map(Object.entries(ClassicFixedBossWaves).map(([vague, nom]) => [Number(vague), nom]));

/** Le combat important de cette vague, ou null pour une vague ordinaire. */
export function combatDeLaVague(vague: number, serieChampions?: number): Omit<CombatImportant, "dans"> | null {
  const fixe = FIXES.get(vague);
  if (fixe) {
    return { vague, genre: fixe.cle.startsWith("RIVAL") ? "rival" : "dresseur", nom: fixe.fr, rang: rangDe(fixe.cle) };
  }
  if (vague <= 0 || vague % 10 !== 0) {
    return null;
  }
  if (vague === VAGUE_FINALE) {
    return { vague, genre: "boss", nom: "Boss final", rang: rangDe("BOSS_FINAL") };
  }
  return estChampion(vague, serieChampions)
    ? { vague, genre: "boss", nom: "Champion d'arène", rang: rangDe("CHAMPION_ARENE") }
    : { vague, genre: "boss", nom: "Boss sauvage", rang: rangDe("BOSS_SAUVAGE") };
}

/** Le premier combat important à partir de `vague` (incluse). Il y en a toujours un dans les 10 vagues. */
export function prochainCombatImportant(vague: number, serieChampions?: number): CombatImportant {
  for (let v = Math.max(vague, 1); ; v++) {
    const combat = combatDeLaVague(v, serieChampions);
    if (combat) {
      return { ...combat, dans: v - vague };
    }
  }
}

/** Le prochain combat contre le rival à partir de `vague` (incluse), ou null au-delà du dernier. */
export function prochainRival(vague: number): CombatImportant | null {
  for (let v = Math.max(vague, 1); v <= 200; v++) {
    const combat = combatDeLaVague(v);
    if (combat?.genre === "rival") {
      return { ...combat, dans: v - vague };
    }
  }
  return null;
}

/**
 * Les types à préparer avant le rival (idée de Carlos : « capturer et apprendre des attaques qui
 * contrent celles du rival, surtout sur le porteur »). Son équipe est tirée au hasard, mais dans
 * des familles connues (jeu : rival-party-config.ts) : un starter (Plante, Feu ou Eau) et un
 * oiseau (Normal/Vol). Rien à préparer si le rival est à plus de 10 vagues.
 */
export function typesAPreparer(vague: number, starterRival?: number): number[] | undefined {
  const rival = prochainRival(vague);
  // Valeurs de PokemonType : Plante 11, Feu 9, Eau 10, Vol 2.
  if (!rival || rival.dans > 10) {
    return undefined;
  }
  return starterRival === undefined ? [11, 9, 10, 2] : [starterRival, 2];
}
