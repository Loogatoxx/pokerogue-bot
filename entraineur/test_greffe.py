"""La greffe ne doit rien faire oublier : sur les anciennes entrées, avec les nouvelles actions
masquées, le cerveau greffé répond exactement comme l'ancien.

Usage : .venv/bin/python -m entraineur.test_greffe
"""
import torch

from .greffe import greffer
from .reseau import Cerveau


def main() -> None:
    torch.manual_seed(0)
    ancien = Cerveau(40, 14, (32, 16))
    nouveau = greffer(ancien, 49, 19)
    for _ in range(20):
        entree = torch.rand(40)
        masque = torch.rand(14) > 0.3
        masque[0] = True
        entree_greffee = torch.cat([entree, torch.rand(9) * 0])  # nouvelles entrées : n'importe quoi… à 0
        masque_greffe = torch.cat([masque, torch.zeros(5, dtype=torch.bool)])
        with torch.no_grad():
            p_ancien = torch.softmax(ancien(entree[None], masque[None])[0][0], -1)
            p_nouveau = torch.softmax(nouveau(entree_greffee[None], masque_greffe[None])[0][0], -1)
            v_ancien, v_nouveau = ancien(entree[None])[1], nouveau(entree_greffee[None])[1]
        assert torch.allclose(p_ancien, p_nouveau[:14], atol=1e-6), "la greffe a changé les probabilités"
        assert torch.allclose(v_ancien, v_nouveau, atol=1e-6), "la greffe a changé la valeur"
        # Les nouvelles entrées ne changent rien au départ (poids nuls), quelle que soit leur valeur.
        entree_bruit = torch.cat([entree, torch.rand(9)])
        with torch.no_grad():
            p_bruit = torch.softmax(nouveau(entree_bruit[None], masque_greffe[None])[0][0], -1)
        assert torch.allclose(p_bruit, p_nouveau, atol=1e-6), "les nouvelles entrées pèsent déjà"
    print("Greffe : OK (mêmes probabilités et même valeur qu'avant, nouvelles entrées ignorées au départ)")


if __name__ == "__main__":
    main()
