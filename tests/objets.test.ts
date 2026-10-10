/**
 * Note des objets : chaque récompense est jugée d'après l'état de l'équipe.
 */
import { describe, expect, it } from "vitest";
import { prochainCombatImportant } from "../observateur/combats";
import {
  urgenceSoin,
  type ContexteObjets,
  evaluerAchats,
  evaluerObjets,
  type MembreObjets,
  meilleurAchat,
  meilleurObjet,
  type ObjetPropose,
} from "../observateur/objets";

const membre = (nom: string, niveau: number, types: number[], pv: number, pvMax: number, extra: Partial<MembreObjets> = {}): MembreObjets => ({
  nom, espece: 1, niveau, types, stats: [pvMax, 30, 25, 20, 25, 30], pv, pvMax, ko: pv === 0, statut: false,
  attaques: [{ nom: "Charge", type: 0, categorie: 0, puissance: 40, precision: 100 }], ppRatios: [1], ...extra,
});

const potion: ObjetPropose = { id: "POTION", nom: "Potion", cout: 0, soin: { points: 20, pourcent: 10, statut: false } };
const rappel: ObjetPropose = { id: "REVIVE", nom: "Rappel", cout: 0, ranime: { pourcent: 50 } };
const balls: ObjetPropose = { id: "POKEBALL", nom: "5 Poké Balls", cout: 0, ball: { type: 0, nombre: 5 } };
const charbon: ObjetPropose = { id: "ATTACK_TYPE_BOOSTER", nom: "Charbon", cout: 0, boosterType: { type: 9 } };

describe("Note des objets", () => {
  it("ne prend pas de Potion quand tout le monde est en pleine forme", () => {
    const ctx: ContexteObjets = { equipe: [membre("Salamèche", 10, [9], 30, 30)], balls: [5, 0, 0, 0, 0] };
    const options = evaluerObjets([potion, balls], ctx);
    expect(options[0]!.note).toBe(0);
    expect(options[0]!.contre).toContain("tout le monde est en pleine forme");
    expect(meilleurObjet(options)!.nom).toBe("5 Poké Balls");
  });

  it("préfère le Rappel quand un membre important est K.O.", () => {
    const ctx: ContexteObjets = {
      equipe: [membre("Carapuce", 12, [10], 0, 32), membre("Rattata", 5, [0], 10, 18)],
      balls: [5, 0, 0, 0, 0],
    };
    const choix = meilleurObjet(evaluerObjets([potion, rappel, balls], ctx))!;
    expect(choix.nom).toBe("Rappel");
    expect(choix.cible).toBe(0);
  });

  it("donne le Charbon à celui qui a des attaques Feu", () => {
    const flammeche = { nom: "Flammèche", type: 9, categorie: 1, puissance: 40, precision: 100 };
    const ctx: ContexteObjets = {
      equipe: [membre("Rattata", 12, [0], 20, 20), membre("Salamèche", 11, [9], 25, 25, { attaques: [flammeche] })],
      balls: [0, 0, 0, 0, 0],
    };
    const [option] = evaluerObjets([charbon], ctx);
    expect(option!.cible).toBe(1);
    expect(option!.note).toBeGreaterThan(0);
  });

  it("écarte un objet que le jeu refuse à tout le monde", () => {
    const ctx: ContexteObjets = { equipe: [membre("Salamèche", 10, [9], 5, 30)], balls: [5, 0, 0, 0, 0] };
    const refusee = { ...potion, ciblesPossibles: [] };
    const options = evaluerObjets([refusee], ctx);
    expect(options[0]!.note).toBeLessThan(0);
    expect(meilleurObjet(options)).toBeNull(); // mieux vaut passer que s'entêter
  });

  it("soigne plutôt juste avant le rival", () => {
    const equipe = [membre("Kaiminus", 8, [10], 14, 26)];
    const exp: ObjetPropose = { id: "EXP_CHARM", nom: "Charme Exp", cout: 0 };
    const loin = { equipe, balls: [5, 0, 0, 0, 0], prochainCombat: prochainCombatImportant(3) };
    const proche = { ...loin, prochainCombat: prochainCombatImportant(8) };
    expect(meilleurObjet(evaluerObjets([potion, exp], loin))!.nom).toBe("Charme Exp");
    const choix = meilleurObjet(evaluerObjets([potion, exp], proche))!;
    expect(choix.nom).toBe("Potion");
    expect(choix.pour.join(" ")).toMatch(/avant : Rival/);
  });

  it("achète une Potion pour un membre blessé, pas pour une équipe en forme", () => {
    const enBoutique = { ...potion, cout: 50 };
    const blesse: ContexteObjets = { equipe: [membre("Kaiminus", 8, [10], 8, 26)], balls: [5, 0, 0, 0, 0] };
    const enForme: ContexteObjets = { equipe: [membre("Kaiminus", 8, [10], 26, 26)], balls: [5, 0, 0, 0, 0] };
    expect(meilleurAchat(evaluerAchats([enBoutique], blesse, 500))?.cible).toBe(0);
    expect(meilleurAchat(evaluerAchats([enBoutique], enForme, 500))).toBeNull();
    expect(meilleurAchat(evaluerAchats([enBoutique], blesse, 30))).toBeNull(); // trop cher
  });
});

