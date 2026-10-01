# Étape 9 — Juger le top 3 des coups adverses, prévoir les changements (01/10/2026)

Deux idées de Carlos, à la suite du rapport sur le rival :

1. « Que le choix ne soit pas radical : évaluer avec une formule mathématique la décision pour
   l'ensemble du top 3 des coups de l'ordi, pas seulement le coup prévu. »
2. « C'est la base de la prédiction : savoir quand ils changent de Pokémon. »

## 1. Le top 3 des coups adverses (option `scenarios`)

Le planificateur joue chaque coup possible de l'adversaire (top 3 du prédicteur), puis combine :
espérance (somme des valeurs × probabilités : l'« expectimax » des moteurs de jeu face au hasard)
moins une part de prudence (`prudence`) qui rapproche du pire scénario plausible (≥ 10 %).

| v4, 160 parties | Vague moyenne |
|---|---|
| Dégâts moyens (ce qui existait) | 38,8 |
| Scénarios, espérance seule | 36,4 |
| Scénarios, prudence 0,3 | 34,5 |

Option gardée mais désactivée par défaut (`planScenarios`, `planPrudence`). Prudence : la mesure
de référence (38,8) s'est révélée chanceuse (voir le bruit plus bas) ; l'écart réel est plus petit.

## 2. Prévoir quand il change de Pokémon

### La règle du jeu (`EnemyCommandPhase`, `getMatchupScore`)

Seuls les **dresseurs** changent. À chaque tour, le jeu calcule un **score de duel** pour son
Pokémon actuel contre le nôtre, et pour chaque membre de son banc :

    score = (attaque moyenne + défense) × facteur de PV et de vitesse
    attaque = moyenne de (efficacité × 1,5 si même type) de ses attaques offensives
    défense = 1 / efficacité de nos types sur lui (au plus 4)

Il change si un membre du banc fait **3 fois mieux** (2 fois pour un dresseur « boss »), et le
jeu freine les changements répétés dans un même combat.

### Ce qu'un joueur peut savoir

Un joueur ne connaît du banc que les Pokémon déjà vus (on les retient désormais : `carnet.bancVu`,
champ `banc` de l'observation, version 5). Premier essai, avec le banc vu seulement :
**12 % des changements annoncés**. La raison, mesurée : **89 % des changements se font vers un
Pokémon encore jamais vu**.

Mais un joueur voit les Poké Balls qui restent au dresseur, et la position de son Pokémon actuel.
Mesuré sur 6 865 décisions de dresseurs, quand il lui reste un Pokémon jamais vu :

| Score de duel de son Pokémon actuel | Il change |
|---|---|
| sous 0,4 | 92 % |
| 0,4 à 0,6 | 79 % |
| 0,6 à 0,8 | 68 % |
| 0,8 à 1,0 | 53 % |
| 1,0 à 1,5 | 12 % |
| au-dessus de 1,5 | 2 % |

`prevoirChangement` (`observateur/prevision.ts`) suit cette courbe ; si un membre déjà vu remplit
la règle du jeu, il annonce ce Pokémon (juste 7 fois sur 10). Résultat sur 480 parties :
**61 % des changements annoncés** (avant : 12 %), et **7 annonces sur 10 justes**. Le panneau de
l'extension (0.9.4) affiche « Va sans doute changer de Pokémon (n %) pour X / pour un Pokémon pas
encore vu ».

### S'en servir dans le planificateur (option `changements`)

S'il change, mon attaque frappe l'arrivant et je ne reçois rien ce tour-ci ; si je change aussi,
mon remplaçant affronte l'arrivant. La valeur de chaque option devient
(1 − p) × valeur « il reste » + p × valeur « il change ». Un arrivant inconnu est joué comme un
Pokémon de même force, en pleine forme, de types inconnus.

### Le bruit des mesures

Les parties n'ont pas de graine fixe : la même mesure sur 160 parties a donné 38,8, 34,8, 34,9 et
37,0. Il faut 480 parties pour distinguer un écart d'environ 1,5 vague.

| v4, 480 parties, arrêt à 50 | Vague moyenne | Rival 1 | Rival 2 |
|---|---|---|---|
| Référence (sans prévoir les changements) | 35,6 | 90 % | 73 % |
| Changements, arrivant inconnu = valeur neutre | 36,2 | 91 % | 68 % |
| Changements, arrivant inconnu = Pokémon de même force | 36,0 | 90 % | 71 % |

**Aucun gain mesurable.** L'explication se lit dans la règle du jeu : l'IA change quand **son**
Pokémon est en mauvaise posture, c'est-à-dire quand on gagne déjà l'échange. Dans les combats
perdus contre le rival, il change aussi souvent que dans les combats gagnés (7,2 % de ses coups
contre 6,8 % au rival 2) : nos défaites viennent des tours où il **reste** et frappe fort.

Option gardée, désactivée par défaut (`planChangements` ; `--changements` dans
`analyse_defaites`) ; la prévision reste affichée dans le panneau et mesurée dans chaque analyse.
