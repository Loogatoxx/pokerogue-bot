# Étape 7 — Un coup d'avance : prévoir l'IA adverse (01/10/2026)

Idée de Carlos : « le facteur clé pour gagner, c'est d'anticiper l'IA adverse. Elle est souvent
trop dans la super efficacité et le changement de Pokémon ; elle ne bluffe jamais. Comme aux
échecs : analyser aussi les positions futures, et parfois ne pas prendre la meilleure attaque pour
la situation actuelle, mais pour la suivante. »

## Ce que fait vraiment l'IA adverse

Lu dans le jeu (`EnemyPokemon.getNextMove`, `EnemyCommandPhase`, `jeu/docs/enemy-ai.md`) :

1. **L'ordre du tour joue pour nous** : tu donnes ton ordre (`CommandPhase`), puis l'adversaire
   choisit le sien (`EnemyCommandPhase`) contre le Pokémon **actuellement** en face de lui. Ton
   changement n'a lieu qu'au début du tour : son attaque, choisie pour l'ancien, frappe le nouveau.
2. **Une attaque qui met K.O. passe avant tout.**
3. **Le score** d'une attaque offensive : `(±2 × bonus de stat + puissance / 5) × efficacité ×
   1,5 si même type` (+2 si super efficace, −2 sinon) : il adore le super efficace.
4. **Le choix** : dresseurs et boss prennent presque toujours la meilleure (la 2e avec une chance
   proportionnelle au rapport des scores) ; un sauvage prend la meilleure 5 fois sur 8.
5. **Les changements** (dresseurs) : seulement si un autre de ses Pokémon a un « score de duel »
   3 fois meilleur (2 fois pour les champions).

## Le prédicteur (`observateur/prevision.ts`)

Il refait ce calcul avec ce qu'un joueur voit : attaques déjà vues, attaques possibles à son
niveau (Pokédex, étape 5), statistiques estimées (IV moyens, nature neutre) — jamais son vrai jeu
d'attaques. Pour chaque adversaire : la probabilité de chacune de ses attaques probables, le
risque de super efficace et de K.O. sur le Pokémon visé, **ce qu'encaisserait chaque membre de
l'équipe s'il entrait** (le jeu de prédiction), ce que mes attaques font à ses PV restants, et qui
frappe en premier.

Mesuré en jouant (récit de partie, 160 parties, 12 250 coups adverses, v3) :

| | |
|---|---|
| attaque annoncée exactement (1er choix) | **65 %** des attaques offensives |
| bon type annoncé | 74 % |
| probabilité donnée au vrai coup | 58 % en moyenne |
| attaque jamais envisagée | 4,3 % |
| l'adversaire change de Pokémon | 2,8 % des coups |
| l'adversaire utilise une attaque de statut | 12,5 % |

C'est presque le maximum possible : un sauvage tire lui-même sa meilleure attaque 5 fois sur 8.

- **Encodage v5** (+66 nombres) : cette prévision, pour les deux places adverses.
- **Panneau 0.8.0** : « Va sans doute utiliser : Flammèche (63 %) · super efficace · Carapuce
  l'encaisserait mieux ».

## Entraînement 7, et une récompense qui trompait

L'entraînement 7 (ciblé, depuis la v3) a fait moins bien que la v3 : 25,2 contre 27,4 (160
parties, starters au hasard). Comme l'entraînement 6. Point commun des deux, absent du 5 qui était
stable : **la récompense de chaque remplacement** (~9 par partie, jusqu'à +4,5 points face à ~27
points de vagues). Le cerveau était payé pour remplacer, pas pour gagner ; or c'est la note
d'équipe qui décide déjà qui garder. Désormais `capture_remplacement = 0` (réglable), et le pas
d'apprentissage passe de 0,00025 à 0,0001 pour affiner un cerveau déjà correct sans le dérégler.

## Entraînement 8

Départ : v3 greffée sur l'encodage v5 (`cerveaux/v3-greffe-prevision`), entraînement ciblé
(une partie sur deux repart d'une photo), 10 copies, 2 heures.

## Plus tard : chercher plusieurs coups à l'avance

La prévision donne au cerveau « un coup d'avance ». La suite naturelle de l'idée de Carlos est
une vraie recherche, comme un moteur d'échecs : simuler chaque action possible avec ce modèle de
l'IA adverse et de la formule de dégâts, sur deux ou trois tours, et garder le meilleur chemin.

## État à la pause (01/10)

Entraînement 8 arrêté à la demande de Carlos (il avait besoin de la machine) à la mise à jour
123, cerveau sauvegardé. Pas encore évalué. Remarque de Carlos : la barre des 30 vagues est
atteinte très difficilement — à revoir ensuite. Reprise :
`.venv/bin/python -m entraineur.entrainer --reprendre /Volumes/Lexar/pokerogue-bot/entrainements/entrainement-8 --minutes 120 --simulateurs 10`
