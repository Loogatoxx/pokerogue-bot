"""Fabrique la fixture du test d'équivalence PyTorch ↔ TypeScript (tests/cerveau.test.ts).

Un petit cerveau aléatoire (même structure que le vrai, en plus petit) et ses réponses à des
entrées aléatoires, calculées par PyTorch. Le test TypeScript doit retrouver les mêmes nombres.
Usage : .venv/bin/python -m entraineur.fixture_equivalence
"""
import json
from pathlib import Path

import torch

from .format_cerveau import ecrire, lire
from .reseau import Cerveau

DOSSIER = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def main() -> None:
    torch.manual_seed(1234)
    cerveau = Cerveau(taille_entree=40, nombre_actions=14, tailles_tronc=(32, 16))
    chemin = ecrire(DOSSIER / "mini.cerveau", cerveau, nom="mini", description="Fixture de test",
                    versions={"versionObservation": 0, "versionEncodage": 0})

    relu, _ = lire(chemin)  # on vérifie aussi l'aller-retour écriture → lecture en Python
    cas = []
    torch.set_grad_enabled(False)
    for i in range(8):
        entree = torch.rand(40) * 2 - 1
        masque = torch.rand(14) > 0.3
        masque[i % 14] = True
        scores, valeur = cerveau(entree.unsqueeze(0), masque.unsqueeze(0))
        scores_relus, _ = relu(entree.unsqueeze(0), masque.unsqueeze(0))
        assert torch.allclose(scores, scores_relus), "l'aller-retour Python a changé les poids"
        cas.append({
            "entree": entree.tolist(), "masque": masque.tolist(),
            "probabilites": torch.softmax(scores[0], dim=-1).tolist(), "valeur": float(valeur[0]),
        })
    (DOSSIER / "mini-attendu.json").write_text(json.dumps(cas))
    print(f"Fixture écrite : {chemin} ({chemin.stat().st_size} octets), {len(cas)} cas")


if __name__ == "__main__":
    main()
