# Étape 5 — Le mur du rival (01/10/2026)

Après l'entraînement 4, 55 % des défaites avaient lieu contre le rival (vagues 8 et 25). Demande de
Carlos : analyser ces défaites d'abord, puis enchaîner la suite (prochain combat dans
l'observation, dernière fuite de mémoire), le tout d'un trait.

## 1. Analyse (`entraineur/analyse_defaites.py`)

Le simulateur sait maintenant raconter une partie (option `recit`, désactivée à l'entraînement) :
les forces en présence au début de chaque vague, les attaques de statut choisies, et l'état exact
des deux équipes à la défaite. Le script fait jouer un cerveau (meilleur coup, starters au hasard)
et compare, pour chaque combat important, les parties qui le passent à celles qui y perdent.

Cerveau de l'entraînement 4, 320 parties :

| | Rival 1 (v. 8) | Boss (v. 20) | Rival 2 (v. 25) |
|---|---|---|---|
| parties qui passent | 77 % | 86 % | 52 % |
| PV de l'équipe au départ : passent / perdent | 92 / 85 % | 86 / 68 % | 96 / 90 % |
| attaques de statut alors qu'il pouvait frapper : passent / perdent | 1,5 / 7,1 % | 1,9 / 8,9 % | 1,4 / 4,5 % |
| écart de niveau (adverse − équipe) : passent / perdent | −0,8 / −0,4 | −1,1 / +0,2 | −0,4 / +1,2 |

- **Ce n'est pas une question de niveau** : le premier de l'équipe est au niveau du rival.
- **Il arrive blessé** : rien ne soigne entre deux vagues, sauf les objets. Or les soins perdaient
  presque toujours face aux Charmes Exp dans la note des objets, et le pilote n'achetait jamais
  rien en boutique.
- **Il frappe mal quand ça se passe mal** : 5 fois plus d'attaques de statut dans les défaites.
- **Les captures sont indispensables** : expérience sans Balls, la vague moyenne tombe de 24 à 8,9
  (capturer finit un combat sans encaisser, et ajoute des membres en pleine forme).
- Combats importants rencontrés : Gamin (v. 5), rival (8, 25), champion d'arène ou Pokémon boss
  toutes les 10 vagues (Tcheren, Rachid, Armando à la vague 20).

## 2. Se soigner avant le boss

- `observateur/combats.ts` : les combats fixes du Classique, **générés depuis le jeu**
  (`ClassicFixedBossWaves` dans `noms.ts`), plus le boss toutes les 10 vagues.
- `observateur/objets.ts` : soins et Rappels ×1,8 juste avant un combat important, ×1,4 deux
  vagues avant (« avant : Rival (vague 8) » dans les raisons).
- **Boutique** : le pilote achète Potions, Rappels et Huiles quand la note (prix déduit) dépasse 8,
  jusqu'à 6 achats par vague, avant de prendre la récompense gratuite. Piège trouvé en route : le
  jeu crée les articles de boutique sans identifiant ; on le lit dans leur clé de traduction.

Même cerveau, mêmes 320 parties tirées au hasard, avec ces règles : **vague moyenne 23,7 → 27,2**,
69 parties à la vague 50 au lieu de 41, environ 9 achats par partie, équipe à 94-98 % de PV face au
rival.

## 3. Le prochain combat dans l'observation

Observation v4, encodage v3 : **+5 nombres à la fin** (dans combien de vagues, rival / dresseur /
boss, « c'est maintenant »). Le cerveau de l'entraînement 4 a été greffé (1 299 → 1 304 entrées,
poids nuls au départ : il raisonne d'abord exactement comme avant). Les anciens cerveaux (v2…)
lisent simplement le début de l'observation, dans l'extension comme dans le réseau Python.
L'extension (0.6.0) affiche aussi « Rival à la prochaine vague » à côté de la décision.

## 4. Les fuites de mémoire, pour de bon

Méthode : compter les objets vivants par classe en fin de partie (`PONT_COMPTAGE=1`, avec
l'inspecteur de Node), puis prendre une **photo de la mémoire** au début d'une partie
(`PONT_INSTANTANE`) : à ce moment, tout Pokémon encore en mémoire appartient à une partie finie.
Le plus court chemin depuis les racines jusqu'à lui montre qui le retient.

Retenteurs trouvés et vidés par `menageEntreParties` (fin de partie et début de la suivante) :
le terrain, les cadres d'info et toute l'interface (conteneurs simulés qui gardent les objets
détruits, dont les options de récompense de chaque vague), le gestionnaire des étincelles, la
table d'animation des icônes de l'écran d'équipe, et la file d'animation que rien ne traite sans
écran. Le nombre de Pokémon en mémoire suit désormais la partie en cours au lieu de grimper (de 67
à 682 en 14 parties avant).

Il reste une petite fuite (textes enrichis retenus par la réserve de canevas de Phaser, ~5-10 Mo
par longue partie), qu'on ne peut pas vider sans risque : les copies redémarrent toutes les
30 parties.
