# Étape 4a — La capture (30/09/2026)

## Pourquoi la capture d'abord

La v1 plafonnait à la vague 8,4 : **45 % de ses défaites face au rival de la vague 8**, avec une
équipe restée à 3 starters (voir [étape 3](etape-3-entrainement.md)). Passer de 3 à 6 Pokémon est
le levier le plus direct.

## Ce qui a changé

| Pièce | Changement |
|---|---|
| Actions (`observateur/actions.ts`) | 14 → **19** : + Poké, Super, Hyper, Rogue, Master Ball (actions 14 à 18) |
| Masque | Balls permises selon les règles du jeu : combat sauvage, un seul ennemi actif, Ball en stock, boss seulement sur sa dernière barre (sauf Master Ball) |
| Observation v3 | « déjà capturé » pour chaque adversaire (l'icône que le jeu affiche) |
| Encodage v2 | + 9 nombres **à la fin** : Balls en stock (5), taille de l'équipe, équipe pleine, déjà capturés (2) → 1 299 |
| Pilote | exécute le lancer ; équipe pleine → le nouveau n'est pas gardé (règle provisoire, team build à l'étape 5) |
| Récompense | `capture = 0.5` par Pokémon capturé et gardé (dans `reglages.toml`) |
| Tableau de bord | captures par partie, **défaites par vague** avec les combats fixes annotés (Gamin, rival…) |
| Extension 0.3.0 | libellés « Lancer une Super Ball… », icône ◓ « déjà capturé » |

Le rival, le Gamin et les autres combats fixes du mode Classique viennent de
`jeu/src/enums/fixed-boss-waves.ts` : rival aux vagues 8, 25, 55, 95, 145 et 195.

## La greffe : grandir sans oublier

Plutôt que de repartir de zéro, la v1 a été **greffée** (`entraineur/greffe.py`) :
- les 9 nouvelles entrées reçoivent des poids nuls (au départ, elle les ignore) ;
- les 5 nouvelles actions reçoivent des poids nuls et un biais moyen (elle va les essayer).

`entraineur/test_greffe.py` vérifie qu'avec les Balls masquées, le cerveau greffé donne
**exactement** les mêmes probabilités et la même valeur qu'avant. Résultat : l'entraînement 2 a
démarré directement à la vague 8,35 (le niveau de la v1), au lieu de 4,6.

Conséquence : les anciens cerveaux (v0, v1) ne sont plus lisibles par l'extension 0.3.0
(observation v3, encodage v2) ; le panneau l'indique. Il faut importer un cerveau de l'étape 4.

## Vérifications

- Simulateur : masque des Balls (sauvage, dresseur, combat double), lancer exécuté jusqu'à la
  phase de capture.
- 32 parties au hasard avec les Balls : 1 à 3 captures par partie, 11 fois « équipe pleine »
  sans blocage, 0 erreur ; le hasard pur passe de la vague 4,8 à 5,7 rien qu'en capturant.
