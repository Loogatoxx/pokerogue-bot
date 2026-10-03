# Étape 15 — Mesurer juste, puis chercher la vraie cause (03/10/2026)

Suite de la demande de Carlos : « l'entraîner sur la fin de partie pour qu'elle réussisse la vague
200 le plus souvent possible […] même avec des légendaires, elle avait du mal vers la vague 110 ».

## 1. Le hasard caché du simulateur

En rejouant la même graine pour comprendre une défaite, la même partie a fini aux vagues 15, 25,
66 puis 90. L'outil de test du jeu tirait la nature, le talent et la variante chromatique des
starters **sans graine**. Ces valeurs dépendent maintenant de la graine
(`simulateur/outils-partie.ts`) : rejouer une graine rejoue exactement la même partie (vérifié :
trois rejeux, trois fois la même vague).

À retenir : une différence de nature sur les starters suffisait à faire varier la vague atteinte
de 15 à 90. Une partie isolée ne prouve rien ; il faut des centaines de parties, les mêmes d'une
version à l'autre.

## 2. Le banc apparié (`entraineur/banc_complet.py`)

**Mesure appariée** : chaque version du code rejoue les mêmes 480 parties. Chaque partie a sa
graine (« complet-k »), son trio Plante/Feu/Eau tiré avec k, et le hasard du jeu est fixé. Tant que
deux versions prennent les mêmes décisions, la partie est identique. La différence vient donc des
seules décisions changées.

- Avant : ±2 vagues de bruit sur 480 parties (deux mesures du même code : 57,7 et 56,9).
- Maintenant : ±0,6 à ±1,3 vague sur la différence entre deux versions.

```
.venv/bin/python -m entraineur.banc_complet --nom essai
.venv/bin/python -m entraineur.banc_complet --comparer essai reference
.venv/bin/python -m entraineur.banc_complet --nom si-xxx --objets EXP_SHARE EXP_SHARE   # « et si… »
.venv/bin/python -m entraineur.banc_complet --nom trio --trio 656 653 906               # starters imposés
```

Pour chaque partie, le banc garde aussi :
- les niveaux de l'équipe à chaque vague ;
- la défaite détaillée ;
- les récompenses proposées et celles qui ont été prises.

`diagnostic_vague.py --banc <nom> --vague V` rejoue les défaites d'un banc.

## 3. Le diagnostic « et si… » : la vraie cause

Le simulateur peut donner des objets au départ (`--objets`). C'est de la triche, permise à
l'entraînement pour **mesurer ce que vaudrait un levier avant d'y investir**.

**5 Multi Exp au départ**, pour que tout le banc gagne autant d'expérience que le porteur.
Résultat sur 274 parties appariées : **+36,5 vagues** (55,1 → 91,6 ; 90 parties sur 274 passent
la vague 100, contre 40 sur 476).

| Mur | Défaites (référence) | Défaites (banc au niveau) |
|---|---|---|
| Rival 2 (25) | 25 % | **0 %** |
| Champion (30) | 10 % | 0 % |
| Vague 50 | 12 % | 0 % |
| Admin (66) | 24 % | 11 % |
| Vagues 80 / 90 / 95 | 22 / 23 / 45 % | 19 / 25 / 28 % |
| Vagues 110 / 114 | 57 / 83 % | 35 / 73 % |

La cause principale des défaites jusqu'à la vague 66 est donc **la profondeur de l'équipe**, pas le
porteur. Le porteur atteint le plafond de niveau en fin de dizaine. Le banc reste 5 à 12 niveaux
dessous, souvent sans avoir évolué. Contre un champion ou le rival, qui ont trois Pokémon ou plus
d'un niveau proche du nôtre, un porteur seul ne suffit pas.

## 4. Les essais pour donner ce niveau au banc sans tricher

| Essai | Idée | Résultat (apparié) |
|---|---|---|
| Objets d'expérience au plafond | ne plus empiler d'expérience perdue | +0,27 ± 0,63 (gardé) |
| Rotation au plafond | le porteur au plafond cède l'expérience au suivant | −0,09 ± 0,86 |
| Second du rival 2 | entraîner par changement le membre qui bat le starter du rival | −0,59 ± 1,05 |
| Spécialité des champions | les Pokémon pas encore vus d'un champion ont son type | +0,26 ± 0,90 (gardé) |
| Starter du rival retenu | le moteur connaît le type du starter du rival dès le rival 1 | +0,05 ± 0,69 (gardé) |
| Équilibrage | le membre le plus en retard prend l'expérience s'il gagne | −3,4 (arrêté à 161 parties) |
| Leurres | plus de combats doubles : deux participants | **−17,6** (arrêté à 173 parties) |
| Entraînement par changement | le membre en retard entre, puis cède au porteur | −5,5 (arrêté à 164 parties) |
| Niveau dans la note d'équipe | préférer les captures de meilleur niveau | −0,33 ± 1,25 |
| Trio conseillé (Grenousse, Feunnec, Poussacha) | les starters les plus forts mesurés | 57,3 contre 55,7 (non apparié, ±2) |

Pourquoi rien ne marche : **l'expérience totale est fixe**. Dans un combat simple, seul celui qui
combat gagne l'expérience. Le Multi Exp en donne 20 % par exemplaire aux autres. Redistribuer
cette quantité (rotation, équilibrage, entraînement par changement) prend au porteur ce qu'on donne
au banc. Augmenter la quantité par les combats doubles expose le banc faible, qui meurt.

Les seules vraies sources d'expérience en plus sont rares :
- le **Multi Exp** est proposé 0,6 fois par partie, et le bot le prend 76 % du temps ;
- le rival 1 et le rival 2 en donnent un chacun.

## 5. Récompenses : ce qui est proposé, ce qui est pris

Le simulateur compte maintenant aussi les récompenses proposées. Par partie :
- 5 Poké Balls proposées 25 fois et Leurres 12,5 fois ;
- vitamines 0,2 à 0,4 fois chacune.

Les objets forts (vitamines, Multi Exp, Lentille Large) sont rares, et le bot les prend 75 à 90 %
des fois. Le choix entre les objets n'est donc pas le problème : c'est ce qui est proposé. Les
chances par option sont fixées par le jeu : 75 % commun, 19 % super, 4,7 % hyper, 1,2 % rogue ;
la chance des chromatiques les améliore.

## 6. La fin de partie (vagues 80 à 115)

Même avec le banc au niveau, les murs restent : 20 à 30 % de défaites aux vagues 80, 90 et 95, et
73-80 % aux vagues 114-115 (admin et boss de la Team). Dans ces défaites, notre équipe a un meilleur
niveau (100-104 contre 93-100) mais perd parfois en 6 à 8 tours.

Ce qui manque à ce niveau :
- les espèces : total de stats ~500, contre Dracolosse, Pomdorochi, Tranchodon… chez eux ;
- les objets de combat : 3 vitamines en moyenne ;
- les IV : 15 sur un compte neuf.

C'est le cas du compte de Carlos (légendaires, IV élevés, chance), qu'il faudra mesurer à part.
