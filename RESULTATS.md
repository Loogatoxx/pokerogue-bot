# RESULTATS.md — métriques par phase

**Protocole** : à figer en Phase 1. Tant qu'il ne l'est pas, les chiffres ci-dessous servent de contexte. Ce ne sont **pas** des références officielles.

## Avant le protocole (mesures déjà faites, d'après `docs/`)

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

À remplir pour chaque version :
- nombre de parties, moyenne, médiane ;
- écart-type, erreur-type ;
- p10 et p90 ;
- histogramme des vagues de mort ;
- morts par type de vague (sauvage, dresseur, boss, rival) ;
- argent et objets à la mort ;
- starters et total de leurs stats de base.
