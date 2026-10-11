import BIOMES from "../donnees/biomes.json";
import { connaissance } from "./especes";
import { efficacite } from "./prevision";
import type { PokemonAllie } from "./types";

interface BiomeDonnees {
  nom: string;
  en: string | null;
  fr: string | null;
  liens: number[][];
  sauvages: Record<string, number[]>;
  champions: { nom: string; type: number }[];
}

const DONNEES = BIOMES.biomes as Record<string, BiomeDonnees>;
const POIDS_RANGS: Record<string, number> = { COMMON: 356, UNCOMMON: 124, RARE: 26, SUPER_RARE: 5, ULTRA_RARE: 1 };
const POIDS_CHAMPION = 3;
const CATEGORIE_STATUT = 2;

function contre(m: PokemonAllie, types: readonly number[]): number {
  const mesTypes = m.types.map(t => t.id);
  const offensives = m.attaques.filter(a => a.categorie.id !== CATEGORIE_STATUT && a.puissance > 0 && a.pp > 0);
  const attaque = Math.max(0.25, ...offensives.map(a => efficacite(a.type.id, types) * (mesTypes.includes(a.type.id) ? 1.5 : 1)));
  const defense = 1 / Math.max(0.25, ...types.map(t => efficacite(t, mesTypes)));
  return attaque * defense;
}

export function equipeContre(equipe: PokemonAllie[], types: readonly number[]): number {
  return Math.log2(Math.max(0.0625, ...equipe.filter(m => !m.ko).map(m => contre(m, types))));
}

function noteSauvages(equipe: PokemonAllie[], b: BiomeDonnees): number {
  let total = 0;
  let poids = 0;
  for (const [rang, p] of Object.entries(POIDS_RANGS)) {
    const especes = (b.sauvages[rang] ?? []).map(e => connaissance(e)?.types).filter((t): t is readonly number[] => !!t);
    if (!especes.length) {
      continue;
    }
    total += p * especes.reduce((s, t) => s + equipeContre(equipe, t), 0) / especes.length;
    poids += p;
  }
  return poids ? total / poids : 0;
}

function chanceChampion(fin: number, serieChampions: number | undefined): number {
  const vagues = Array.from({ length: 10 }, (_, i) => fin + 1 + i);
  const series = serieChampions === undefined ? [20, 30] : [serieChampions];
  return series.filter(s => vagues.some(v => v % 30 === s % 30)).length / series.length;
}

export function noterBiome(id: number, equipe: PokemonAllie[], fin: number, serieChampions?: number): number | null {
  const b = DONNEES[id];
  if (!b) {
    return null;
  }
  const champions = b.champions.filter(c => c.type >= 0);
  const noteChampion = champions.length
    ? champions.reduce((s, c) => s + equipeContre(equipe, [c.type]), 0) / champions.length
    : 0;
  return noteSauvages(equipe, b) + POIDS_CHAMPION * chanceChampion(fin, serieChampions) * noteChampion;
}

export function biomeDuNom(nom: string, biomeActuel?: number): number | null {
  const cherche = nom.trim().toLowerCase();
  const voisins = biomeActuel === undefined ? null : new Set((DONNEES[biomeActuel]?.liens ?? []).map(l => l[0]));
  const trouves = Object.entries(DONNEES)
    .filter(([, b]) => [b.en, b.fr].some(n => n?.toLowerCase() === cherche))
    .map(([id]) => Number(id));
  return trouves.find(id => !voisins || voisins.has(id)) ?? trouves[0] ?? null;
}

export function choisirBiome(noms: string[], equipe: PokemonAllie[], fin: number, biomeActuel?: number, serieChampions?: number): number {
  const notes = noms.map(n => {
    const id = biomeDuNom(n, biomeActuel);
    return id === null ? null : noterBiome(id, equipe, fin, serieChampions);
  });
  if (notes.some(n => n === null)) {
    return 0;
  }
  return notes.reduce<number>((m, n, i) => (n! > notes[m]! ? i : m), 0);
}
