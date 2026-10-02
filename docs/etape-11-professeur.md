# Étape 11 — Le professeur qui « triche », et les dernières rencontres qui bloquaient (02/10/2026)

## L'idée de Carlos

> « Si rien ne marche, une chose que j'autorise pour l'entraînement de l'IA est de tricher : lui
> montrer des runs parfaites, et elle essaiera de les reproduire. Vu qu'on peut recommencer une
> même seed à l'infini, elle prendra exemple sur le parfait au lieu d'avancer seule. »
> « Chaque seed est gagnable, sauf de rares cas au début, contre le dresseur de la vague 8. »

C'est une méthode connue : l'**apprentissage par imitation d'un professeur** (proche de
l'« expert iteration » d'AlphaZero). Le professeur a le droit de recommencer ; l'élève, non. En
jeu, le cerveau ne voit toujours que ce qu'un humain voit : la triche ne sert qu'à l'entraînement.

## Le professeur (`entraineur/professeur.py`)

1. Le simulateur photographie le début de chaque vague (la sauvegarde du jeu) et sait en repartir.
2. Chaque vague est rejouée 8 fois depuis sa photo : une fois avec le meilleur coup du cerveau
   (guidé par le planificateur), les autres en tirant au sort parmi les coups proches du meilleur
   (« température » 3, 5 ou 10 : les scores divisés par ce nombre, donc des probabilités plus
   étalées). Sans température, le planificateur (poids 30) faisait jouer presque toujours le même
   coup : les essais ne différaient que par la chance.
3. On garde l'essai gagnant qui laisse l'équipe la plus forte (PV restants pondérés par le niveau,
   et les niveaux gagnés), et on repart de sa photo de la vague suivante.
4. **Les murs.** Premier essai : chaque partie gagnait 8 essais sur 8 presque partout, puis 0 sur 8
   d'un coup (rival 1, boss de la vague 20, rival 2…). Ce sont de vraies défaites : le mur se perd
   avant, dans ce qui a construit l'équipe. Le professeur **recule** alors, comme un joueur qui
   recharge une sauvegarde plus ancienne : la vague d'avant avec son 2e ou 3e meilleur essai, puis
   encore avant (jusqu'à 8 vagues, 10 retours par mur et 40 par partie), avec deux fois plus
   d'essais sur la vague du mur.
5. Les décisions de l'essai gardé à chaque vague sont enregistrées (observation → action), une
   partie par fichier `.npz` sur le Lexar (`professeur/<date>/`).

Premier essai (7 parties, 6 essais par vague, arrêt à la vague 60) : **7 sur 7 au bout**, rivaux 1
et 2 passés à 100 % (le cerveau seul : environ 45 % des parties atteignent la vague 50). Quatre
parties sans aucun mur ; les autres ont reculé 3 à 5 fois (rival 1, rival 2, vague 60).

Limite connue : chaque essai a son propre hasard ; garder le meilleur, c'est aussi garder un peu de
chance (un coup critique). Les règles du pilote (récompenses, attaques apprises, membre relâché)
ne varient pas d'un essai à l'autre : le professeur n'améliore que les combats et les captures.

## L'élève (`entraineur/imitation.py`)

Le cerveau v5 apprend à refaire les choix du professeur : pour chaque situation, la perte
d'entropie croisée le corrige d'autant plus qu'il donnait une faible probabilité au coup du
professeur. Il reste guidé par le planificateur (scores + 30 × plan), comme en jeu. Une partie sur
dix est mise de côté pour mesurer l'accord avec le professeur sans apprentissage par cœur.

## Les rencontres mystères qui bloquaient

Un garde-fou dans le simulateur (3 000 actions du pilote d'affilée sans décision du cerveau → la
partie s'arrête en erreur, avec les dernières actions) et une trace au fil de l'eau ont montré :
- **Delibird-y** : il faut choisir un Pokémon qui tient certains objets ; le pilote prenait le
  premier venu, refusé, puis le reprenait à l'infini. Il lit maintenant le filtre de l'écran du jeu.
  Le test, qui force la rencontre à chaque vague, finit par la proposer sans aucune option
  possible (plus d'argent ni d'objets) ; le vrai jeu ne la propose pas dans ce cas.
- **Zone Safari** : capture avec l'équipe pleine ; la 1re option (« voir le résumé ») était
  validée en boucle. La note d'équipe décide maintenant aussi dans les rencontres.
- **Fun and Games** : le menu des attaques se rouvrait aussitôt ; après trois retours sans effet,
  le pilote lance la première attaque.

Test complet des 31 rencontres : 30 passent ; Delibird-y seulement dans le cas impossible du test.
Extension 0.9.6.

## Premier grand passage (02/10, interrompu à la demande de Carlos)

10 parties, 8 essais par vague, sans limite : **vague moyenne 109,9**, rival 1 passé à 100 %,
rival 2 à 90 %, aucune au bout. Murs finaux : 25, 50, 98, 110, 114, 114, 114, 115, 164, 195 — les
boss des vagues 110-115 surtout. 4 142 exemples enregistrés (`professeur/2026-10-02-08h44/`).
Pour comparer : la v5 seule fait 35,5 en moyenne avec un arrêt à la vague 50.

## Première imitation : rien de gagné (02/10, soir)

44 parties du professeur (15 761 exemples, dont 5 279 « décisifs » : l'essai gardé battait le
meilleur coup du cerveau). Élève entraîné 6 passages : l'accord avec le professeur sur les parties
mises de côté ne monte pas (coups décisifs : 67,7 % → 67,5 %). Mesure, 480 parties, style Changer :

| Cerveau | Vague moy. (arrêt à 50) | Rival 1 | Rival 2 |
|---|---|---|---|
| v5 | 37,2 | 95 % | 73 % |
| Élève v1 | 36,1 | 93 % | 70 % |

**Pourquoi** : dans un essai qui a gagné une vague, quelques coups ont compté, les autres étaient
tirés au hasard ; en imitant l'essai en bloc, l'élève apprend surtout ce bruit.

## Le juge de coups (`entraineur/juge.py`)

Juger **chaque décision** séparément :
1. Le simulateur garde le hasard du jeu (`hasardDuJeu`) : une vague rejouée avec les mêmes coups
   donne exactement les mêmes situations (vérifié) ; et il sait changer la graine du combat en
   pleine vague (même situation, autre avenir).
2. Le cerveau joue sa partie. À chaque décision des combats contre un dresseur ou un boss (et une
   sur quatre ailleurs), ses 3 coups les plus probables sont rejoués à l'identique jusqu'à cette
   décision, puis la vague est finie sur 3 avenirs différents. Le coup qui laisse en moyenne
   l'équipe la plus forte devient l'exemple ; son poids dépend de l'écart avec le coup habituel.
3. Les situations viennent des parties du cerveau lui-même (méthode « DAgger ») : il apprend là
   où il se trompe vraiment.

Premier essai (4 parties jusqu'à la vague 30) : 25 à 52 décisions jugées par partie, environ un
quart corrigées.

## Premier élève du juge (02/10, 20 h 45)

40 parties jugées : 4 180 décisions, dont un tiers corrigées (environ 500 corrections nettes).
L'élève refait 23 % des corrections sur des parties qu'il n'a jamais vues (0 % au départ) : il
généralise. Mesure, 480 parties, style Changer : **36,7, rival 1 92 %, rival 2 73 %** (v5 :
37,2 / 95 % / 73 %) — jeu égal. Il faut beaucoup plus d'exemples : le juge tourne en continu
(`juge/2026-10-02-20h50`), et l'imitation sait doser les confirmations (`--poids-confirmation`).
