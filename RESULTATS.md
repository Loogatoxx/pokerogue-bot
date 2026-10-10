# RESULTATS.md — métriques par phase

## Protocole de mesure (figé le 04/10/2026, Phase 1)

On ne le change plus sans prévenir Carlos.

**Le banc** : `entraineur/banc_complet.py`, 480 parties sans limite de vague.
- Partie k : graine `complet-k`, un trio Plante/Feu/Eau tiré avec k (`trio_de`), hasard du jeu fixé.
- Style de combat « Changer ».
- **Rencontres mystères au rythme du vrai jeu** (`--mysteres jeu`, réglage par défaut). L'ancien banc n'en avait aucune.
- Les mêmes 480 parties pour chaque version : une différence ne vient que des décisions changées.

**Ce qu'on mesure pour chaque version** (`resume` dans `entraineur/statistiques_banc.py`) :
- parties valides et parties en erreur (enregistrées et exclues ; avant, elles disparaissaient sans trace) ;
- moyenne, médiane, écart-type, erreur-type, p10, p90 ;
- passage des rivaux ;
- morts par type de vague : sauvage, boss sauvage, champion d'arène, rival, team, conseil 4, maître, boss final, dresseur, rencontre mystère ;
- argent et objets à la mort ;
- changements volontaires consécutifs (hypothèse H4) ;
- vague moyenne par tiers de force des starters (total des stats de base) ;
- histogramme des vagues de mort.

**La décision** (`--comparer ESSAI REFERENCE`) :
- différence partie par partie sur les parties valides des deux côtés ;
- erreur-type appariée = écart-type des différences ÷ √n ;
- **garder** seulement si le gain dépasse 2 erreurs-types. Sinon, retour en arrière.

**Une seule machine pour les bancs officiels** : le Mac de Carlos. Le cerveau v5 et PyTorch y sont. Les bancs lancés dans le cloud servent à tester, pas à décider.

**Commandes** (sur le Mac, à la racine du projet, quand aucun entraînement ne tourne) :

```bash
.venv/bin/python -m entraineur.test_statistiques_banc
.venv/bin/python -m entraineur.banc_complet --nom p1-reference
.venv/bin/python -m entraineur.banc_complet --nom p1-plan-seul --plan-seul
.venv/bin/python -m entraineur.banc_complet --comparer p1-plan-seul p1-reference
.venv/bin/python -m entraineur.banc_complet --nom p1-reference-sans-mysteres --mysteres aucune
.venv/bin/python -m entraineur.banc_complet --comparer p1-reference p1-reference-sans-mysteres
```

Le 3e banc est facultatif. Il relie la nouvelle référence à l'ancienne (58,6, sans rencontres mystères) et chiffre ce que les rencontres mystères coûtent avec le cerveau v5.

Si des parties manquent (copie du jeu redémarrée en cours de route), relancer la même commande : elle complète les parties manquantes sans refaire les autres.

## Avant le protocole (mesures déjà faites, d'après `docs/`)

Ces chiffres servent de contexte. Ce ne sont **pas** des références officielles : ils ont été mesurés sans rencontres mystères.

Banc apparié, `entraineur/banc_complet.py` :
- 480 parties sans limite de vague ;
- graine `complet-k` ;
- un trio Plante/Feu/Eau tiré avec k ;
- hasard du jeu fixé ;
- cerveau v5 + planificateur.

| Version (commit) | Vague moyenne | Écart apparié | Rival 2 | Rival 3 | Rival 4 | Source |
|---|---|---|---|---|---|---|
| Référence du 03/10 | 55,7 | — | 78 % | 91 % | 61 % | `docs/etape-16-retours-objets.md` |
| Objets et argent (`a2db880`) | 58,0 | +2,29 ± 1,37 | 79 % | 90 % | 65 % | idem |
| + attaques trompeuses (`2e5e2a1`) | **58,6** | +0,65 ± 0,82 | 79 % | 87 % | 72 % | idem |

**Bruit d'une mesure non appariée** : deux mesures du même code ont donné 57,7 et 56,9 (`docs/etape-15-banc-apparie.md`).

**Valeur de 57 citée au lancement de la Phase 0** : son origine est à préciser. La dernière mesure appariée connue est 58,6.

## Phase 0 — audit (04/10/2026)

