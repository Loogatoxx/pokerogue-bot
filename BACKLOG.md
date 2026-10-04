# BACKLOG.md — idées hors phase (aucun code tant qu'elles ne sont pas programmées)

Chaque idée a sa phase probable et sa source.

| # | Idée | Phase probable | D'où vient-elle |
|---|---|---|---|
| 1 | ~~Épingler la copie du jeu sur le tag `v1.12.0.11` dans le README~~ **fait en Phase 1** | 1 | Phase 0 : `main` = `v1.12.0.11` aujourd'hui, mais le site se met à jour souvent |
| 2 | Pouvoir mesurer depuis une session cloud. Fait en Phase 1 : jeu, Node 24 et banc installables. Reste : le cerveau v5 (pas dans git, ~3 Mo, pas un secret) et PyTorch (le serveur de PyTorch est bloqué, la version PyPI pèse ~3 Go) | 1 → après la décision « plan seul » | Phase 0 et Phase 1 |
| 3 | Boss sauvages (vagues X0 hors champion, légendaires) : le planificateur ignore les segments et les boosts de segment ; seul le moteur d'équipe (contre dresseur) connaît les segments | 5 | REGLES R3 ; `observateur/planificateur.ts`, `observateur/combat-equipe.ts` |
| 4 | Relances de récompenses : jamais utilisées. Les joueurs les gardent pour la fin de partie | 4 (M3) | REGLES R7 ; `docs/etape-12-plafond.md` |
| 5 | Transferts d'objets tenus (gratuits) : jamais utilisés, par exemple pour rendre un objet au porteur ranimé ou à un nouveau porteur | 4 | REGLES R7 |
| 6 | Choix du biome avec la Carte : aujourd'hui toujours la 1re option (`pilote/pilote.ts`, menus à options) | 4 | REGLES R1 |
| 7 | Les boosts persistent entre sauvages du même biome jusqu'au boss X0 (REGLES R9) : un boost pris tôt dans la dizaine pourrait servir au boss | 6 | REGLES R9 |
| 8 | Savoir quelles vagues X0 sont des champions (`offsetGym`, déductible au 1er champion vu) au lieu de « champion ou boss » | 2 | REGLES R2 ; `observateur/combats.ts` |
| 9 | Moteur de combat d'équipe limité au combat simple contre un dresseur ; les doubles restent au planificateur | 6 | `observateur/combat-equipe.ts` |
| 10 | Jeu de graines de contrôle (hold-out), pour qu'une recherche de poids ne s'ajuste pas aux 480 graines du banc | 7 | Phase 0 (risque de surapprentissage) |
| 11 | Mesurer à part le cas « compte de Carlos » (légendaires, IV élevés), différent du compte neuf | après 6 | `docs/etape-15-banc-apparie.md` §6 |
| 12 | ✅ **Corrigé (+9,31 vagues, `207008a`)** — **Rencontres mystères : le pilote prend toujours la 1re option possible** (`pilote/pilote.ts`, `choisirRencontreMystere`), souvent « combattre le boss ». 3 morts sur 6 dans une rencontre mystère contre un boss lors du test de la Phase 1. Ça tourne aussi en mode Auto sur le vrai site | **3 (prioritaire)** | Phase 1, test des 6 parties |
| 13 | `diagnostic_vague.py --banc` rejoue les défaites sans rencontres mystères : l'aligner sur le protocole avant de s'en servir | 3 | Phase 1 (le protocole inclut maintenant les rencontres mystères) |
| 14 | Argent qui dort : partie k=3, mort contre le champion de la vague 20 avec 3 176 ₽ non dépensés. Le banc mesure maintenant l'argent à la mort | 4 (M3) | Phase 1 |
| 15 | ✅ **Corrigé (`1e002ac`)** : cause = équipe pleine quand une rencontre donne un Pokémon — **Boucle du pilote dans une rencontre mystère** (écran de résumé, « garde ses attaques » ↔ « suite ») : 15 parties sur 478 arrêtées en erreur, et k=37 y tombe aussi quand on la rejoue. Elle bloquerait aussi le mode Auto sur le site | **3 (prioritaire)** | Phase 1, banc cloud plan seul |
| 16 | **Correctif proposé (04/10), à mesurer sur le Mac** : prix d'un changement dans le moteur d'équipe, pas de changement vers un duel perdu dans le planificateur (`tests/changements.test.ts`). **Boucles de changements (H4 confirmée en plan seul)** : 34 % des parties ont au moins 3 changements volontaires d'affilée ; séries de 58, 57 et 29 changements, contre des dresseurs (Nageur, rival 4, rival 2), qui finissent en défaite. Plafond de changements consécutifs à prévoir | 3 | Phase 1, banc cloud plan seul |
| 17 | Tiers de force des starters peu parlants avec un trio Plante/Feu/Eau (total des stats entre 934 et 940) : trouver une meilleure mesure de force (par exemple la note du constructeur d'équipe) | 2 | Phase 1 |
| 18 | **Même correctif que le n° 16.** Remarque de Carlos (04/10) : au début de chaque rencontre, on peut choisir quel Pokémon commence (changement gratuit). Pourtant, le bot change parfois de Pokémon **au moment de choisir son attaque** : il perd un tour et encaisse un coup. Préférer le changement gratuit du début de vague au changement payant en combat. Lié au n° 16 | 3 | Carlos, partie dans le vrai jeu |
| 19 | Cerveau v5 ou plan seul ? À écart égal (−0,96 ± 1,35), le v5 change 2 fois moins souvent de Pokémon et passe le rival 4 à 89 % au lieu de 59 %. Le site joue avec le v5. Proposition : copier le cerveau v5 dans le dépôt (~3 Mo, pas un secret), pour que le cloud puisse lancer les bancs officiels avec lui | décision de Carlos | Phase 1, bancs officiels |

