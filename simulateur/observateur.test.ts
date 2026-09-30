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
import { BattlerIndex as BattlerIndexJeu } from "#enums/battler-index";
import { Button as ButtonJeu } from "#enums/buttons";
import { Command as CommandJeu } from "#enums/command";
import { BiomeId as BiomeIdJeu } from "#enums/biome-id";
import { MoveId } from "#enums/move-id";
import { Button } from "#enums/buttons";
import { MoveCategory as MoveCategoryJeu } from "#enums/move-category";
import { MoveTarget as MoveTargetJeu } from "#enums/move-target";
import { MoveUseMode as MoveUseModeJeu } from "#enums/move-use-mode";
import { Nature as NatureJeu } from "#enums/nature";
import { PokeballType as PokeballTypeJeu } from "#enums/pokeball";
import { PokemonType as PokemonTypeJeu } from "#enums/pokemon-type";
import { SpeciesId } from "#enums/species-id";
import { StatusEffect as StatusEffectJeu } from "#enums/status-effect";
import { UiMode as UiModeJeu, UiMode } from "#enums/ui-mode";
import { WeatherType as WeatherTypeJeu } from "#enums/weather-type";
import { GameManager } from "#test/framework/game-manager";
import fs from "node:fs";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NOMBRE_ACTIONS, PREMIERE_BALL } from "../../../observateur/actions";
import { Carnet } from "../../../observateur/carnet";
import { encoder, TAILLE_OBSERVATION } from "../../../observateur/encodeur";
import type { ScenePokerogue } from "../../../observateur/jeu";
import type { Observation } from "../../../observateur/types";
import * as noms from "../../../observateur/noms";
import { observer } from "../../../observateur/observateur";
import { decisionCerveauEnAttente, executerAction, nouvelEtatPilote } from "../../../pilote/pilote";

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

  it("calcule les actions permises en combat simple", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);
    const obs = observer(game.scene, new Carnet())!;
    const masque = obs.decision.masque!;

    expect(masque).toHaveLength(NOMBRE_ACTIONS);
    // Attaques 0 (Trempette) et 1 (Charge) sur l'unique ennemi (place 0) : actions 0 et 2.
    expect(masque.slice(0, 8)).toEqual([true, false, true, false, false, false, false, false]);
    // Envoyer la place 1 (Salamèche) : action 9. La place 0 est déjà sur le terrain.
    expect(masque.slice(8, 14)).toEqual([false, true, false, false, false, false]);
    // Combat sauvage, un seul ennemi, 5 Poké Balls en stock (et aucune autre Ball) : action 14.
    expect(masque.slice(14)).toEqual([true, false, false, false, false]);
  });

  it("interdit les Poké Balls contre un dresseur", async () => {
    game.override.battleType(BattleTypeJeu.TRAINER);
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    expect(observer(game.scene, new Carnet())!.decision.masque!.slice(14)).toEqual([false, false, false, false, false]);
  });

  it("exécute un lancer de Poké Ball choisi par le cerveau", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    expect(decisionCerveauEnAttente(game.scene)).toBe("combat");
    expect(executerAction(game.scene, PREMIERE_BALL, nouvelEtatPilote())).toBe(true);
    // Le jeu enchaîne sur la tentative de capture (la Ball est décomptée à ce moment-là).
    await game.phaseInterceptor.to("AttemptCapturePhase", false);
    expect(game.scene.phaseManager.getCurrentPhase().phaseName).toBe("AttemptCapturePhase");
  });

  it("propose les deux cibles en combat double", async () => {
    game.override.battleStyle("double");
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);
    const obs = observer(game.scene, new Carnet())!;

    expect(obs.partie.double).toBe(true);
    expect(obs.adversaires.map(a => a.position).sort()).toEqual([0, 1]);
    // Trempette (attaque 0) ne vise que son lanceur : une seule action, pas deux.
    expect(obs.decision.masque!.slice(0, 2)).toEqual([true, false]);
    // Charge (attaque 1) vise un seul ennemi : les deux cibles sont des choix distincts.
    expect(obs.decision.masque!.slice(2, 4)).toEqual([true, true]);
    // Deux ennemis sur le terrain : le jeu interdit les Poké Balls.
    expect(obs.decision.masque!.slice(14)).toEqual([false, false, false, false, false]);
  });

  it("encode l'observation en nombres de taille fixe", async () => {
    await game.classicMode.startBattle(SpeciesId.BULBASAUR, SpeciesId.CHARMANDER);
    const vecteur = encoder(observer(game.scene, new Carnet())!);

    expect(vecteur).toHaveLength(TAILLE_OBSERVATION);
    expect(vecteur.every(Number.isFinite)).toBe(true);
    expect(Math.max(...vecteur)).toBeLessThanOrEqual(3);
  });

  it("note le jeu d'attaques complet quand il faut en oublier une", async () => {
    game.override.startingLevel(5).enemyLevel(5).xpMultiplier(50);
    await game.classicMode.startBattle(SpeciesId.BULBASAUR);
    const bulbizarre = game.field.getPlayerPokemon();
    game.move.changeMoveset(bulbizarre, [MoveId.SPLASH, MoveId.GROWL, MoveId.TACKLE, MoveId.POUND]);
    game.move.select(MoveId.SPLASH);
    await game.doKillOpponents();

    let options: Observation["decision"]["options"];
    // « Oublier une attaque ? » → oui ; écran de résumé → on lit les options, puis on refuse ;
    // « Arrêter d'apprendre ? » → oui.
    game.onNextPrompt("LearnMovePhase", UiMode.CONFIRM, () => game.scene.ui.processInput(Button.ACTION));
    game.onNextPrompt("LearnMovePhase", UiMode.SUMMARY, () => {
      options = observer(game.scene, new Carnet())!.decision.options;
      game.scene.ui.setCursor(4);
      game.scene.ui.processInput(Button.ACTION);
    });
    game.onNextPrompt("LearnMovePhase", UiMode.CONFIRM, () => game.scene.ui.processInput(Button.ACTION));
    await game.phaseInterceptor.to("LearnMovePhase");

    // 5 options notées : refuser, ou oublier l'une des 4 attaques, dont une seule recommandée.
    expect(options!.map(o => o.nom)).toEqual([
      expect.stringMatching(/^Ne pas apprendre /),
      "Oublier Splash",
      "Oublier Growl",
      "Oublier Tackle",
      "Oublier Pound",
    ]);
    expect(options!.every(o => typeof o.note === "number")).toBe(true);
    expect(options!.filter(o => o.recommandee)).toHaveLength(1);
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
    // Valeurs techniques utilisées par le pilote.
    expect(cles(noms.BattlerIndex)).toEqual(paires(BattlerIndexJeu));
    expect(cles(noms.Button)).toEqual(paires(ButtonJeu));
    expect(cles(noms.Command)).toEqual(paires(CommandJeu));
    expect(cles(noms.MoveTarget)).toEqual(paires(MoveTargetJeu));
    expect(cles(noms.MoveUseMode)).toEqual(paires(MoveUseModeJeu));
    expect(cles(noms.UiMode)).toEqual(paires(UiModeJeu));
  });
});
