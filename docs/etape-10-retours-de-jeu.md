# Étape 10 — Ce que Carlos a vu en regardant jouer la v4 et la v5 (01/10/2026)

Carlos a regardé le mode auto dans Brave jusqu'aux vagues 41, 60 et 66. Ses remarques, et ce qui
a été fait pour chacune.

## « Il s'acharne avec des Poké Balls alors que l'équipe est pleine »

> « Il s'acharne avec des Poké Balls sur un Pokémon alors qu'il a déjà toute l'équipe de 6 ; il
> n'a pas fait le lien que si on affaiblit un Pokémon il a plus de chances de le capturer ; mes
> Pokémon meurent un à un pour rien. » — « Vague 60, il essaie de capturer des Pokémon et
> l'équipe meurt un à un. »

**Cause.** Le planificateur donnait aux Balls la valeur de la meilleure attaque : c'était le
cerveau seul qui choisissait, et il a appris que capturer rapporte. Il ne voyait ni l'inutilité
d'une capture avec l'équipe pleine, ni le prix d'une Ball ratée (un coup reçu pour rien).

**La règle demandée par Carlos**, puis mesurée (v5 ; « court » = 240 parties arrêtées à la
vague 26, « 50 » = 480 parties arrêtées à la vague 50) :

| Version | Mesure | Vague moy. | Rival 1 | Rival 2 | Remarque |
|---|---|---|---|---|---|
| Avant | court | 23,8 | 91 % | 72 % | PV de l'équipe au rival 1 : 98 % |
| Règle complète : utile, sans risque, affaiblir, jamais en pleine forme | court | 20,1 | 76 % | 55 % | PV au rival 1 : 83 % (gagnés) / 70 % (perdus) |
| Pareil, seulement équipe pleine | court | 21,2 | 85 % | 50 % | |
| Interdire toute Ball inutile ou dangereuse | court | 23,3 | 91 % | 67 % | |
| Pareil | 50 | 33,7 | 90 % | 67 % | boss des vagues 20 et 50 : 87 défaites (avant : 52) |
| **Retenue : Ball inutile ou dangereuse interdite si sa chance est sous 50 %** | 50 | **35,1** | **91 %** | **70 %** | référence remesurée : 35,9 / 92 % / 68 % |

Ce que les mesures ont appris :
- **Affaiblir avant de capturer** allonge chaque combat : l'équipe encaisse plus de coups et arrive
  blessée au rival. Les sauvages du début entrent souvent dans une Ball même en pleine forme (une
  chance sur deux pour un taux de capture de 255).
- **Capturer avec l'équipe pleine** améliore l'équipe en début et milieu de partie (les membres
  faibles sont remplacés).
- **Capturer un boss affaibli termine le combat** : interdire toute Ball contre un Pokémon
  dangereux faisait perdre contre les boss.

**Retenu** (`observateur/planificateur.ts`) : une Ball vaut une Ball ratée (le coup encaissé pour
rien) quand sa chance est sous 50 % **et** qu'elle est **inutile** — équipe pleine, espèce qui ne
dépasse pas la plus faible des six d'au moins 30 points de potentiel — **ou dangereuse** — le
sauvage met mon Pokémon K.O. en moins de 3 tours, ou je perds le duel (le « Mewtwo » de Carlos :
on le bat, on ne joue pas avec lui). C'est exactement le cas vu en jeu : des Balls à faible chance
pendant que l'équipe tombe. La Master Ball est réservée aux espèces d'exception (potentiel ≥ 580)
et aux boss. Sinon, le cerveau choisit.

En récompense, des Balls valent beaucoup moins quand l'équipe est pleine (×0,2 au lieu de ×0,5).

## « Plus d'argent pour ranimer le porteur (Zacian) »

> « Morte vague 66 contre un dresseur, plus d'argent pour la boutique pour ranimer le porteur. »
> « Après la boutique il doit tout dépenser. »

La boutique vend un Rappel dès la vague 1 (2 fois le prix de base). Le bot achetait des Potions
dès qu'un membre était blessé, jusqu'à 6 articles, sans réserve. **Désormais**
(`observateur/objets.ts`, `evaluerAchats`) : à partir de la vague 30, un achat qui ferait passer
l'argent sous le prix d'un Rappel est fortement pénalisé (sauf Rappels, Cendres Sacrées et Total
Soin), hors veille d'un combat important. Essayée dès la vague 1 : l'équipe n'achetait plus de
Potions avant le rival 1 et arrivait blessée.

## « En 2 contre 2, il n'a pas sorti un Pokémon faible face aux deux »

Le planificateur ne comptait, pour une attaque, que les coups de l'adversaire visé ; pour un
changement, le pire des deux duels. Rester paraissait donc toujours moins risqué. **Désormais**
(`degatsDesAutres`) : rester, c'est encaisser les coups des deux adversaires ; le remplaçant aussi.

## « Le porteur réanimé, il ne le joue plus pour le monter »

Découverte en lisant le jeu : au début de **chaque vague contre des sauvages**, le style de combat
« Changer » demande « Changer de Pokémon ? », l'adversaire déjà visible — un changement **gratuit**.
Le pilote répondait toujours non. **Désormais** (`changerAuDebut`, pilote) : oui si un membre du
banc fait nettement mieux que celui en place, et le porteur (le plus haut niveau) passe devant
quand il gagne son duel (`BONUS_PORTEUR`), pour qu'il continue de monter. Le simulateur joue en
style « Fixe » par défaut ; `--style changer` dans `analyse_defaites` mesure ce cas.

## L'entraînement, la courbe et le cerveau le plus fort

- La courbe qui « monte à 60 puis redescend » : la fenêtre des 200 dernières parties repartait vide
  à la reprise (moyenne sur quelques parties) ; corrigé. Les cerveaux de l'entraînement 9 évalués
  sur 480 parties (meilleur coup) : 103 → 36,6 ; **130 → 37,7** ; 150 → 36,2 ; 170 → 36,4
  (v4 : 35,6). Pas de recul : un plafond.
- **v5** = cerveau 130, publiée et désignée « Le plus fort » sur le tableau de bord (bouton
  Télécharger, à importer dans Brave).
- L'entraînement s'était arrêté sur une coupure du Lexar : les écritures réessaient maintenant.
- Les analyses redémarrent les copies du jeu comme l'entraînement (elles figeaient sur les longues
  parties).

## Le changement gratuit, mesuré

Style « Changer » (comme dans le vrai jeu), 480 parties : 1 754 changements en début de vague,
aucun blocage ; 35,5 / rival 1 92 % / rival 2 69 % (style « Fixe » : 35,1). Neutre jusqu'à la
vague 50 ; son intérêt (le porteur qui continue de monter) compte surtout plus loin.

## « Il bloque encore sur les PNJ qui proposent des objets »

Nouvel outil : `entraineur/tester_mysteres.py` force chacune des 31 rencontres mystères (option
`mystere` du simulateur) et joue quelques parties avec le cerveau et le pilote du mode auto.
Résultat : 28 passent ; **Delibird-y** (le PNJ qui demande des objets) fige la copie du jeu, et
Fun and Games et la Zone Safari ont bloqué une fois sur deux. À corriger (étape suivante).

## Statuts et Total Soin

Mesuré (160 parties, nouveaux compteurs `achats`, `recompenses`, `statuts` du simulateur) : un
membre a un problème de statut au début de 4 % des vagues seulement (le porteur : 1,7 %), et le
Total Soin est acheté (52 fois) quand il est en vente (dès la vague 21). Les statuts sont aussi
soignés à chaque changement de biome. Rien à corriger pour l'instant.
