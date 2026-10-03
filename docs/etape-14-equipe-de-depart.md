# Étape 14 — Le constructeur d'équipe de départ (03/10/2026)

Demande de Carlos : « que l'IA construise elle-même l'équipe de starters, avec une plus grosse base
de starters, pour conseiller celle qui a le plus de chances de gagner, en se basant sur les
attaques, IV, passif, talent, nature, statistiques de base et les tableaux ».

## Ce qu'on savait déjà (étape 13)

Au rival 1, le rival tire son starter parmi Plante, Feu et Eau. Un trio qui bat ces trois types
(un starter Plante, un Feu, un Eau) passe le rival 1 dans 99-100 % des parties, contre 96-97 % avec
trois starters au hasard.

## 1. La force de chaque espèce, mesurée (`entraineur/liste_puissance.py`)

Les 572 espèces qui peuvent être starters (liste et coûts tirés du jeu :
`entraineur/donnees_starters.json`) jouent chacune des parties comme porteur (1er de l'équipe),
avec deux starters régionaux tirés au hasard, jusqu'à la vague 60 (IV 15, nature neutre : un compte
neuf). `entraineur/resumer_puissance.py` en tire la force de chaque espèce (vague moyenne, tirée vers
la moyenne quand elle a peu de parties) dans `observateur/puissance-starters.ts`.

## 2. Le constructeur (`observateur/constructeur-equipe.ts`)

La note d'un starter : sa force mesurée (l'essentiel), ses IV au-dessus de 15 (meilleure stat
d'attaque, Vitesse, PV), une nature débloquée qui sert sa meilleure stat d'attaque, son passif, son
talent caché, ses attaques d'œuf débloquées et la chance (chromatiques). Le trio : le porteur compte
le plus, puis le 2e, puis le 3e, avec un bonus par type de starter du rival couvert ; budget de
10 points comme le jeu. Le porteur est mis en tête.

## 3. Dans l'extension

À l'écran de choix des starters, le capteur lit les starters attrapés du compte (espèce, coût réel,
IV, natures, passif, talent caché, attaques d'œuf, variantes chromatiques) et le panneau affiche les
trois meilleures équipes avec leurs raisons (`extension/src/starters-compte.ts`).