Aucune mesure : Phase 0 sans code. Le conteneur cloud ne peut pas lancer le banc en l'état (voir `BACKLOG.md` n° 2).

## Phase 1 — baseline

**Officielle (Mac de Carlos, 04/10, code `d496859`)** — provisoire. Ces bancs ont été mesurés **avant** le correctif de reproductibilité (voir plus bas) : une partie sur cinq environ pouvait changer d'un lancement à l'autre sans qu'aucune décision change. Ils sont donc à relancer.

| Banc | Parties valides | Vague moyenne | Médiane | Erreur-type | p10 / p90 | Rival 1 | Rival 2 | Rival 4 |
|---|---|---|---|---|---|---|---|---|
| `p1-reference` (cerveau v5 + plan) | 457 (17 erreurs) | **41,56** | 30 | 1,24 | 17 / 80 | 100 % | 77 % | 89 % |
| `p1-plan-seul` | 459 (14 erreurs) | **40,54** | 28 | 1,22 | 16 / 80 | 98 % | 74 % | 59 % |

**Comparaison appariée** : plan seul − référence = **−0,96 vague** (erreur-type 1,35, 445 paires) : dans le bruit.

**Différences nettes de comportement** :

| | Cerveau v5 + plan | Plan seul |
|---|---|---|
| Changements volontaires par partie | 6,9 | 13,4 |
| Plus longue série de changements | 13 | 84 |
| Parties avec au moins 3 changements d'affilée | 16 | 164 |
| Rival 4 | 89 % | 59 % |

**Morts par type, référence** :

| Type | Part |
|---|---|
| Rencontre mystère | **35 %** |
| Champion d'arène | 21 % |
| Rival | 20 % |
| Dresseur | 8 % |
| Team | 7 % |
| Boss sauvage | 5 % |
| Sauvage | 3 % |

**Argent à la mort** : médiane 488 ₽, moyenne 1 205 ₽.

**Entre les machines** : le plan seul donne 40,54 sur le Mac et 40,26 dans le cloud. Les moyennes sont proches, mais on ne pourra comparer partie par partie qu'après le correctif.

### Reproductibilité : anomalie trouvée et corrigée (04/10)

**Constat** : la même partie (même code, même graine) lancée sur 4 copies du jeu donnait deux résultats. Exemples : k=1 finit à la vague 48 ou 95 ; k=10 à la vague 55 ou 115.

**Cause** : certains tirages du jeu utilisent `Math.random()`, qui ne dépend pas de la graine. C'est le cas du combat double contre un sbire de la Team (1 chance sur 3, `getRandomTrainerFunc` dans `src/battle.ts`), et aussi de certains genres de dresseurs, de rencontres mystères et des œufs.

**Correctif** : en mode « hasard du jeu fixé » (bancs), le simulateur remplace `Math.random` par un générateur initialisé avec la graine de la partie. L'entraînement normal n'est pas touché.

**Vérification** :
- k=1, k=8 et k=10 joués chacun sur 4 copies en parallèle : 4 résultats identiques.
- Le même banc de 96 parties lancé deux fois (3 processus) : **91 parties sur 92 identiques**. Écart +0,25 ± 0,25. Les 4 parties en erreur sont les mêmes des deux côtés (k = 31, 37, 48, 82 : boucles du pilote, déterministes).
- Avant le correctif : environ 1 partie sur 5 changeait. Il reste une partie sur 92 qui change (k=93 : vague 80 ou 57), cause non trouvée. Ce bruit résiduel est petit, et l'erreur-type appariée en tient compte.

**Vérification de l'instrumentation (cloud)** : 6 parties rejouées avant et après les ajouts au simulateur donnent exactement la même vague, le même nombre de décisions et le même argent. Les ajouts ne changent aucune décision.

### Aperçu cloud, plan seul (04/10, à confirmer sur le Mac)

Ces bancs ne servent pas à décider (autre machine). Ils servent à repérer les anomalies.
- Code : commit `e96a9de`.
- 3 processus, 480 parties, `--plan-seul`.

