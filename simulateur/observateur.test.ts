/**
 * Tests de l'observateur sur le vrai jeu, sans écran.
 *
 * Ils vérifient trois choses :
 * 1. le contrat de observateur/jeu.ts colle aux vraies classes du jeu (vérifié par `tsc`, voir
 *    l'affectation `const vue: ScenePokerogue = game.scene` plus bas) ;
 * 2. le cerveau voit ce qu'un humain voit, et rien de plus (pas les IVs de l'adversaire…) ;
 * 3. les tables de noms générées correspondent toujours aux énumérations du jeu.
 *
 * Lancement : ./simulateur/lancer-tests.sh
 */
import { TerrainType as TerrainTypeJeu } from "#data/terrain";
import { AbilityId } from "#enums/ability-id";
import { BattleType as BattleTypeJeu } from "#enums/battle-type";
import { BiomeId as BiomeIdJeu } from "#enums/biome-id";
import { MoveId } from "#enums/move-id";
import { MoveCategory as MoveCategoryJeu } from "#enums/move-category";
import { Nature as NatureJeu } from "#enums/nature";
import { PokeballType as PokeballTypeJeu } from "#enums/pokeball";
import { PokemonType as PokemonTypeJeu } from "#enums/pokemon-type";
import { SpeciesId } from "#enums/species-id";
import { StatusEffect as StatusEffectJeu } from "#enums/status-effect";
import { WeatherType as WeatherTypeJeu } from "#enums/weather-type";
import { GameManager } from "#test/framework/game-manager";
import fs from "node:fs";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Carnet } from "../../../observateur/carnet";
import type { ScenePokerogue } from "../../../observateur/jeu";
import * as noms from "../../../observateur/noms";
import { observer } from "../../../observateur/observateur";

describe("Observateur", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override
      .battleStyle("single")
      .enemySpecies(SpeciesId.RATTATA)
      .enemyAbility(AbilityId.RUN_AWAY)
      .enemyMoveset([MoveId.TACKLE, MoveId.QUICK_ATTACK, MoveId.TAIL_WHIP, MoveId.BITE])
      .moveset([MoveId.SPLASH, MoveId.TACKLE])
      .startingLevel(50)
      .enemyLevel(50);
  });

  it("colle aux vraies classes du jeu", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    // Si une mise à jour du jeu renomme une propriété lue par l'observateur,
    // cette ligne ne compile plus (`tsc` dans le dossier du jeu).
    const vue: ScenePokerogue = game.scene;
    expect(observer(vue, new Carnet())).not.toBeNull();
  });

  it("voit tout de son équipe", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);
    const carnet = new Carnet();
    carnet.mettreAJour(game.scene);
    const obs = observer(game.scene, carnet)!;

    expect(obs.equipe).toHaveLength(2);
    const bulbizarre = obs.equipe[0];
    expect(bulbizarre.ivs).toHaveLength(6);
    expect(bulbizarre.stats).toHaveLength(6);
    expect(bulbizarre.modifStats).toHaveLength(7);
    expect(bulbizarre.nature.nom).not.toMatch(/^n°/);
    expect(bulbizarre.attaques.map(a => a.id)).toEqual([MoveId.SPLASH, MoveId.TACKLE]);
    expect(bulbizarre.surTerrain).toBe(true);
    expect(obs.equipe[1].surTerrain).toBe(false);
    expect(obs.decision).toMatchObject({ type: "combat", acteur: game.scene.getPlayerParty()[0].id });
  });

  it("ne voit de l'adversaire que ce qui s'affiche", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    const carnet = new Carnet();
    carnet.mettreAJour(game.scene);
    const obs = observer(game.scene, carnet)!;

    expect(obs.adversaires).toHaveLength(1);
    const rattata = obs.adversaires[0];
    expect(rattata.espece).toBe(SpeciesId.RATTATA);
    expect(rattata.pvPourcent).toBe(100);
    // Rien de caché : ni IVs, ni nature, ni stats exactes, ni PV exacts, ni attaques non utilisées.
    for (const cle of ["ivs", "nature", "stats", "pv", "pvMax", "attaques", "talent"]) {
      expect(rattata).not.toHaveProperty(cle);
    }
    expect(rattata.attaquesVues).toEqual([]);
    expect(rattata.talentRevele).toBeNull();
  });

  it("retient les attaques que l'adversaire a utilisées", async () => {
    game.override.enemyMoveset(MoveId.BITE);
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    const carnet = new Carnet();

    game.move.select(MoveId.SPLASH);
    await game.toNextTurn();
    carnet.mettreAJour(game.scene);
    const obs = observer(game.scene, carnet)!;

    expect(obs.adversaires[0].attaquesVues.map(a => a.id)).toEqual([MoveId.BITE]);
    expect(obs.journal.some(e => e.texte.startsWith("Vague"))).toBe(true);
    expect(obs.journal.some(e => e.texte.startsWith("Rencontre"))).toBe(true);
  });

  it("retient le talent de l'adversaire une fois affiché", async () => {
    // Intimidation s'affiche à l'entrée en combat.
    game.override.enemyAbility(AbilityId.INTIMIDATE);
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    const carnet = new Carnet();
    carnet.mettreAJour(game.scene);

    expect(observer(game.scene, carnet)!.adversaires[0].talentRevele?.id).toBe(AbilityId.INTIMIDATE);
  });

  // Produit une vraie observation pour la page d'aperçu du panneau (extension/apercu.html).
  // Lancé seulement à la demande : EXPORT_OBSERVATION=chemin ./simulateur/lancer-tests.sh
  it.runIf(process.env.EXPORT_OBSERVATION)("exporte une observation d'exemple", async () => {
    game.override
      .battleStyle("double")
      .enemyAbility(AbilityId.INTIMIDATE)
      .enemyMoveset(MoveId.BITE)
      .moveset([MoveId.SPLASH, MoveId.TACKLE, MoveId.VINE_WHIP, MoveId.GROWL])
      .startingLevel(12)
      .enemyLevel(11);
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE);
    const carnet = new Carnet();
    game.move.select(MoveId.SPLASH, 0);
    game.move.select(MoveId.SPLASH, 1);
    await game.toNextTurn();
    carnet.mettreAJour(game.scene);
    fs.writeFileSync(process.env.EXPORT_OBSERVATION!, JSON.stringify(observer(game.scene, carnet), null, 2));
  });

  it("a des tables de noms à jour avec le jeu", () => {
    const paires = (e: object) =>
      Object.fromEntries(Object.entries(e).filter(([, v]) => typeof v === "number").map(([k, v]) => [v, k]));
    const cles = (t: Readonly<Record<number, noms.Nom>>) =>
      Object.fromEntries(Object.entries(t).map(([id, n]) => [id, n.cle]));

    expect(cles(noms.BattleType)).toEqual(paires(BattleTypeJeu));
    expect(cles(noms.BiomeId)).toEqual(paires(BiomeIdJeu));
    expect(cles(noms.MoveCategory)).toEqual(paires(MoveCategoryJeu));
    expect(cles(noms.Nature)).toEqual(paires(NatureJeu));
    expect(cles(noms.PokeballType)).toEqual(paires(PokeballTypeJeu));
    expect(cles(noms.PokemonType)).toEqual(paires(PokemonTypeJeu));
    expect(cles(noms.StatusEffect)).toEqual(paires(StatusEffectJeu));
    expect(cles(noms.TerrainType)).toEqual(paires(TerrainTypeJeu));
    expect(cles(noms.WeatherType)).toEqual(paires(WeatherTypeJeu));
  });
});
