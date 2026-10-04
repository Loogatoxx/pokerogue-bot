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
```

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

**Officielle (Mac de Carlos)** : en attente des bancs `p1-reference` et `p1-plan-seul`.

**Vérification de l'instrumentation (cloud)** : 6 parties rejouées avant et après les ajouts au simulateur donnent exactement la même vague, le même nombre de décisions et le même argent. Les ajouts ne changent aucune décision.
