/**
 * L'observateur : traduit l'état du jeu en « ce que le cerveau voit » (voir types.ts).
 *
 * Écrit une seule fois et partagé : le simulateur l'utilise pour entraîner le cerveau,
 * l'extension pour le faire jouer sur pokerogue.net. Le cerveau voit donc la partie décrite
 * exactement de la même façon dans les deux cas.
 */
import { masqueCombat, masqueRemplacement } from "./actions";
import { attaqueVue, type Carnet } from "./carnet";
import { prochainCombatImportant } from "./combats";
import { biomeDuNom, choisirBiome, noterBiome } from "./biomes";
import { optionsEquipePleineAffichees, optionsRecompensesAffichees } from "./decisions-jeu";
import { meilleureOptionEquipe } from "./equipe";
import { meilleurObjet } from "./objets";
import { meilleureOption, optionsApprentissageAffichees } from "./synergie";
import type { AttaqueJeu, PokemonJeu, ScenePokerogue } from "./jeu";
import {
  BattleType,
  BiomeId,
  Nature,
  type Nom,
  PokeballType,
  PokemonType,
  StatusEffect,
  TerrainType,
  WeatherType,
} from "./noms";
import {
  type Attaque,
  type Decision,
  type Libelle,
  type Objet,
  type Observation,
  type PokemonAdverse,
  type PokemonAllie,
  type TypeDecision,
  VERSION_OBSERVATION,
} from "./types";

/** Statistiques permanentes (PV → Vitesse) puis de combat (Attaque → Esquive), numérotation du jeu. */
const STATS_PERMANENTES = [0, 1, 2, 3, 4, 5];
const STATS_COMBAT = [1, 2, 3, 4, 5, 6, 7];

/** Phase du jeu → décision attendue du joueur. */
const DECISIONS: Readonly<Record<string, TypeDecision>> = {
  SelectStarterPhase: "equipe-depart",
  CommandPhase: "combat",
  SelectTargetPhase: "cible",
  SelectModifierPhase: "bonus",
  SwitchPhase: "remplacement",
  LearnMovePhase: "attaque-a-oublier",
  SelectBiomePhase: "biome",
  MysteryEncounterPhase: "rencontre-mystere",
};

function libelle(table: Readonly<Record<number, Nom>>, id: number): Libelle {
  return { id, nom: table[id]?.fr ?? `n°${id}` };
}

function attaque(a: AttaqueJeu): Attaque {
  return {
    ...attaqueVue(a.getMove()),
    pp: Math.max(a.getMovePp() - a.ppUsed, 0),
    ppMax: a.getMovePp(),
  };
}

function objets(p: PokemonJeu): Objet[] {
  return p.getHeldItems().map(o => ({ nom: o.type.name, quantite: o.getStackCount() }));
}

function modifStats(p: PokemonJeu): number[] {
  return p.isOnField() ? STATS_COMBAT.map(s => p.getStatStage(s)) : STATS_COMBAT.map(() => 0);
}

function allie(p: PokemonJeu): PokemonAllie {
  const talent = p.getAbility();
  const passif = p.hasPassive() ? p.getPassiveAbility() : null;
  return {
    uid: p.id,
    espece: p.species.speciesId,
    nom: p.name,
    niveau: p.level,
    pv: p.hp,
    pvMax: p.getMaxHp(),
    statut: libelle(StatusEffect, p.status?.effect ?? 0),
    types: p.getTypes().map(t => libelle(PokemonType, t)),
    talent: { id: talent.id, nom: talent.name },
    passif: passif ? { id: passif.id, nom: passif.name } : null,
    nature: libelle(Nature, p.nature),
    ivs: [...p.ivs],
    stats: STATS_PERMANENTES.map(s => p.getStat(s)),
    statsDeBase: [...p.getSpeciesForm().baseStats],
    modifStats: modifStats(p),
    attaques: p.getMoveset().map(attaque),
    objets: objets(p),
    surTerrain: p.isOnField(),
    position: p.isOnField() ? p.getFieldIndex() : null,
    ko: p.isFainted(),
    shiny: p.shiny,
  };
}