describe("Argent et objets (retours de Carlos, 04/10)", () => {
  const pepite: ObjetPropose = { id: "NUGGET", nom: "Pépite", cout: 0 };
  const argent = { argent: 1000, prixBase: 500 };

  it("prend la Pépite et laisse la Potion gratuite quand la boutique la vend moins cher", () => {
    const ctx: ContexteObjets = { equipe: [membre("Kaiminus", 20, [10], 20, 60)], balls: [5, 0, 0, 0, 0], ...argent, prixBoutique: { POTION: 100 } };
    expect(meilleurObjet(evaluerObjets([potion, pepite], ctx))!.nom).toBe("Pépite");
    // Sans boutique (vague 10, 20…), la Potion garde sa valeur.
    const sansBoutique: ContexteObjets = { ...ctx, prixBoutique: undefined };
    expect(meilleurObjet(evaluerObjets([potion, pepite], sansBoutique))!.nom).toBe("Potion");
  });

  it("ne prend jamais de Leurre (plus de combats doubles)", () => {
    const leurre: ObjetPropose = { id: "LURE", nom: "Leurre", cout: 0 };
    expect(meilleurObjet(evaluerObjets([leurre], { equipe: [membre("Kaiminus", 20, [10], 60, 60)], balls: [5, 0, 0, 0, 0] }))).toBeNull();
  });

  it("Bracelet Dynamax : précieux seulement si un membre peut se Gigamaxer", () => {
    const bracelet: ObjetPropose = { id: "DYNAMAX_BAND", nom: "Bracelet Dynamax", cout: 0 };
    const equipe = [membre("Dracaufeu", 50, [9, 2], 150, 150)];
    const avec = evaluerObjets([bracelet], { equipe, balls: [0, 0, 0, 0, 0], formesSpeciales: { mega: true, gigamax: true } })[0]!.note;
    const sans = evaluerObjets([bracelet], { equipe, balls: [0, 0, 0, 0, 0], formesSpeciales: { mega: false, gigamax: false } })[0]!.note;
    expect(avec).toBeGreaterThan(30);
    expect(sans).toBeLessThan(10);
  });

  it("hors combat important, n'achète pas pour un membre faible ou à peine touché", () => {
    const enBoutique = { ...potion, cout: 100 };
    const porteur = membre("Aligatueur", 40, [10], 150, 150);
    const faibleBlesse: ContexteObjets = { equipe: [porteur, membre("Rattata", 20, [0], 10, 60)], balls: [5, 0, 0, 0, 0], ...argent };
    expect(meilleurAchat(evaluerAchats([enBoutique], faibleBlesse, 1000))).toBeNull();
    const porteurBlesse: ContexteObjets = { equipe: [membre("Aligatueur", 40, [10], 40, 150)], balls: [5, 0, 0, 0, 0], ...argent };
    expect(meilleurAchat(evaluerAchats([enBoutique], porteurBlesse, 1000))?.cible).toBe(0);
  });
});

describe("Stratégie du porteur", () => {
  it("donne le Super Bonbon au meilleur Pokémon tant qu'il est sous le niveau 40", () => {
    const bonbon: ObjetPropose = { id: "RARE_CANDY", nom: "Super Bonbon", cout: 0 };
    const jeune = { equipe: [membre("Rattata", 6, [0], 20, 20), membre("Kaiminus", 18, [10], 40, 40)], balls: [5, 0, 0, 0, 0] };
    expect(evaluerObjets([bonbon], jeune)[0]!.cible).toBe(1);
    const avance = { equipe: [membre("Rattata", 30, [0], 60, 60), membre("Aligatueur", 55, [10], 160, 160)], balls: [5, 0, 0, 0, 0] };
    expect(evaluerObjets([bonbon], avance)[0]!.cible).toBe(0); // passé 40, il aide le membre en retard
  });

  it("prend la Carte (choix du biome) devant un Super Bonbon, mais pas une deuxième", () => {
    const carte: ObjetPropose = { id: "MAP", nom: "Carte", cout: 0 };
    const bonbon: ObjetPropose = { id: "RARE_CANDY", nom: "Super Bonbon", cout: 0 };
    const equipe = [membre("Kaiminus", 30, [10], 80, 80), membre("Rattata", 25, [0], 60, 60)];
    expect(meilleurObjet(evaluerObjets([bonbon, carte], { equipe, balls: [10, 0, 0, 0, 0] }))!.nom).toBe("Carte");
    expect(evaluerObjets([carte], { equipe, balls: [10, 0, 0, 0, 0], possedeCarte: true })[0]!.note).toBe(0);
  });

  it("n'empile plus les Charmes Exp quand l'équipe est au plafond", () => {
    const charme: ObjetPropose = { id: "EXP_CHARM", nom: "Charme Exp", cout: 0 };
    const equipe = [membre("Dracaufeu", 60, [9], 150, 150), membre("Tortank", 58, [10], 150, 150)];
    const debut = evaluerObjets([charme], { equipe, balls: [0, 0, 0, 0, 0], plafondNiveau: 78 })[0]!.note;
    const auPlafond = evaluerObjets([charme], { equipe, balls: [0, 0, 0, 0, 0], plafondNiveau: 60 })[0]!.note;
    expect(debut).toBe(25);
    expect(auPlafond).toBeLessThan(6);
  });
});

describe("Urgence des soins selon l'importance du combat", () => {
  it("pas d'urgence avant un boss sauvage : le soin gratuit du nouveau biome suffit", () => {
    expect(urgenceSoin(prochainCombatImportant(40, 20))).toBe(1);
    expect(urgenceSoin(prochainCombatImportant(50, 20))).toBeGreaterThan(1);
  });
});
