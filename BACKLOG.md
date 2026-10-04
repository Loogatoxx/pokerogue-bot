# BACKLOG.md — idées hors phase (aucun code tant qu'elles ne sont pas programmées)

Chaque idée a sa phase probable et sa source.

| # | Idée | Phase probable | D'où vient-elle |
|---|---|---|---|
| 1 | Épingler la copie du jeu sur le tag `v1.12.0.11` dans le README (`git clone --branch v1.12.0.11`), au lieu de `main` qui bouge | 1 | Phase 0 : `main` = `v1.12.0.11` aujourd'hui, mais le site se met à jour souvent |
| 2 | Pouvoir mesurer depuis une session cloud : cerveau v5 dans le dépôt (exception au `.gitignore`, ~3 Mo, pas un secret), ou mesure « plan seul » | 1 | Phase 0 : le conteneur cloud n'a ni le Lexar, ni le cerveau v5, ni PyTorch, et a Node 22 au lieu de 24 |
| 3 | Boss sauvages (vagues X0 hors champion, légendaires) : le planificateur ignore les segments et les boosts de segment ; seul le moteur d'équipe (contre dresseur) connaît les segments | 5 | REGLES R3 ; `observateur/planificateur.ts`, `observateur/combat-equipe.ts` |
| 4 | Relances de récompenses : jamais utilisées. Les joueurs les gardent pour la fin de partie | 4 (M3) | REGLES R7 ; `docs/etape-12-plafond.md` |
| 5 | Transferts d'objets tenus (gratuits) : jamais utilisés, par exemple pour rendre un objet au porteur ranimé ou à un nouveau porteur | 4 | REGLES R7 |
| 6 | Choix du biome avec la Carte : aujourd'hui toujours la 1re option (`pilote/pilote.ts`, menus à options) | 4 | REGLES R1 |
| 7 | Les boosts persistent entre sauvages du même biome jusqu'au boss X0 (REGLES R9) : un boost pris tôt dans la dizaine pourrait servir au boss | 6 | REGLES R9 |
| 8 | Savoir quelles vagues X0 sont des champions (`offsetGym`, déductible au 1er champion vu) au lieu de « champion ou boss » | 2 | REGLES R2 ; `observateur/combats.ts` |
| 9 | Moteur de combat d'équipe limité au combat simple contre un dresseur ; les doubles restent au planificateur | 6 | `observateur/combat-equipe.ts` |
| 10 | Jeu de graines de contrôle (hold-out), pour qu'une recherche de poids ne s'ajuste pas aux 480 graines du banc | 7 | Phase 0 (risque de surapprentissage) |
| 11 | Mesurer à part le cas « compte de Carlos » (légendaires, IV élevés), différent du compte neuf | après 6 | `docs/etape-15-banc-apparie.md` §6 |
