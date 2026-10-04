# Étape 16 — Les objets et l'argent, d'après une partie de Carlos (04/10/2026)

Carlos a regardé jouer la v5 dans le vrai jeu. Il juge que le bot se débrouille bien en combat
contre les dresseurs, mais reste fragile sur les objets, la composition de l'équipe et surtout
l'argent : sa partie s'est finie faute d'argent pour ranimer ses Pokémon contre un dresseur.

Ces décisions ne sont pas apprises par le cerveau : ce sont des règles écrites
(`observateur/objets.ts`, le pilote). Les erreurs vues sont donc des erreurs de ces règles, et se
corrigent directement.

## Deux règles du jeu qui changent tout

- **Une Pépite rapporte l'argent d'une vague**, qui est exactement le prix de base de la boutique :
  5 Potions, ou un demi-Rappel. Grosse Pépite : × 2,5 ; Relique d'Or : × 10.
- **À chaque nouveau biome (vagues 11, 21, 31…), le jeu soigne et ranime toute l'équipe.** Il n'y
  a pas de boutique aux vagues 10, 20, 30…

## Ce qui a changé (`objets.ts`, `planificateur.ts`)

| Remarque de Carlos | Correction |
|---|---|
| « il prend la Potion gratuite alors qu'avec la Pépite et la Potion payée, il y gagne » | l'argent a une valeur ; un soin gratuit que la boutique vend ne vaut pas plus que son prix |
| « il achète quand ce n'est pas nécessaire, sur des Pokémon plus faibles ; il devrait économiser pour les moments difficiles » | hors des combats importants, la boutique ne soigne que le porteur (ou un membre de son niveau) mal en point ; réserve de deux Rappels dès la vague 10 |
| « il a laissé passer deux Bonbonnières vers la vague 20 » | Bonbonnière à 30 points en début de partie (chaque Super Bonbon donne un niveau de plus) |
| « il esquivait les Charmes Exp et les Multi Exp » | plus de rendement décroissant ; Multi Exp selon le retard du banc |
| « il prend parfois des Leurres, les combats doubles sont mauvais » | Leurres à 0 (mesuré la veille : −17 vagues quand il les prend) |
| « il a préféré une CT au Bracelet Dynamax » | Méga-Gourmette et Bracelet Dynamax à 45 si un membre a la forme Méga ou Gigamax, 6 sinon |
| « il lance une Poké Ball sur un Pokémon en pleine forme qu'il pouvait mettre K.O. » | équipe pleine : pas de Ball sous 30 % de chance (sauf espèce d'exception) |
| « des CT font oublier des attaques plus utiles » ; « il se mélange parfois sur les attaques » | Explosion, Destruction (le lanceur tombe K.O.), Ultralaser (recharge), Lance-Soleil, Piqué (charge), Mitra-Poing, Dévorêve : puissance corrigée partout (choix des CT, moteur de combat, planificateur) — table générée du jeu, `observateur/contraintes-attaques.ts` |

## Mesures (banc apparié, 480 parties sans limite, trio Plante/Feu/Eau)

| Version | Vague moyenne | Rival 2 | Rival 3 | Rival 4 |
|---|---|---|---|---|
| Avant (03/10) | 55,7 | 78 % | 91 % | 61 % |
| Objets et argent | 58,0 (**+2,29 ± 1,37**) | 79 % | 90 % | 65 % |
| + attaques trompeuses | **58,6** (+0,65 ± 0,82) | 79 % | 87 % | 72 % |

C'est le plus grand gain des deux derniers jours : les remarques d'un joueur valent plus que dix
essais d'optimisation.

## Panneau de l'extension (0.10.1)

Demande de Carlos : ne jamais afficher 100 % quand une autre action est possible. Le panneau
montre maintenant toujours une alternative ; quand le cerveau conseille une Ball, l'alternative est
« sans capturer : <la meilleure attaque> », ce qu'il ferait contre un dresseur.
