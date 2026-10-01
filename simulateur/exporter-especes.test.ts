/**
 * Exporte la connaissance « Pokédex » du jeu, en JSON : pour chaque espèce, ses types, son total
 * de statistiques, ses talents possibles (dont le talent caché), ses attaques par niveau et ses
 * évolutions ; pour chaque attaque, son type, sa catégorie, sa puissance ; pour chaque talent, les
 * types qu'il annule (Lévitation → Sol…).
 * C'est ce qu'un joueur sait (ou trouve sur un wiki) : ce qu'un Pokémon PEUT avoir, jamais ce que
 * l'adversaire a réellement. Utilisé par observateur/generer-especes.py pour régénérer
 * observateur/donnees-especes.ts. Lancé depuis jeu/test/bot/.
 */
import { allAbilities, allMoves } from "#data/data-lists";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { AbilityId } from "#enums/ability-id";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import fs from "node:fs";
import Phaser from "phaser";
import { it } from "vitest";

it("exporte la connaissance des espèces", () => {
  new GameManager(new Phaser.Game({ type: Phaser.HEADLESS }));
  const especes = speciesDataRegistry.getAllSpecies().map(s => ({
    id: s.speciesId,
    cle: SpeciesId[s.speciesId],
    types: [s.type1, s.type2].filter(t => t !== null && t !== undefined),
    total: s.baseTotal,
    talents: [s.ability1, s.ability2, s.abilityHidden],
    attaques: s.getLevelMoves().map(([niveau, attaque]) => [niveau, attaque]),
    evolutions: speciesDataRegistry.getEvolutions(s.speciesId).map(e => e.speciesId),
    capture: s.catchRate,
  }));
  const attaques = allMoves
    .filter(m => m)
    .map(m => ({ id: m.id, cle: MoveId[m.id], type: m.type, categorie: m.category, puissance: m.power, precision: m.accuracy }));
  const talents = allAbilities
    .filter(a => a)
    .map(a => ({
      id: a.id,
      cle: AbilityId[a.id],
      // Les types annulés par ce talent (Lévitation : Sol ; Absorb Eau : Eau…). Garde Mystik
      // (« seuls les coups super efficaces passent ») n'a pas de type précis : ignoré.
      immunites: a
        .getAttrs("TypeImmunityAbAttr")
        .map(attr => (attr as unknown as { immuneType: number | null }).immuneType)
        .filter((t): t is number => t !== null),
    }));
  fs.writeFileSync(process.env.SORTIE ?? "especes.json", JSON.stringify({ especes, attaques, talents }));
});