function adversaire(p: PokemonJeu, carnet: Carnet, scene: ScenePokerogue): PokemonAdverse {
  // Avec Illusion, le joueur voit le déguisement : espèce, nom, types et chromatisme affichés.
  const illusion = p.summonData?.illusion ?? null;
  const boss = p.isBoss() && p.bossSegments
    ? { segments: p.bossSegments, segmentsRestants: (p.bossSegmentIndex ?? 0) + 1 }
    : null;
  return {
    uid: p.id,
    espece: illusion?.species ?? p.species.speciesId,
    nom: p.getNameToRender({ useIllusion: true }),
    niveau: p.level,
    position: p.getFieldIndex(),
    statsDeBase: [...p.getSpeciesForm(false, true).baseStats],
    pvPourcent: Math.round(p.getHpRatio(true) * 100),
    statut: libelle(StatusEffect, p.status?.effect ?? 0),
    types: p.getTypes({ useIllusion: true }).map(t => libelle(PokemonType, t)),
    boss,
    modifStats: modifStats(p),
    objets: objets(p),
    shiny: illusion?.shiny ?? p.shiny,
    ko: p.isFainted(),
    // Avec Illusion, le jeu affiche l'icône de l'espèce du déguisement.
    dejaCapture: !!scene.gameData.dexData[illusion?.species ?? p.species.speciesId]?.caughtAttr,
    talentRevele: carnet.talentReveleDe(p.id),
    attaquesVues: carnet.attaquesVuesDe(p.id),
  };
}

/** Lit prudemment les choix affichés par l'interface (récompenses, biomes). */
function optionsAffichees(scene: ScenePokerogue, type: TypeDecision, serieChampions?: number, starterRival?: number): Decision["options"] {
  const ecran = scene.ui.getHandler() as {
    options?: { modifierTypeOption?: { type?: { name?: string }; cost?: number } }[];
    shopOptionsRows?: { modifierTypeOption?: { type?: { name?: string }; cost?: number } }[][];
    config?: { options?: { label?: string }[] };
  } | null;
  if (!ecran) {
    return undefined;
  }
  if (type === "bonus") {
    // Récompenses notées d'après l'état de l'équipe (observateur/objets.ts).
    const notees = optionsRecompensesAffichees(scene, serieChampions, starterRival);
    if (notees) {
      const meilleure = meilleurObjet(notees);
      return notees.map(o => ({ nom: o.nom, note: o.note, pour: o.pour, contre: o.contre, recommandee: o === meilleure }));
    }
    const gratuites = (ecran.options ?? []).map(o => ({ nom: o.modifierTypeOption?.type?.name ?? "?", cout: 0 }));
    const boutique = (ecran.shopOptionsRows ?? []).flat().map(o => ({
      nom: o.modifierTypeOption?.type?.name ?? "?",
      cout: o.modifierTypeOption?.cost ?? 0,
    }));
    return [...gratuites, ...boutique];
  }
  if (type === "biome") {
    const noms = (ecran.config?.options ?? []).map(o => o.label ?? "?");
    const equipe = scene.getPlayerParty().map(allie);
    const fin = scene.currentBattle?.waveIndex ?? 0;
    const choix = choisirBiome(noms, equipe, fin, scene.arena?.biomeId, serieChampions);
    return noms.map((nom, i) => {
      const id = biomeDuNom(nom, scene.arena?.biomeId);
      const note = id === null ? null : noterBiome(id, equipe, fin, serieChampions);
      return { nom, ...(note === null ? {} : { note: Math.round(note * 100) / 100 }), recommandee: i === choix };
    });
  }
  if (type === "attaque-a-oublier") {
    const options = optionsApprentissageAffichees(scene, starterRival);
    if (options) {
      const meilleure = meilleureOption(options);
      return options.map(o => ({
        nom: o.nom, note: o.note, pour: o.pour, contre: o.contre, recommandee: o === meilleure,
      }));
    }
  }
  return undefined;
}

