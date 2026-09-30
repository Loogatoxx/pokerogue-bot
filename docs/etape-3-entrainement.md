# Étape 3 — Premier entraînement (30/09/2026)

## Comment il apprend : PPO

Le cycle, répété sans fin (`entraineur/entrainer.py`) :

1. **Collecte** : les 8 copies du jeu jouent chacune 256 décisions avec le cerveau actuel, en
   tirant au sort selon ses probabilités (pour qu'il continue d'explorer).
2. **Bilan** : pour chaque décision, a-t-elle mieux tourné que ce que la tête « valeur » avait
   prévu ? C'est « l'avantage », calculé avec les récompenses qui ont suivi (méthode GAE : les
   récompenses proches comptent plus que les lointaines).
3. **Apprentissage (PPO)** : on rend un peu plus probables les décisions meilleures que prévu, un
   peu moins les autres. **Jamais trop d'un coup** (le « clip ») : c'est ce qui empêche de tout
   désapprendre sur une série malchanceuse.

PPO est écrit à la main (sur le modèle des implémentations de référence CleanRL) plutôt
qu'avec Stable-Baselines3 : brancher nos copies du jeu en TCP et nos masques d'actions sur
cette bibliothèque demandait autant de code, et chaque chiffre de l'apprentissage reste visible.

## Tes leviers : `entraineur/reglages.toml`

| Réglage | Ce qu'il change |
|---|---|
| `[recompenses]` | Ce que le cerveau cherche : points par vague, pénalité par K.O., coup de pouce pour les dégâts |
| `vague_max` | Programme progressif : la partie s'arrête au-delà (à relever quand il y arrive souvent) |
| `coef_entropie` | L'envie d'explorer : à monter si l'hésitation tombe à zéro trop tôt et que la courbe plafonne |
| `taux_apprentissage` | La taille des pas : trop grand = instable, trop petit = lent |

Chaque entraînement garde une copie des réglages utilisés, pour comparer plus tard.

## Le tableau de bord

```bash
.venv/bin/python -m entraineur.tableau_de_bord    # puis http://localhost:8766
```

Vague moyenne (chiffre principal et courbe, avec les repères v0 et glouton), hésitation
(entropie), récompense par partie, dernières parties (avec les règles appliquées par le
pilote), versions du cerveau à importer dans Brave. Mise à jour toutes les 10 secondes.

## Note de synergie des attaques (idée de Carlos)

Quand un Pokémon doit oublier une attaque, le pilote ne compare plus les attaques une par une :
il note **le jeu de quatre attaques dans son ensemble** (`observateur/synergie.ts`) :
couverture des 18 types (faiblesses, résistances, immunités), bonus de même type (×1,5),
attaque physique ou spéciale selon les stats du Pokémon, précision, une attaque de statut,
couverture de ce que l'équipe touche mal, et variété des types (utile face aux immunités de
talent). Il garde l'option la mieux notée ; le panneau de l'extension affiche chaque option avec
sa note, ses « pour » et ses « contre ».

Limite actuelle : toutes les attaques de statut se valent (Trempette autant que Danse-Lames).
Plus tard, le cerveau décidera lui-même, en recevant cette note comme un avis.

## Où sont les fichiers

`/Volumes/Lexar/pokerogue-bot/entrainements/<nom>/` :
`journal.jsonl` (une ligne par mise à jour), `parties.jsonl` (une ligne par partie),
`cerveaux/mise-a-jour-NNNNN.cerveau` (toutes les 10 mises à jour), `etat.pt` (pour reprendre),
`reglages-*.toml` (les réglages utilisés).

## Commandes

```bash
.venv/bin/python -m entraineur.entrainer --depart /Volumes/Lexar/pokerogue-bot/cerveaux/v0-2026-09-30.cerveau --minutes 45
.venv/bin/python -m entraineur.entrainer --reprendre /Volumes/Lexar/pokerogue-bot/entrainements/entrainement-1 --minutes 60
.venv/bin/python -m entraineur.evaluer <fichier.cerveau> --publier v1
```

## Résultats du premier entraînement (entrainement-1)

| Cerveau | Vague moyenne (64 parties, meilleur coup) | Record |
|---|---|---|
| v0 (non entraîné) | 4,6 | 8 |
| Bot glouton (règles) | 6,8 | 13 |
| **v1** (entrainement-1, 40 mises à jour, 2 467 parties) | **8,4** (8,6 en tirage) | 19 |

La courbe monte vite (dépasse le glouton en 700 parties), puis **plafonne vers 8,4** à partir
de ~1 400 parties. Diagnostic :

1. **Le rival de la vague 8.** 45 % des défaites ont lieu exactement à la vague 8 : c'est le
   premier combat contre le rival (`RIVAL_1 = 8` dans le jeu), avec des Pokémon mieux armés. Le
   cerveau ne décide que des combats : son équipe reste à **3 starters** (il ne capture pas), la
   première récompense est prise même inutile. Même en combattant bien, il ne peut pas passer.
   **C'est un plafond structurel** : pour le franchir, il faut lui confier la capture et le choix
   des récompenses (étape 4).
2. **Il n'explore presque plus.** L'hésitation (entropie) est passée de 1,43 à 0,28 ; ses mises à
   jour sont devenues minuscules. Pour la suite : `coef_entropie` 0,01 → 0,02.

`/Volumes/Lexar/pokerogue-bot/cerveaux/v1-2026-09-30.cerveau` (évaluation dans
`evaluations/v1-2026-09-30.json`).

## Problèmes techniques trouvés et corrigés

- **Ralentissement (174 → 14 décisions/s)** : à chaque partie, des minuteries du jeu (sans action,
  ou effets de particules) s'accumulaient ; l'horloge simulée les parcourait toutes chaque
  milliseconde (mesuré : 22 → 118 ms par décision en 120 parties). Correction : ménage à chaque
  vague et entre deux parties → stable vers 15 ms.
- **Fuite de mémoire (~2,5 Mo par partie)** dans l'outil de test du jeu, non localisée : chaque
  copie du jeu est redémarrée toutes les 150 parties (seuils échelonnés, redémarrages en
  parallèle, ~8 s chacun).
- **Arrêt par Ctrl+C** : il interrompait n'importe où et laissait des copies du jeu orphelines.
  Désormais : la mise à jour en cours se termine, le cerveau est sauvegardé, et chaque copie du
  jeu (lancée dans sa propre session) est arrêtée avec tout son groupe de processus.

## Pistes d'amélioration repérées

- **Collecte asynchrone** : aujourd'hui le Python attend que les 8 copies aient joué avant le coup
  suivant ; chacune n'utilise qu'un quart de cœur. Les laisser avancer chacune à son rythme
  devrait multiplier la vitesse.
- **Règle des bonus** : le pilote essaie souvent de donner un objet inutilisable (ex. une Potion
  à un Pokémon en pleine forme), jusqu'à 75 fois dans une partie : c'est du temps perdu, et
  surtout une décision que le cerveau devra apprendre (étape 4).
