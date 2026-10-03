# Étape 13 — Le rival 1, décision par décision (02-03/10/2026)

Consigne de Carlos : travailler en autonomie, ne jamais conclure « l'adversaire était trop fort »
ou « c'était serré », chercher la décision qui a plombé la partie ; objectif minimal : passer le
rival 1 à 100 %. Son indice : rejouer la graine d'une partie perdue « parfaitement » pour savoir si
elle était gagnable, puis chercher d'où vient l'erreur.

## 1. Pourquoi on perdait (5 758 combats au rival 1)

Le rival tire son starter **au hasard** (Plante, Feu ou Eau ; jeu : `rival-team-gen.ts`).

| Son starter face à notre premier Pokémon | Défaites |
|---|---|
| notre type bat le sien | 1,3 % |
| neutre | 4,7 % |
| **son type bat le nôtre** | **15,4 %** (les trois quarts des défaites) |

Ce qui compte au début du combat (quand son starter nous contre) : un membre de niveau 5 ou plus
qui bat son type (7 % de défaites, sinon 26 %) ; le 2e membre au niveau 6 ou plus (9,5 % contre
16,8 %) ; le porteur à moins de 70 % de PV (34 %).

## 2. Les parties perdues étaient gagnables

`entraineur/rejouer_defaites.py` : le professeur rejoue 24 parties perdues au rival 1 (même graine,
mêmes starters, donc mêmes rencontres) : **24 sur 24 gagnables**.

`entraineur/diagnostic_vague.py` : le cerveau rejoue la partie jusqu'au rival, puis le combat est
rejoué 8 fois depuis son équipe. À ces niveaux, le combat est presque déterministe (8 sur 8 ou 0
sur 8). Sur 24 graines : 12 fois le cerveau gagne cette fois (l'équipe arrivée est différente) ;
**8 fois son meilleur coup perd alors que d'autres coups gagnent** (combat mal joué) ; 4 fois rien
ne gagne (équipe déjà condamnée).

Coup par coup, les combats mal joués : attaque du même type que lui mais résistée (Flammèche sur
Salamèche, Pistolet à O sur Grenousse, Fouet Lianes sur Chochodile) au lieu d'une attaque neutre
plus forte, et des changements de Pokémon jamais tentés. Le planificateur préférait souvent la
bonne attaque, mais d'un cheveu : quand le duel est perdu, toutes ses options valent environ −1 et
le cerveau tranchait seul.

## 3. Ce qui n'a pas suffi (rival 1, 960 parties chacun, style Changer)

| Essai | Rival 1 |
|---|---|
| Référence | 92-94 % |
| « Second combattant » : faire monter avant la vague 8 le membre qui bat ce qui contre le porteur | 94 % |
| Dégâts d'un duel perdu comptés double | 94 % |
| Le planificateur décide seul (poids 1000) | 92 % |
| Pénalité d'une attaque plus faible ×5 | 94 % |
| Couverture des types de starter dans la note d'équipe et les captures | 94 % |

## 4. Le moteur de combat d'équipe (`observateur/combat-equipe.ts`)

Le planificateur jugeait un duel à la fois. Le moteur simule **le combat entier, équipe contre
équipe**, pour chaque coup possible : dégâts moyens × précision, ordre par la vitesse, le coup que
l'IA adverse jouera (le K.O. d'abord, sinon les plus gros dégâts), nos remplaçants (celui qui gagne
son duel), les Pokémon du dresseur déjà vus et ceux qui restent (Pokémon de même force, sans type
connu). Rien que ce qu'un joueur sait.

| Essai (contre les dresseurs) | Rival 1 | Défaites quand il nous contre |
|---|---|---|
| Moteur mêlé au cerveau à poids égal | 91 % | 15,5 % |
| **Moteur qui décide, le cerveau départage les égalités** | **96 %, 96 %, 96 %** | **4,5 à 7,3 %** |

Le cerveau, entraîné avec l'ancien planificateur, gâchait les décisions du moteur : ses valeurs
sont maintenant amplifiées (× 30) contre les dresseurs. Actif par défaut (simulateur et extension).

## 5. Les corrections qui ont suivi (03/10)

**Le moteur s'est trompé là où il ne voyait rien.** Comparaisons coup par coup des combats encore
perdus : sans la **priorité**, un Pokémon lent qui tombe d'un coup « ne fait rien », toutes ses
attaques ont la même valeur et le cerveau prenait au hasard (parfois Mimi-Queue). Ajouts : la
priorité de chaque attaque (table `observateur/priorites.ts`, générée du jeu), Bluff et Escarmouche
seulement au premier tour, un départage des égalités (dégâts immédiats, puis le remplaçant le plus
solide), les **barres des boss** (un coup ne brise qu'une barre sauf gros surplus : vague 50,
48 défaites → 31). Le moteur choisit aussi le remplaçant après un K.O.

**Un bug qui coûtait le porteur.** En capturant avec l'équipe pleine juste avant le rival, le bot
relâchait parfois **son porteur** (le plus haut niveau) : 2 % des parties avant ce soir, 5 à 10 %
avec la couverture des starters (rapportée au plus haut niveau de l'équipe jugée, elle montait
quand le porteur partait). Désormais : jamais le porteur ; à l'approche d'un rival, chaque niveau
perdu coûte 3 points ; la couverture se rapporte au niveau de l'équipe d'origine. Résultat : 0
porteur perdu sur 960 parties.

**Le niveau du porteur décide presque tout au rival 1** (1 919 parties) :

| Niveau du porteur | 5 | 6 | 7 | 8 | 9 | 10+ |
|---|---|---|---|---|---|---|
| Défaites | 20 % | 15 % | 5 % | 2 % | 1 % | 0 % |

Avant le rival 1, le porteur garde donc l'expérience : pas de changement gratuit tant qu'il gagne
son duel, plus de rotation du second (les changements partageaient l'expérience : 0,4 à 0,65
changement en combat dans les parties à porteur faible, 0,15 sinon). Super Bonbon au porteur noté
50 quand le rival approche (le bot préférait 5 Poké Balls).

| Version (960 parties, arrêt après le rival 1) | Rival 1 |
|---|---|
| Début de la nuit | 92-94 % |
| Moteur d'équipe | 96 % (×4) |
| + priorité, départage | 95 % |
| + le porteur garde l'expérience | 97 %, 96 % |
| + jamais relâcher le porteur | **97 %** |
| essai : second monté au niveau 5 seulement | 96 % (écarté) |

Ce qui reste au rival 1 (24 défaites sur 960) : quand son starter contre notre porteur **et** que
personne de niveau 5+ n'a le type qui bat le sien (17 des 24).

**Toute la partie, arrêt à la vague 50 (480 parties)** : **39,6** de vague moyenne (35,9 à 38,0
dans les mêmes conditions avant), rival 1 97 %, rival 2 76 %.
