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