function decision(scene: ScenePokerogue, serieChampions?: number, starterRival?: number): Decision {
  const phase = scene.phaseManager.getCurrentPhase();
  const nomPhase = phase?.phaseName ?? "?";
  // Capture réussie avec l'équipe pleine : garder qui ? (observateur/equipe.ts)
  const equipePleine = optionsEquipePleineAffichees(scene, starterRival);
  if (equipePleine) {
    const meilleure = meilleureOptionEquipe(equipePleine);
    return {
      phase: nomPhase,
      type: "equipe-pleine",
      options: equipePleine.map(o => ({ nom: o.nom, note: o.note, pour: o.pour, contre: o.contre, recommandee: o === meilleure })),
    };
  }
  const type = DECISIONS[nomPhase] ?? "aucune";
  const resultat: Decision = { phase: nomPhase, type };
  if (type === "combat") {
    const pokemon = phase?.getPokemon?.();
    if (pokemon) {
      resultat.acteur = pokemon.id;
      resultat.positionActeur = phase?.getFieldIndex?.() ?? 0;
      resultat.masque = masqueCombat(scene, pokemon, !!scene.currentBattle?.double);
    }
  } else if (type === "remplacement") {
    resultat.positionActeur = phase?.fieldIndex ?? 0;
    resultat.masque = masqueRemplacement(scene);
  }
  const options = optionsAffichees(scene, type, serieChampions, starterRival);
  if (options) {
    resultat.options = options;
  }
  return resultat;
}

/**
 * Décrit la partie telle qu'un humain la voit. Renvoie null hors d'une partie (écran titre…).
 * Le carnet doit avoir été mis à jour juste avant (carnet.mettreAJour(scene)).
 */
export function observer(scene: ScenePokerogue, carnet: Carnet): Observation | null {
  const combat = scene.currentBattle;
  const arene = scene.arena;
  if (!combat || !arene) {
    return null;
  }

  const adversairesSurTerrain = scene.getEnemyField().filter(p => p.isOnField());
  const surTerrain = adversairesSurTerrain.map(p => adversaire(p, carnet, scene));
  surTerrain.forEach(a => carnet.retenirAdversaire(a));
  const dresseur = combat.trainer
    ? {
        nom: combat.trainer.getName(undefined, true),
        pokemonRestants: scene.getEnemyParty().filter(p => !p.isFainted()).length,
        ...(combat.trainer.config?.hasSpecialtyType?.() ? { specialite: combat.trainer.config.specialtyType! } : {}),
      }
    : null;

  const plafond = (scene as unknown as { getMaxExpLevel?: () => number }).getMaxExpLevel?.();
  return {
    version: VERSION_OBSERVATION,
    partie: {
      vague: combat.waveIndex,
      tour: combat.turn,
      typeCombat: libelle(BattleType, combat.battleType),
      double: combat.double,
      biome: libelle(BiomeId, arene.biomeId),
      meteo: libelle(WeatherType, arene.weather?.weatherType ?? 0),
      terrain: libelle(TerrainType, arene.terrain?.terrainType ?? 0),
      argent: scene.money,
      quotidien: scene.gameMode.isDaily,
      balls: Object.entries(scene.pokeballCounts).map(([id, quantite]) => ({
        ...libelle(PokeballType, Number(id)),
        quantite,
      })),
      dresseur,
      prochainCombat: prochainCombatImportant(combat.waveIndex, carnet?.vagueDesChampions()),
      ...(carnet.typeStarterRival() !== undefined ? { starterRival: carnet.typeStarterRival()! } : {}),
      ...(plafond !== undefined ? { plafondNiveau: plafond } : {}),
    },
    equipe: scene.getPlayerParty().map(allie),
    adversaires: surTerrain,
    banc: carnet.bancVu(
      new Set(surTerrain.map(a => a.uid)),
      uid => scene.getEnemyParty().find(p => p.id === uid)?.isFainted() ?? true,
    ),
    decision: decision(scene, carnet.vagueDesChampions(), carnet.typeStarterRival()),
    journal: [...carnet.journal],
  };
}