| Banc | Parties valides | Vague moyenne | Médiane | Erreur-type | p10 / p90 | Rival 2 | Rival 4 |
|---|---|---|---|---|---|---|---|
| Plan seul, rencontres mystères au rythme du jeu | 440 (15 boucles du pilote ; 23 blocages au démarrage, rejoués désormais) | **40,26** | 28 | 1,23 | 16 / 80 | 75 % | 65 % |
| Plan seul, sans rencontres mystères | 478 (2 erreurs) | **54,69** | 50 | 1,44 | 22 / 108 | 75 % | 65 % |

**Comparaison appariée** : avec les rencontres mystères **−14,24 vagues** (erreur-type 1,44, 438 paires ; 70 parties meilleures, 149 identiques, 219 pires).

**Morts par type, avec les rencontres mystères** :

| Type | Morts | Part |
|---|---|---|
| Rencontre mystère | 154 | **35 %** |
| Rival | 110 | 25 % |
| Champion d'arène | 68 | 15 % |
| Dresseur | 44 | 10 % |
| Team | 38 | 9 % |
| Boss sauvage | 21 | 5 % |
| Sauvage | 5 | 1 % |

**Ce que ça dit** :
- **Les rencontres mystères sont la 1re cause de mort.** Le pilote y prend toujours la 1re option (`BACKLOG.md` n° 12) et boucle parfois sur l'écran de résumé (n° 15). L'ancien banc ne les voyait pas : il jouait sans elles.
- **H4 est confirmée en plan seul.**
  - Avec les rencontres mystères : 148 parties sur 440 ont au moins 3 changements volontaires d'affilée (série maximale 58).
  - Sans elles : 234 parties sur 478 (série maximale 91).
  - Les pires séries ont lieu contre des dresseurs et finissent en défaite (n° 16).
- **Argent à la mort** : médiane 501 ₽ avec les rencontres mystères, 250 ₽ sans ; moyenne autour de 1 050-1 120 ₽.
- **Tiers de force des starters** : aucun effet visible. Le total des stats varie trop peu dans un trio Plante/Feu/Eau (n° 17).
- Le plan seul sans rencontres mystères (54,7) est sous la dernière mesure du cerveau v5 dans les mêmes conditions (58,6, Mac). Si le Mac le confirme, on garde le cerveau v5 dans la boucle.

## Phase 3 (anticipée) — changements en plein combat (commit `f531ba0`, PR #4)

Correctif venu d'une autre session à la demande de Carlos :
- un changement en plein combat coûte un tour dans le moteur d'équipe ;
- un changement vers un duel perdu vaut moins qu'une attaque.

Mesuré dans le cloud, en plan seul, code reproductible, 480 parties appariées :

| | Avant (`22292f2`) | Après | Écart |
|---|---|---|---|
| Vague moyenne | 40,52 | **44,43** | **+3,91** (erreur-type 1,33, seuil 2,66) |
| Parties meilleures / identiques / pires | — | — | 150 / 202 / 93 |
| Changements volontaires par partie | 13,0 | 9,3 | |
| Parties avec au moins 3 changements d'affilée | 153 | 23 | |
| Plus longue série de changements | 84 | 66 | |
| Rival 2 | 74 % | 77 % | |
| Rival 4 | 69 % | 59 % (peu de parties) | |

**Verdict : GARDER.**

Il reste quelques longues séries de changements (66 au maximum), à chercher (BACKLOG n° 16). À confirmer avec le cerveau v5 sur le Mac.

## Rencontres mystères : option choisie par un fichier de données (commit `207008a`, PR #6)

Avant, le pilote prenait toujours la 1re option possible. Maintenant, il suit `donnees/rencontres-mysteres.json` : pour chacune des 31 rencontres, l'ordre de préférence des options et la raison, tirée du code du jeu.

Mesuré dans le cloud, en plan seul, code reproductible, 480 parties appariées :

| | Avant (`fb29312`) | Après | Écart |
|---|---|---|---|
| Vague moyenne (paires valides) | 43,04 | **52,35** | **+9,31** (erreur-type 1,44, seuil 2,87) |
| Parties meilleures / identiques / pires | — | — | 156 / 173 / 67 |
| Médiane | 30 | 48 | |
| p90 | 90 | 104 | |
| Morts en rencontre mystère | 35 % | 17 % | |

**Verdict : GARDER.**

**Rencontres les plus mortelles** :
- avant : Training Session 55, Expert Breeder 35, Ronflex 16 ;
- après : Expert Breeder 39, Berries Abound 11, Uncommon Breed 9.

