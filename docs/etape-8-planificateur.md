# Étape 8 — Le planificateur, et ce que disent les joueurs (01/10/2026)

Demande de Carlos : continuer, vérifier que le bot a accès à toutes les possibilités et ne rate
rien, se renseigner (wikis, Reddit) sur les runs presque parfaites, et orienter le cerveau dans ce
sens. Plus un refus de l'extension (« cerveau entraîné avec une autre version »).

## Ce que disent les joueurs

- **Le porteur** : « 95 % d'une run Classique, c'est laisser un Pokémon fort tout écraser ; les
  choix servent les 5 % restants : rival, boss de la Team, Éternatus » (r/pokerogue). Les guides
  conseillent de concentrer l'expérience sur 1 ou 2 Pokémon jusqu'aux niveaux 30-40, les charmes
  d'expérience rattrapant les autres ([gameleap](https://www.gameleap.com/articles/pok-rogue-classic-game-mode-tips-and-tricks)).
- **L'argent** : le garder pour la fin (relances d'objets et objets X vers les vagues 180-200,
  Champignons Mémoire) ([wiki PokéRogue](https://wiki.pokerogue.net/gameplay:items)).
- **Les boss** : avantage de type, statuts (sommeil, paralysie, brûlure), boosts, et faire
  tourner ses Pokémon pour piéger l'attaque adverse — exactement l'idée de prédiction de Carlos.
- Vérifié dans le code du jeu : changer de biome (après chaque vague multiple de 10) **soigne
  toute l'équipe** ; le rival donne Charme Exp + Multi Exp (vague 8), Multi Exp (25), Orbe Téra (95).

## Audit : ce que le bot ratait

1. Combat : il voyait la prévision mais ne s'en servait pas (jamais de changement de Pokémon).
   → **planificateur** (ci-dessous).
2. « Changer de Pokémon ? » après un K.O. adverse : toujours non. (À brancher sur le
   planificateur.)
3. Super Bonbons au membre en retard, à l'inverse de la stratégie du porteur. → **corrigé** : au
   porteur jusqu'au niveau 40.
4. Total Soin jamais acheté. → **corrigé** (achetable, au membre le plus important).
5. Rencontres mystères : désactivées à l'entraînement, choisies à l'aveugle dans le vrai jeu.
   (À traiter.)
6. Plus tard : relances avec l'argent, Téra (après la vague 95), choix du biome (toujours le 1er).

## Le planificateur (`observateur/planificateur.ts`)

Comme un moteur d'échecs à courte vue : pour chaque action, il joue la suite avec le coup prévu
de l'IA adverse (étape 7) et la formule des dégâts — achever ce tour-ci, « course au K.O. » (qui
met l'autre K.O. en premier), changer pour un Pokémon qui encaisse le coup prévu (l'IA a choisi
contre celui qui part), choisir le meilleur remplaçant après un K.O. Les Poké Balls restent au
cerveau. Le cerveau est **guidé** : ses scores + poids × valeurs du plan (`poidsPlan` dans le
fichier du cerveau, lu par l'extension, le réseau Python et l'entraînement).

v3, 160 parties, starters au hasard :

| Poids du plan | Vague moyenne (arrêt à 50) | Rival 2 | Sans limite |
|---|---|---|---|
| 0 (cerveau seul) | 27,9 | 52 % | |
| 3 | 30,2 | 61 % | |
| 8 | 33,3 | 66 % | |
| **30** | **36,2** | **77 %** | **52,7** |
| 100 | | 74 % | 50,7 |

**v4** = v3 (encodage v5) guidée × 30 : **53,33** à l'évaluation officielle (v3 : 27,17), record
**115**. Nouveaux murs : rival 2 (vague 25, ~25 % des défaites), Admin de la Team (66), boss 80 et
90, rival 3 (55), rival 4 (95).

## L'extension qui refusait le cerveau

L'extension 0.8.0 accepte bien la v3 (vérifié dans l'aperçu) : Brave faisait tourner une version
plus ancienne. Corrections : le panneau affiche sa version et le message de refus dit quoi faire
(recharger dans brave://extensions). Et un vrai piège trouvé en route : republier un ancien
cerveau écrivait dans son en-tête l'encodage du code actuel ; l'évaluation garde maintenant les
versions du cerveau d'origine.

## Entraînement 9

Départ v4, le cerveau apprend **par-dessus** le planificateur (même poids 30), exercices sur les
nouveaux murs (20, 25, 30, 40, 50, 55, 66, 80, 90, 95), `vague_max` 120.

## Suite : retours de Carlos en jouant la v4 dans Brave (01/10)

- **« L'IA essaie toujours de capturer ; si le Pokémon résiste, il ne rentre pas et finit par
  mettre K.O. nos Pokémon. »** Les Balls étaient neutres pour le planificateur. Désormais (option
  `capture`, active dans l'extension) : chance de capture par la formule du jeu
  (`observateur/capture.ts` : taux de l'espèce, PV, statut, Ball ; il faut 3 secousses) ; une
  capture vaut un K.O. plus un membre (tant que l'équipe n'est pas pleine, ensuite selon le
  potentiel de l'espèce) ; un échec vaut le coup qu'on encaisse. Un Pokémon à taux 45 en pleine
  forme n'a que ~20 % de chances par Poké Ball : on l'affaiblit d'abord.
- **« Le mode auto s'est arrêté » sur une rencontre mystère** (« Promos au Centre Commercial »,
  vague 18). Elles sont coupées par l'outil de test, donc jamais vues à l'entraînement. Le pilote
  sait maintenant : choisir la première option possible (après l'animation), choisir un Pokémon
  quand une rencontre le demande, passer les éclosions d'œufs et fermer leur résumé, revenir au
  menu de combat si le menu des attaques reste ouvert. Option `mysteres` du simulateur (« jeu »
  ou un pourcentage) : 12 parties avec une rencontre à chaque vague, puis 18 au rythme du jeu,
  aucun blocage. Extension 0.9.1.
