/**
 * Note d'équipe : elle doit juger les six Pokémon ensemble.
 */
import { describe, expect, it } from "vitest";
import { evaluerArrivee, type Membre, meilleureOptionEquipe } from "../observateur/equipe";
import type { AttaqueNotee } from "../observateur/synergie";

// Valeurs du jeu : PokemonType (Normal 0, Vol 2, Poison 3, Sol 4, Insecte 6, Feu 9, Eau 10, Plante 11,
// Électrik 12, Psy 13, Glace 14) ; MoveCategory (physique 0, spéciale 1).
const attaque = (nom: string, type: number, categorie: number, puissance: number): AttaqueNotee => ({
  nom, type, categorie, puissance, precision: 100,
});
const membre = (nom: string, espece: number, niveau: number, types: number[], attaques: AttaqueNotee[], force = 1): Membre => ({
  nom, espece, niveau, types, attaques,
  stats: [45, 50, 45, 50, 45, 45].map(s => Math.round(s * force * niveau / 10)),
});

const salameche = membre("Salamèche", 4, 15, [9], [attaque("Flammèche", 9, 1, 40), attaque("Griffe", 0, 0, 40)]);
const reptincel = membre("Reptincel", 5, 16, [9], [attaque("Crocs Feu", 9, 0, 65)]);
const carapuce = membre("Carapuce", 7, 15, [10], [attaque("Pistolet à O", 10, 1, 40)]);
const tiplouf = membre("Tiplouf", 393, 15, [10], [attaque("Écume", 10, 1, 40)]);
const roucool = membre("Roucool", 16, 14, [0, 2], [attaque("Tornade", 2, 1, 40)]);
const chenipan = membre("Chenipan", 10, 13, [6], [attaque("Piqûre", 6, 0, 60)]);

describe("Note d'équipe", () => {
  // Roucool (Normal/Vol) et Chenipan (Insecte) ne partagent de type avec personne.
  const equipe = [salameche, reptincel, carapuce, tiplouf, roucool, chenipan];

  it("remplace un doublon plutôt qu'un membre unique", () => {
    // Pikachu (Électrik) arrive : il doit prendre la place d'un Feu ou d'un Eau en double,
    // pas celle de Roucool (seul type Vol).
    const pikachu = membre("Pikachu", 25, 15, [12], [attaque("Éclair", 12, 1, 40)]);
    const choix = meilleureOptionEquipe(evaluerArrivee(equipe, pikachu));
    expect(choix.remplacer).not.toBeNull();
    expect([salameche, reptincel, carapuce, tiplouf].map(m => m.nom)).toContain(
      equipe[choix.remplacer!]!.nom,
    );
  });

  it("ne garde pas un nouveau bien plus faible qui n'apporte rien", () => {
    const petitRattata = membre("Rattata", 19, 3, [0], [attaque("Charge", 0, 0, 40)]);
    expect(meilleureOptionEquipe(evaluerArrivee(equipe, petitRattata)).remplacer).toBeNull();
  });

  it("signale les doublons dans les contre", () => {
    const autreTiplouf = membre("Tiplouf", 393, 15, [10], [attaque("Écume", 10, 1, 40)]);
    const options = evaluerArrivee(equipe, autreTiplouf);
    const contreRoucool = options.find(o => o.remplacer === 4)!.contre.join(" ");
    expect(contreRoucool).toMatch(/même espèce|en double/);
    expect(options).toHaveLength(7);
  });
});

describe("Potentiel des espèces", () => {
  const equipe = [salameche, reptincel, carapuce, tiplouf, roucool, chenipan];

  it("garde un Embrylex prometteur à la place d'un membre faible", () => {
    const embrylex = membre("Embrylex", 246, 12, [5, 4], [attaque("Morsure", 15, 0, 60)]);
    const choix = meilleureOptionEquipe(evaluerArrivee(equipe, embrylex));
    expect(choix.remplacer).not.toBeNull();
    expect(choix.pour.join(" ")).toMatch(/potentiel/);
  });

  it("à niveau, types et attaques égaux, préfère l'espèce au meilleur potentiel", () => {
    // Seule l'espèce change : Embrylex (forme finale 600) contre Rattata (forme finale 413).
    const charge = [attaque("Charge", 0, 0, 40)];
    const note = (espece: number) => meilleureOptionEquipe(evaluerArrivee(equipe, membre("X", espece, 13, [0], charge))).note;
    expect(note(246)).toBeGreaterThan(note(19));
  });
});
