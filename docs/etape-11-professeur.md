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
   encore avant (jusqu'à 6 vagues, 12 retours par partie).
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