**Effet de bord découvert** : 57 parties en erreur au lieu de 28. Uncommon Breed (amadouer) et The Pokémon Salesman (acheter) donnent un Pokémon. Avec l'équipe pleine, le pilote ne voyait pas le Pokémon offert et ouvrait le résumé en boucle. Corrigé dans `1e002ac` : dans ce cas, il ne garde pas le Pokémon (k = 20, 48, 53 vont maintenant jusqu'aux vagues 55, 112 et 112).

**Nouvelles premières causes de mort** : rivaux 33 %, champions d'arène 24 %.

## Expert Breeder et Super Bonbon vers l'évolution (04-05/10) — deux essais rejetés

| Essai | Écart apparié | Verdict |
|---|---|---|
| Expert Breeder : combattre avec le Pokémon de plus haut niveau parmi les trois proposés (`76092c3`) | +0,62 ± 0,55 (416 paires) | dans le bruit → **annulé** (`dc1080d`) |
| Super Bonbon au membre qui évolue au niveau suivant, sauf rival proche (`fd87dba`) | −0,60 ± 0,70 (474 paires) | dans le bruit → **annulé** (`0b2b41e`) ; l'export `donnees/evolutions.json` est gardé |

**Nouvelle référence** (plan seul, rencontres corrigées, boucle du pilote corrigée) : **57,7** de vague moyenne sur 474 parties valides (6 en erreur).
- Rival 1 : 99 %. Rival 2 : 79 %. Rival 3 : 92 %. Rival 4 : 72 %.
- Morts : rivaux 30 %, champions d'arène 27 %, rencontres mystères 15 %, team 14 %.

Le 52,35 mesuré avant comptait seulement les parties valides des deux côtés. Les parties que la boucle bloquait vont maintenant au bout.

**Analyse du rival 2** (vague 25) :
- les équipes arrivent avec leurs PV au complet ;
- le porteur est au même niveau que chez les gagnants ;
- le banc a 4 à 6 niveaux de retard (11 à 15 contre 16 à 18) et reste sous sa première évolution ;
- dans un combat perdu d'avance, le moteur d'équipe note toutes les actions à peu près pareil et choisit presque au hasard.

## Moteur de combat d'équipe avec le hasard du jeu (05/10) — rejeté

**Idée** : noter chaque action sur 16 combats simulés avec le hasard du jeu (dégâts de 85 à 100 %, critiques, précision), au lieu d'un seul combat moyen, pour viser la meilleure chance de gagner quand le combat paraît perdu (`4d99858`).

| | Référence (`40f13e7`) | Avec hasard |
|---|---|---|
| Vague moyenne | 57,33 | 54,13 |
| Écart apparié | — | **−3,20** (erreur-type 1,51, 470 paires) |
| Parties avec au moins 3 changements d'affilée | 33 | 64 |

**Verdict : annulé.** Le bruit des tirages fait paraître certains changements meilleurs qu'ils ne le sont.

**Référence actuelle** (plan seul) : **57,33** sur 474 parties valides. Rival 2 : 79 %. Rival 4 : 74 %.

## Données d'équipe par vague et bug de l'Éleveur expert (05/10)

Banc de référence `p5-ref` (`c58e673`, plan seul, même décisions que `40f13e7`) : **57,92** sur 475 parties valides. Rival 2 : 79 %, rival 4 : 73 %.

