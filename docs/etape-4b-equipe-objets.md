# Étape 4b — Juger l'équipe et les objets comme un tout (30/09/2026)

Demande de Carlos : comme pour les attaques, évaluer **l'ensemble**, pas chaque élément seul
(« pas de doublons »), et faire pareil pour les objets.

## Note d'équipe (`observateur/equipe.ts`)

Quand une capture réussit avec l'équipe pleine, le pilote compare « ne pas garder le nouveau »
et « remplacer X par le nouveau » pour chacun des six :

| Critère | Ce qu'il mesure |
|---|---|
| Couverture offensive | contre chacun des 18 types, la meilleure attaque de l'équipe (stats réelles) |
| **Profondeur** | la force moyenne de chaque membre : ils tombent l'un après l'autre, chacun doit tenir |
| Défense | pour chaque type d'attaque, quelqu'un qui y résiste |
| Faiblesses empilées | trois membres ou plus qui craignent le même type |
| Doublons | types partagés entre membres, et pire, deux fois la même espèce |
| Solidité | PV, Défense, Défense Spé. (valeurs réelles) |

La profondeur a été ajoutée après un test sur le vrai jeu : sans elle, la note remplaçait un
Salamèche niveau 50 (qui « doublonnait » Reptincel) par un Pikachu niveau 5.

## Note des objets (`observateur/objets.ts`)

Chaque récompense est notée d'après l'état de l'équipe, avec son meilleur receveur :
Potion selon les PV qui manquent (0 si tout le monde est en forme), Rappel si un membre
important est K.O., CT par la note de synergie des attaques, objet de type pour qui a ces
attaques, Poké Balls selon le stock et la place dans l'équipe… Les receveurs possibles viennent
**du filtre du jeu lui-même** (celui qui affiche « ça n'aura aucun effet »). Les valeurs de base
(`VALEURS`) sont un point de départ réglable.

## Le pilote dans l'écran d'équipe

Un test de 64 parties a révélé que le pilote appuyait deux fois de suite sur Valider, à
l'aveugle : quand un message s'affichait par-dessus l'écran d'équipe, il le rejouait à chaque
instant (jusqu'à 991 « relâcher » !) ou ouvrait le Pokédex par erreur. Désormais : **une touche par
passage, selon l'état de l'écran** (message → valider ; menu d'options → viser l'option par son
code : Envoyer, Relâcher, Appliquer ; liste → choisir la place), et les écrans ouverts par
erreur (Pokédex, renommer) sont refermés.

Résultat sur 64 parties : 0 blocage, « bonus inutilisables » 780 → 0, un relâcher par
remplacement (37/37).

## Robustesse de l'entraînement

- **Côté jeu** : si rien n'avance pendant 60 s sans attendre le cerveau, la partie s'arrête en
  notant l'écran bloqué (au lieu d'attendre 30 min).
- **Côté Python** : une copie du jeu muette 10 min est redémarrée, la partie comptée comme
  perdue, et l'entraînement continue (au lieu de rester figé, comme l'entraînement 2 à la fin).

## Dans l'extension (0.4.0)

Nouvelle décision « Équipe pleine : qui garder ? » et récompenses notées, chacune avec sa note,
ses pour et ses contre, et la recommandation du pilote.

## Résultat : la v2

Cerveau de l'entraînement 2 (capture, mise à jour 90), évalué avec les nouvelles règles
d'équipe et d'objets :

| Cerveau | Vague moyenne (meilleur coup) | Tirage | Record |
|---|---|---|---|
| v1 | 8,4 | 8,6 | 19 |
| **v2** | **17,9** (22,4 après correction ci-dessous) | 18,8 | **66** |

Le bond vient autant de la capture (apprise pendant l'entraînement 2) que des notes d'équipe
et d'objets (appliquées seulement à l'évaluation) : le cerveau a été entraîné avec les
anciennes règles.

**Refus silencieux** : une partie de l'évaluation a tourné 30 minutes en boucle. Le cerveau
choisissait 33 333 fois le même remplaçant, que le jeu refusait sans le dire. Désormais, si la
même décision revient après qu'une action a été jouée, cette action est interdite pour cette
décision (simulateur et extension). Revérification : 32 parties, 0 erreur, 178 décisions au plus.
