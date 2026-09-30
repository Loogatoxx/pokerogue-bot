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

## Pistes d'amélioration repérées

- **Collecte asynchrone** : aujourd'hui le Python attend que les 8 copies aient joué avant le coup
  suivant ; chacune n'utilise qu'un quart de cœur. Les laisser avancer chacune à son rythme
  devrait multiplier la vitesse.
- **Règle des bonus** : le pilote essaie souvent de donner un objet inutilisable (ex. une Potion
  à un Pokémon en pleine forme), jusqu'à 75 fois dans une partie : c'est du temps perdu, et
  surtout une décision que le cerveau devra apprendre (étape 4).
