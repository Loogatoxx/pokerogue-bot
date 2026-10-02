# Étape 12 — Le plafond de verre : où en est-on vraiment ? (02/10/2026)

Questions de Carlos : « Où sont passées les moyennes à 50 ? », « Demande des hypothèses à
d'autres IA : a-t-on atteint la vraie limite ? », « Regarde comment se débrouillent les joueurs
qui vont au bout avec des starters faibles ou au hasard ».

## La moyenne à 50 n'a pas disparu

Depuis l'étape 9, les mesures s'arrêtaient à la vague 50 (plus rapides) : une partie qui y arrive
compte 50, la moyenne ne peut pas dépasser 50. Sans limite (v5, 160 parties, starters au hasard,
style « Changer ») : **vague moyenne 49,1**, rival 1 95 %, rival 2 72 % (v4 dans les mêmes
conditions, avant : ~52,7 ; le bruit sur 160 parties est d'environ ±3). Défaites : rival 2
(23 %), Admin de la Team (66), boss 80, rival 3 (55), boss 60, rival 1, boss 50 et 30.

## L'avis de deux autres IA (Sonnet 5.5 et Haiku 4.5, lecture seule du projet)

Les deux concluent que ce n'est **pas** la vraie limite. Points vérifiés depuis :

- **Le planificateur décide presque tout.** Sur 6 385 décisions importantes, le cerveau ne
  choisit un coup que le plan juge nettement moins bon (écart > 0,1) que dans 5,5 % des cas
  (> 0,3 : 0,7 %). Le plafond est donc d'abord celui du planificateur.
- **Son modèle de nos propres attaques est faux** (vérifié dans `prevision.ts`, `degats`) :
  pas de précision (une attaque à 70 % compte comme sûre), pas de priorité (Vive-Attaque), pas de
  recharge ni d'auto-K.O. (Ultralaser, Explosion), et surtout pas les **barres des boss** : un coup
  ne peut en briser qu'une (`calculateBossSegmentDamage`), et chaque barre brisée renforce le boss.
  Le plan croit pouvoir mettre un boss K.O. en un coup. Les attaques de statut et de boost ne sont
  pas simulées non plus.
- **Le 110 du professeur n'est pas une cible de compétence** : rejouer 8 fois et garder le
  meilleur, c'est aussi garder la chance, que l'élève n'aura jamais (d'où l'échec de l'imitation).
- **Les mesures sont trop bruitées** pour voir des gains de +1 : il faut un banc apparié (mêmes
  photos de vagues difficiles, mêmes graines `hasardDuJeu`, pour toutes les variantes).
- À vérifier : l'expérience est partagée entre les participants d'un combat (changer dilue le
  porteur) ; la loterie des starters ; le bruit du juge (le meilleur de 3 moyennes bruitées).
- Haiku propose aussi de baisser le poids du plan et de tester de meilleurs starters.

## Ce que font les joueurs (défi « Fresh Start » = nos conditions)

Le défi officiel « Fresh Start » impose les trios de starters régionaux, IV 15, nature neutre,
sans attaques d'œuf ni talent caché ni passif — exactement le compte neuf du bot. Conseils relevés :
monter 1 ou 2 Pokémon jusqu'aux niveaux 30-40 (les charmes d'expérience rattrapent les autres),
économiser l'argent des vagues 50-150 pour les relances et objets X des vagues 180-200, choisir le
biome avec la carte, privilégier des Pokémon solides aux bons types, une attaque de boost sur le
porteur, un statut sur les boss (Éthernatos). Le bot, lui : 1,2 % d'attaques de statut, toujours
le 1er biome, ni relance ni objet X.

## Plan proposé

1. **Banc de mesure apparié** : photos des vagues qui font mur × graines fixes ; chaque variante
   jouée sur exactement les mêmes situations.
2. **Corriger le modèle de nos attaques** dans le planificateur : précision, priorité,
   recharge/auto-K.O., barres des boss.
3. **Boosts et statuts** dans le planificateur, surtout contre les boss.
4. Ensuite : les valeurs du plan en entrée du cerveau, pour qu'il apprenne quand le plan se trompe.
