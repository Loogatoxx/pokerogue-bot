"""Le réseau du cerveau : un tronc commun et une « tête » par type de sortie.

- tronc     : comprend la situation (observation encodée → représentation interne) ;
- politique : un score par action (14 actions, voir observateur/actions.ts) ;
- valeur    : estime si la situation est favorable (sert à l'apprentissage par renforcement).

Les actions interdites par le jeu sont « masquées » : leur score passe à -infini, donc leur
probabilité à 0. Le cerveau ne peut ainsi jamais proposer un coup impossible.
"""
from __future__ import annotations

import torch
from torch import nn


class Cerveau(nn.Module):
    def __init__(self, taille_entree: int, nombre_actions: int, tailles_tronc: tuple[int, ...] = (512, 256)):
        super().__init__()
        self.taille_entree = taille_entree
        self.nombre_actions = nombre_actions
        couches: list[nn.Module] = []
        entree = taille_entree
        for taille in tailles_tronc:
            couches += [nn.Linear(entree, taille), nn.ReLU()]
            entree = taille
        self.tronc = nn.Sequential(*couches)
        self.politique = nn.Linear(entree, nombre_actions)
        self.valeur = nn.Linear(entree, 1)

    def forward(self, observation: torch.Tensor, masque: torch.Tensor | None = None) -> tuple[torch.Tensor, torch.Tensor]:
        # Un cerveau plus ancien que l'encodage lit le début de l'observation : les nouveaux nombres
        # sont toujours ajoutés à la fin (observateur/encodeur.ts), le début garde son sens.
        commun = self.tronc(observation[..., : self.taille_entree])
        scores = self.politique(commun)
        if masque is not None:
            # Un très grand nombre négatif plutôt que -infini : même probabilité nulle, mais
            # l'entropie (0 × log 0) reste calculable pendant l'apprentissage.
            scores = scores.masked_fill(~masque, -1e8)
        return scores, self.valeur(commun).squeeze(-1)

    @torch.no_grad()
    def choisir(self, observation: torch.Tensor, masque: torch.Tensor, tirage: bool = True) -> tuple[int, torch.Tensor]:
        """Choisit une action : au hasard selon les probabilités (tirage) ou la plus probable."""
        scores, _ = self(observation.unsqueeze(0), masque.unsqueeze(0))
        probabilites = torch.softmax(scores[0], dim=-1)
        action = torch.multinomial(probabilites, 1).item() if tirage else int(probabilites.argmax())
        return int(action), probabilites
