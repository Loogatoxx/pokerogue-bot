# Étape 6 — Dépasser le plafond : l'entraînement ciblé (01/10/2026)

Constat de l'étape 5 : l'apprentissage plafonne vers la vague 27, et 55 % des défaites ont lieu
contre le rival (vagues 8 et 25). Or une partie normale ne rencontre le 2ᵉ rival qu'une fois sur
deux, après une vingtaine de minutes de jeu simulé : le cerveau s'y exerce trop rarement pour
apprendre. Accord de Carlos : « on peut essayer de dépasser le plafond ».

## Le principe : rejouer les combats qui bloquent

Comme un joueur qui recharge sa sauvegarde avant le champion pour retenter le combat :

1. **Photos** : le jeu sauvegarde la partie au début de chaque vague, juste avant la rencontre
   (`EncounterPhase` → `gameData.saveAll`) ; l'outil de test garde cette sauvegarde
   (`ReloadHelper`). Le simulateur renvoie, sur demande, celle des vagues 8, 20, 25, 30, 40, 50
   et 55 (`photoDeLaVague`, ~9 Ko chacune) : équipe, objets, argent, Balls, arène, adversaire.
2. **Reprise** : une partie peut repartir d'une photo, exactement comme « Continuer » à l'écran
   titre (`TitlePhase.loadSaveSlot` → `gameData.loadSession`, `reprendrePartie`). Une graine
   neuve fait varier la suite ; le combat photographié, lui, garde son adversaire.
3. **Réserve** (`entraineur/ensemble.py`) : 200 photos par combat, renouvelées au hasard, prises
   dans les parties de l'entraînement lui-même : ce sont les vraies équipes du cerveau.
4. **Une partie sur deux** repart d'une photo (`entrainement_cible = 0.5` dans `reglages.toml`).
   Le combat est tiré d'autant plus souvent qu'il est raté à l'exercice (100 derniers essais) :
   on travaille d'abord ce qui coince.

La vague moyenne du journal reste calculée sur les seules vraies parties (vague 1), pour rester
comparable aux entraînements précédents ; la réussite des exercices est suivie à part, par combat.
Le tableau de bord écarte les exercices de ses défaites par vague.

Essai de 4 minutes : réserve pleine pour chaque combat, 78 % d'exercices réussis, aucune erreur
nouvelle.

## État à la pause (01/10)

Entraînement 7 (départ v3, ciblé) arrêté à la demande de Carlos après ~15 minutes, à la mise à
jour 42 (cerveau sauvegardé). Premières mesures : vague moyenne des vraies parties 28-30,
exercices réussis 70-74 % (vague 8 : ~86 %, vague 20 : ~86 %, vague 25 : ~52 %).

Pour reprendre :
`.venv/bin/python -m entraineur.entrainer --reprendre /Volumes/Lexar/pokerogue-bot/entrainements/entrainement-7 --minutes 120 --simulateurs 10`
(la réserve de photos se reconstitue en quelques minutes), puis évaluer avec
`entraineur.analyse_defaites` et comparer à la v3 (27,3 avec starters au hasard).
