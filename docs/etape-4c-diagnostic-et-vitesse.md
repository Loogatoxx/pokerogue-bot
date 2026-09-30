# Étape 4c — Le cerveau « qui fuit le combat », et un entraînement plus rapide (30/09/2026)

## Ce que Carlos a vu

Avec la v2 dans Brave, sur pokerogue.net et avec des starters choisis à la main, le cerveau
« faisait tout pour éviter le combat » : il changeait de Pokémon à chaque tour, puis, avec le
dernier debout, choisissait une attaque sans dégâts. Il n'a pas passé la vague 2.

## Enquête

Trois hypothèses, vérifiées une à une.

**1. Le cerveau n'a appris que pour Bulbizarre, Salamèche et Carapuce ?** Non.
`entraineur/diagnostic_starters.py` fait jouer un cerveau (meilleur coup, comme le mode auto)
avec d'autres trios, et compte ce qu'il fait quand il a le choix entre attaquer et changer :

| v2, 16 parties par trio | vague moy. | changements |
|---|---|---|
| Kanto (celui de l'entraînement) | 19,8 | 1 % |
| Johto | 28,3 | 1 % |
| Hoenn | 24,2 | 1 % |
| Sinnoh | 28,1 | 1 % |
| Galar | 32,6 | 1 % |
| Tiplouf seul | 17,0 | 3 % |

L'observation ne contient pas le numéro de l'espèce, seulement ce qu'un joueur voit (types,
statistiques, attaques) : le cerveau transpose.

**2. Le jeu en ligne n'est pas le même que notre copie ?** Non : le code de combat de
pokerogue.net (`handleFightCommand`, numéros des écrans et des options d'équipe) est identique à
celui de la copie locale 1.12.0.11.

**3. L'extension actuelle se trompe dans le vrai jeu ?** Non. La vraie extension 0.5.0 injectée
dans la copie locale du jeu, v2, mode auto, vitesse normale, Kaiminus + Héricendre + Carapuce :
vague 15 en 9 minutes, 90 actions, **aucun refus**, les changements n'arrivant qu'après un K.O.
(vagues 8 et 13). Même en figeant le jeu 12 secondes pendant une décision (ce que fait Brave
avec un onglet caché), l'action est acceptée du premier coup.

**Conclusion** : le problème ne se reproduit ni au simulateur ni dans le vrai jeu avec la version
actuelle. Explication la plus probable : Brave faisait tourner une version antérieure de
l'extension, celle d'avant l'étape 4b (pilote de l'écran d'équipe qui appuyait « à l'aveugle »,
refus silencieux mal gérés). Une extension non empaquetée ne se met pas à jour seule : il faut la
recharger dans brave://extensions (bouton ↻) après chaque `pnpm extension`.

## Entraînement 3 : pas de v3

60 minutes depuis la v2 : 24,66 de moyenne (Kanto, 64 parties, record 80) contre 22,44 pour la
v2, mais 22,1 contre 25,0 avec les autres starters. Écarts dans le bruit : pas de progrès net,
donc pas de v3.

## Pourquoi l'entraînement était lent

Pendant l'entraînement 3, la vitesse est tombée de 141 à 10–60 décisions par seconde. Deux causes.

**La collecte « au pas ».** À chaque décision, les 8 copies attendaient la plus lente. Un
redémarrage ou un long écran d'une seule copie immobilisait les 7 autres. Désormais
(`Entrainement.collecter`) chaque copie joue dans son propre fil, à son rythme, jusqu'à un quota
global de décisions ; le bilan (GAE) est calculé copie par copie. Vérifié avec un faux jeu : même
résultat que l'ancien calcul (écart 5 × 10⁻⁷), et une copie 50 fois plus lente joue simplement
moins de décisions.

**Chaque copie ralentissait au fil des parties** : 7 fois plus lente au bout de 40 parties, avec
une mémoire qui passait de 240 Mo à 1,3 Go. Coupables trouvés dans l'outil de test du jeu, en
ajoutant des compteurs au diagnostic de fin de partie :
- **la fuite principale** : chaque sprite créé s'inscrit auprès du gestionnaire d'animations
  global (événement « remove ») et ne s'en désinscrit qu'à sa destruction, que le jeu n'appelle pas
  toujours. +500 écouteurs par courte partie, jamais retirés : les sprites de toutes les parties
  restaient en mémoire, et chaque retrait d'animation parcourait cette liste sans fin. Sans écran
  cet écouteur ne sert à rien : on les retire tous en fin de partie ;
- le gestionnaire de textures simulé range chaque objet graphique créé (jusqu'à 32 000 par
  partie) dans une liste jamais vidée ni lue ;
- le jeu écrit une ligne de console à chaque phase, message et attaque, que vitest garde en
  mémoire tant que le test (une simulation sans fin) n'est pas terminé ; plus les journaux
  internes de l'outil (phases, textes, touches).

`simulateur/environnement.test.ts` vide tout cela à chaque fin de partie et coupe
`console.log/info/debug` (les avertissements et erreurs restent).

Bancs de 4 minutes, 8 copies, depuis le même cerveau :

| Version | Décisions/s en moyenne |
|---|---|
| entrainement-3 (collecte au pas, sur 60 min) | 30 |
| collecte asynchrone | 86 |
| + liste d'objets graphiques vidée | 104 |
| + console coupée et journaux vidés | 83 (bruit : pas d'effet mesurable) |
| + écouteurs d'animation retirés | **189** (420–440 au début) |

Il reste une petite fuite (la vitesse d'une copie baisse encore de moitié en ~45 parties) : le
redémarrage passe de 50 à 25 parties (`PONT_REDEMARRAGE`), ce qui ne gêne plus les autres copies.

## Réglage de l'exploration

Avec les starters au hasard, l'entropie (le degré de hasard des choix) montait de 0,55 à 0,84 en
4 minutes, et la vague moyenne baissait : le bonus d'exploration l'emportait sur ce que le
cerveau apprenait. `coef_entropie` passe de 0,02 à 0,015 (0,01 l'avait figé vers 0,3 dans
entrainement-1).

## Starters au hasard

`reglages.toml` → `[partie] starters = "hasard"` : trois des 27 starters d'un compte neuf à chaque
partie, comme un humain qui choisit les siens (`"kanto"` pour revenir à l'ancien comportement).
Chaque partie du journal note ses starters.