**Ce qui distingue les gagnants des perdants** (équipe vue à la vague d'avant) :

| Combat | Passent / meurent | Niveau max | Niveau moyen | Total des stats de l'équipe |
|---|---|---|---|---|
| Rival 2 (vague 25) | 331 / 86 | 18,2 / 17,7 | 13,4 / 12,9 | 1895 / 1845 |
| Champion vague 30 | 292 / 22 | 23,2 / 22,5 | 17,5 / 16,3 | 2071 / 1995 |
| Rival 3 (vague 55) | 216 / 19 | 41,3 / 40,3 | 37,3 / 35,1 | 2870 / 2784 |
| Rival 4 (vague 95) | 76 / 28 | 77,6 / 77,5 | 75,2 / 74,1 | 3041 / 3007 |

Les écarts sont petits : l'équipe n'explique pas à elle seule les morts au rival 2. Les objets non plus (presque les mêmes des deux côtés).

**Bug du banc trouvé** : 44 morts sur 475 (9 %) étaient comptées dans l'Éleveur expert, alors que le jeu continue après une défaite dans cette rencontre (REGLES R14). Corrigé dans le simulateur. Parties rejouées : k=72 passe de la vague 28 à 66, k=112 de 28 à 90. Le vrai niveau du bot était sous-estimé. Ce changement modifie le protocole : une nouvelle référence est nécessaire.

## Précision des attaques dans le planificateur (05/10) — rejeté

**Idée** : contre les sauvages, les boss sauvages et en double, compter la précision (et les crans précision/esquive) : valeur = précision × valeur si l'attaque touche + (1 − précision) × valeur si elle rate (`7b747dc`).

| | Référence `p5-ref` | Avec précision |
|---|---|---|
| Vague moyenne | 57,92 | 58,72 |
| Écart apparié | — | **+0,76** (erreur-type 1,00, 472 paires) · mieux 105, pareil 286, pire 81 |
| Rival 4 | 73 % | 82 % |

**Verdict : annulé** (moins de 2 erreurs-types). Le rival 4 progresse, mais l'écart total reste dans le bruit.

## Nouvelle référence (simulateur corrigé, 05/10)

`p7-ref` (`cc7a855`, plan seul, Éleveur expert corrigé) : **60,03** sur 475 parties valides. Rival 2 : 79 %, rival 4 : 75 %. Morts en rencontre mystère : 76 → 32. **C'est la référence actuelle.**

## Captures limitées aux espèces fortes (05/10) — rejeté

**Idée** (Carlos + consensus des victoires trouvées en ligne) : après 3 membres, ne capturer que les espèces qui finissent à 480 de stats ou plus, sauf chromatique ou boss (`7e72118`).

| | Référence `p7-ref` | Captures limitées |
|---|---|---|
| Vague moyenne | 60,03 | 46,87 |
| Écart apparié | — | **−13,14** (erreur-type 1,93, 473 paires) · mieux 121, pareil 99, pire 253 |
| Rival 1 | 99 % | 94 % |
| Morts contre des sauvages | 10 | 46 |

**Verdict : annulé.** Pour ce bot, sur un compte neuf, les captures nombreuses du début aident : une capture termine le combat sans encaisser de coup et donne des membres de plus pour encaisser et gagner de l'expérience. Cela confirme une ancienne mesure (v4, voir `valeurBall`). Le problème n'est donc pas « trop de captures », mais peut-être « garder les faibles trop longtemps » : à tester par le remplacement, pas par la capture.

## Remplacements : niveaux perdus comptés à toute vague, chromatiques gardés (05/10) — rejeté

**Données avant l'essai** (`p7-ref`) : 6 remplacements par partie (surtout avant la vague 30), +11 points de potentiel final en moyenne. Le nombre de membres « faibles même évolués » à la vague 30 ne prédit pas la suite (vague finale 79,0 / 78,7 / 75,1 / 78,6 pour 0 / 1 / 2 / 3+). Meilleur prédicteur : le niveau du membre le plus faible (corrélation +0,25 à +0,31).

**Idée** : coût de 3 par niveau perdu en remplaçant à toute vague (avant : seulement avant un rival) ; jamais de chromatique relâché (`badce99`).

| | Référence `p7-ref` | Remplacements |
|---|---|---|
| Vague moyenne | 60,03 | 59,98 |
| Écart apparié | — | **−0,05** (erreur-type 0,44, 474 paires) · mieux 25, pareil 422, pire 27 |

**Verdict : annulé.** 422 parties sur 474 sont identiques : la règle ne change presque jamais une décision. Les remplacements ne sont pas un levier. Avec les captures (−13,14), la composition de l'équipe est écartée pour l'instant : le prochain levier à chercher est dans les combats.

## Effets des attaques dans le moteur de combat d'équipe (05/10) — rejeté, y compris en essais séparés

**Idée** (remarque de Carlos : « l'IA ne mesure que la puissance ») : table générée depuis le jeu (`generer-effets-attaques.py`, 220 attaques) ; contre les dresseurs, le moteur compte en espérance le contrecoup, le drainage, les crans sur soi et sur la cible, la brûlure, la paralysie, le poison et la peur, plus les statuts déjà présents (`b22d316`).

| | Référence `p7-ref` | Avec effets |
|---|---|---|
| Vague moyenne | 60,03 | 57,92 |
| Écart apparié | — | **−2,08** (erreur-type 1,50, 473 paires) · mieux 146, pareil 165, pire 162 |
| Rival 3 / rival 4 | 92 % / 75 % | 88 % / 65 % |
| Parties avec 3 changements d'affilée ou plus | 36 | 41 |

**Verdict : annulé** (dans le bruit, mais négatif). Plusieurs effets étaient regroupés : deux essais séparés suivent, effets sur soi (contrecoup, drainage, crans sur soi) et effets sur l'adversaire (statuts, peur, crans sur la cible).

**Essais séparés** (même code, effets filtrés ; 2 bancs en parallèle) :

| Essai | Écart apparié | Rival 3 / rival 4 | Séries de 3 changements ou plus |
|---|---|---|---|
| Référence `p7-ref` | — | 92 % / 75 % | 36 |
| Effets sur soi (contrecoup, drainage, crans sur soi) | −1,05 (erreur-type 0,96) | 90 % / 70 % | 49 |
| Effets sur l'adversaire (statuts, peur, crans sur la cible, statuts de départ) | −2,61 (erreur-type 1,38) | 86 % / 60 % | 44 |

**Verdict : annulés tous les deux.** Plus de réalisme dans le moteur ne le fait pas mieux jouer : les trois essais vont dans le même sens (négatif) et le rival 4 recule à chaque fois. Hypothèses non vérifiées : les effets en espérance (une « fraction » de brûlure) rendent le moteur trop optimiste ; ils font paraître des changements meilleurs qu'ils ne sont. Prochaine méthode : chercher avec le juge (`entraineur/juge.py`, triche permise au diagnostic) quelles décisions perdent vraiment au rival 4 et contre les champions, au lieu d'ajouter des règles à l'aveugle.

## Juge des défaites et ciblage de l'IA adverse au tour d'un changement (05/10) — rejeté

**Juge** (`entraineur/juge_banc.py`, 36 défaites de `p7-ref` : rival 2, rival 4, champions 50-110) : depuis la photo de la vague fatale, le bot gagne ~1/3 de ces combats avec d'autres tirages. Erreurs fortes revérifiées sur 16 avenirs neufs : coup du bot 28 %, coup du juge 57 % (+4,6 victoires sur 16, erreur-type 0,53). Erreurs réelles : changements de Pokémon (« aurait dû changer » 24 → 62 %, « mauvais Pokémon envoyé » 29 → 56 %) ; pas les attaques de statut (36 → 32 %).

**Idée** : dans le jeu, l'IA adverse choisit son attaque contre le Pokémon qui part (`EnemyCommandPhase` avant `TurnStartPhase`) ; le moteur d'équipe la faisait choisir contre le remplaçant (`45e2f0d`).

| | Référence `p7-ref` | Ciblage corrigé |
|---|---|---|
| Vague moyenne | 60,03 | 58,99 |
| Écart apparié | — | **−0,93** (erreur-type 1,26, 470 paires) · mieux 113, pareil 234, pire 123 |
| Changements volontaires par partie | 13,7 | 15,5 |
| Parties avec 3 changements d'affilée ou plus | 36 | **77** |

**Verdict : annulé** (partie moteur ; l'option de diagnostic `observationBrute` reste). Les changements devenus plus justes sont aussi plus attirants, et les séries de changements reviennent : toute correction des changements doit venir avec un garde-fou contre les séries (prix d'un changement plus élevé, ou pas de rechangement au tour suivant).

## Équipe des rivaux connue dans le moteur d'équipe (05/10) — rejeté

**Idée** : les Pokémon pas encore vus d'un rival joués avec le niveau et les stats de base moyennes de leur emplacement, lus dans le jeu (`donnees/rivaux.json` ; rival 2 : 3e Pokémon niveau 16, 313 de stats de base en moyenne, au lieu d'une copie du starter) (`0fff884`, mesuré sans le ciblage).

| | Référence `p7-ref` | Rivaux connus |
|---|---|---|
| Vague moyenne | 60,03 | 60,77 |
| Écart apparié | — | **+0,81** (erreur-type 0,90, 474 paires) · mieux 95, pareil 293, pire 86 |
| Rival 2 / rival 4 | 79 % / 75 % | 79 % / 72 % |

**Verdict : annulé** (partie moteur ; `donnees/rivaux.json` et `simulateur/exporter-rivaux.test.ts` restent, sans effet sur les décisions). Le rival 2 ne bouge pas : ce qui le fait perdre n'est pas la force supposée de son 3e Pokémon (voir la trace de k=41 : retrait de l'adversaire, évolution en plein combat).

