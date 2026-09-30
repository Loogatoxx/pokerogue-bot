/**
 * Le calcul TypeScript du cerveau (extension) doit donner les mêmes réponses que PyTorch
 * (entraînement). Fixture fabriquée par : .venv/bin/python -m entraineur.fixture_equivalence
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lireCerveau, meilleureAction, penser } from "../cerveau/cerveau";

const fixture = (nom: string) => readFileSync(new URL(`./fixtures/${nom}`, import.meta.url));

describe("Cerveau (calcul TypeScript)", () => {
  const fichier = fixture("mini.cerveau");
  const cerveau = lireCerveau(fichier.buffer.slice(fichier.byteOffset, fichier.byteOffset + fichier.byteLength));
  const cas: { entree: number[]; masque: boolean[]; probabilites: number[]; valeur: number }[] = JSON.parse(
    fixture("mini-attendu.json").toString(),
  );

  it("lit l'en-tête", () => {
    expect(cerveau.entete).toMatchObject({ nom: "mini", tailleEntree: 40, nombreActions: 14 });
    expect(cerveau.entete.tronc.map(c => c.sortie)).toEqual([32, 16]);
  });

  it("donne les mêmes probabilités et la même valeur que PyTorch", () => {
    for (const c of cas) {
      const reponse = penser(cerveau, Float32Array.from(c.entree), c.masque);
      reponse.probabilites.forEach((p, i) => expect(p).toBeCloseTo(c.probabilites[i]!, 5));
      expect(reponse.valeur).toBeCloseTo(c.valeur, 5);
    }
  });

  it("ne choisit jamais une action interdite", () => {
    for (const c of cas) {
      const reponse = penser(cerveau, Float32Array.from(c.entree), c.masque);
      reponse.probabilites.forEach((p, i) => {
        if (!c.masque[i]) {
          expect(p).toBe(0);
        }
      });
      expect(c.masque[meilleureAction(reponse)]).toBe(true);
    }
  });

  it("refuse un fichier qui n'est pas un cerveau", () => {
    expect(() => lireCerveau(new TextEncoder().encode("pas un cerveau").buffer)).toThrow(/pas un cerveau/);
  });
});