**Référence inchangée : `p7-ref`, 60,03 (décisions de `77dabf3`).**

## Ciblage au tour d'un changement + prix de changement 0,05 (05/10) — pas significatif, réplication lancée

**Idée** (chantier 1 bis) : le ciblage de `45e2f0d` (l'IA adverse vise le Pokémon qui part), avec un prix de changement de 0,05 au lieu de 0,01 dans le moteur d'équipe, pour éviter les séries.

| | Référence `p7-ref` | Ciblage + prix 0,05 |
|---|---|---|
| Vague moyenne / médiane | 60,03 / 55 | 62,07 / 60 |
| Écart apparié | — | **+1,87** (erreur-type 1,61, 473 paires) · mieux 160, pareil 174, pire 139 |
| Rival 2 / rival 3 / rival 4 | 79 % / 92 % / 75 % | 81 % / 94 % / 79 % |
| Changements volontaires par partie | 13,7 | 9,0 |
| Parties avec 3 changements d'affilée ou plus (plus longue série) | 36 (13) | 14 (5) |

**Verdict : pas gardé** (moins de 2 erreurs-types). C'est le meilleur résultat de la journée et il va dans le sens du juge (moins de changements, mieux ciblés). **Réplication fixée avant de voir le résultat** : 480 graines de plus (k = 480 à 959) pour la référence et la variante ; on garde si l'écart sur les **960** parties dépasse 2 erreurs-types.

**Réplication (960 parties, règle fixée d'avance)** : **+1,92** (erreur-type 1,08, seuil 2,16, 946 paires) · mieux 322, pareil 351, pire 273 ; graines neuves seules (480-959) : +1,96 ± 1,45. Changements par partie 13,5 → 8,8 ; séries de 3 ou plus 70 → 28. Rival 4 : 70 → 73 %.

**Verdict : pas gardé** (1,8 erreur-type, sous le seuil fixé). L'effet est constant sur les deux lots de graines (+1,87 puis +1,96) : c'est le candidat n° 1 pour la suite (voir REPRISE.md).

## Référence instrumentée et économie (09-10/10)

`p16-ref` (`392fe80`, mêmes décisions que `p7-ref`, banc instrumenté : argent, Balls, achats avec les PV de l'équipe, récompenses, sauvages rencontrés et recrues) : **60,71** sur 475 parties valides. **Référence actuelle.**

**Constats** (`entraineur/analyse_economie.py`, `entraineur/rapport_legendaires.py`) :
- 17 Potions et 11 Super Potions achetées par partie ; 69 % des Potions (5 582 sur 8 095) achetées quand l'équipe avait 85 % de ses PV ou plus.
- Toutes les vagues X0 comptaient comme « combat important » : 1 105 Rappels achetés avant un boss sauvage (rang 1), contre 730 avant les combats de rang 3 (rivaux, champions, Team, Conseil 4).
- Ceux qui meurent à un combat de rang 3 y arrivent plus pauvres (argent médian avant le champion de la vague 50 : 952 ₽ si on survit, 100 ₽ si on meurt ; avant l'Admin de la vague 66 : 2 087 contre 137).
- Légendaires : 64 rencontres en 475 parties (59 semi-légendaires dans 12 % des parties, 2 légendaires, 3 fabuleux), toutes des boss sauvages (vague médiane 80) ; **0 capturé** (boucliers à casser, pas de Master Ball ; le bot le met ensuite K.O. alors qu'il a ~18 Poké Balls).
- Objets d'expérience : 2 à 3 % des récompenses ; quand le bot les prend, l'équipe est en moyenne 7 à 11 niveaux sous le plafond, même après la vague 100 : pas de gaspillage visible dans le banc.

## Rang d'importance des combats (10/10) — rejeté

**Idée** : `donnees/importance-combats.json` (rang 3 : rivaux, champions, Team admin/boss, Conseil 4, Maître ; 2 : sbires ; 1 : boss sauvages, Gamin) ; champions déduits à la vague 20 comme un joueur (série 20-50-80… ou 30-60-90…) ; pas de soin « urgent » avant un combat de rang 1 (`f3e05f4`).

| | Référence `p16-ref` | Rangs |
|---|---|---|
| Vague moyenne / médiane | 60,71 / 55 | 61,40 / 60 |
| Écart apparié | — | **+0,74** (erreur-type 1,44, 472 paires) · mieux 143, pareil 207, pire 122 |
| Potions achetées avant un boss sauvage | 3 514 | 1 160 |
| Rappels avant un boss sauvage | 1 105 | 1 057 (inchangé : le porteur K.O. reste ranimé hors urgence) |
| Argent médian avant le champion de la vague 50 (survivants) | 952 | 2 382 |

**Verdict : annulé** (dans le bruit). L'économie change bien, mais l'effet sur la vague moyenne est petit. `donnees/importance-combats.json` est gardé (utilisé par l'analyse de l'économie).

## Pas de Potion au-dessus de 70 % de PV (10/10) — rejeté, perte significative

**Idée** (remarque de Carlos : « il claque des Potions pour mettre full HP alors qu'il était presque full ») : pas d'achat de Potion pour un membre au-dessus de 70 % de ses PV, même avant un combat important (`9fc2d45`).

| | Référence `p16-ref` | Seuil 70 % |
|---|---|---|
| Vague moyenne | 60,71 | 57,90 |
| Écart apparié | — | **−2,88** (erreur-type 1,39, 474 paires) · mieux 131, pareil 184, pire 159 |
| Potions par partie | 17,0 | 8,5 |
| Rival 3 / rival 4 | 92 % / 76 % | 87 % / 69 % |

**Verdict : annulé.** Remettre l'équipe à 100 % avant les combats aide, même depuis 85 % : une Potion (le moins cher des soins) vaut plus que l'argent gardé. Les Potions « à PV hauts » ne sont pas un gaspillage pour ce bot.

## Essai « paquet » (règle fixée le 10/10, avant tout résultat)

Plusieurs corrections justes donnent chacune un petit gain positif mais sous le seuil : précision (+0,76 ± 1,00), équipe connue des rivaux (+0,81 ± 0,90), ciblage + prix de changement 0,05 (+1,92 ± 1,08 sur 960), rang d'importance des combats (+0,74 ± 1,44). **Paquet** = ces quatre corrections ensemble (`7b747dc`, `0fff884` partie moteur, `45e2f0d` + `COUT_CHANGEMENT = 0.05`, `f3e05f4`), plus le départage des attaques (`af8222b`) et la capture des légendaires (`b9bf11c`) **seulement si leur écart seul est positif**. Mesure : 960 parties (graines 0 à 959) contre `p16-ref` étendue à 960. **Garder le paquet entier si l'écart dépasse 2 erreurs-types ; sinon l'abandonner** (pas de tri après coup entre ses morceaux).

## Capture des légendaires, premier essai (10/10) — règle défaillante, corrigée

**Idée** (Carlos : « face à un légendaire utile il ne capture pas ») : contre un légendaire, semi-légendaire ou fabuleux aux boucliers cassés, pénaliser les attaques qui le mettraient K.O., l'affaiblir au-dessus de 30 % de PV, puis lancer les Balls (capture valant 3 au lieu de 1,6) (`b9bf11c`).

Résultat : **−0,42** (erreur-type 0,28, 474 paires ; 451 parties identiques) et **toujours 0 capture sur 61 rencontres**. La trace d'un combat (k = 96, Stakataka vague 70) montre pourquoi : pendant l'affaiblissement, changer de Pokémon paraissait meilleur qu'une attaque sans K.O. (le bot alternait deux Pokémon), et les Balls « interdites » gardaient la valeur d'une Ball ratée, proche des attaques. Correction (`f8d57ad`) : bonus de 0,5 aux attaques qui affaiblissent sans K.O., Balls nettement sous elles pendant l'affaiblissement, puis bonus de 0,5 aux Balls sous 30 % de PV. Rejouée, la même trace affaiblit Stakataka jusqu'à 20 % puis lance la Super Ball (valeur 2,46). Nouveau banc `p19b`.
