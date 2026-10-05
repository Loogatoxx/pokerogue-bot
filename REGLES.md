# REGLES.md — règles confirmées et décisions d'architecture

À relire au début de chaque session et avant chaque modification.

- **Version du jeu de référence** : PokéRogue `v1.12.0.11` (commit `e4e9b53`, identique à la branche `main` le 04/10/2026).
- **Sources** : chemins dans le dépôt du jeu (dossier `jeu/`). Vérifiées en Phase 0 le 04/10/2026.
- **Légende** : ✅ confirmé dans le code · ⚠️ différent de la règle telle qu'elle avait été écrite · 🧪 lu dans le code, pas encore vérifié par un test.

Si le jeu change de version, toutes les lignes ✅ repassent en 🧪 jusqu'à nouvelle vérification.

---

## A. Règles du jeu (mode Classique)

### R1. Structure d'une partie ✅

| Règle | Source |
|---|---|
| 200 vagues ; la vague 200 est la dernière | `src/game-mode.ts` `isWaveFinal` (l. 296-300) |
| Toute vague multiple de 10 est une vague « boss » | `src/game-mode.ts` `isBoss` (l. 313) |
| Un biome = 10 vagues ; on change de biome après chaque vague X0 | `src/battle-scene.ts` `isNewBiome` (l. 1271-1277), `src/phases/victory-phase.ts` (l. 125-127) |
| Vagues 191 à 200 : biome final (END), imposé | `src/phases/select-biome-phase.ts` (l. 26-31) |
| Biome suivant : tiré au hasard parmi les biomes liés. On ne le choisit que si on possède la **Carte** (`MAP`) et qu'il y a plusieurs choix | `src/phases/select-biome-phase.ts` (l. 41-63) |

### R2. Vagues spéciales ⚠️

⚠️ Toutes les vagues X0 ne sont **pas** des champions d'arène.

**Champion d'arène** : une vague X0 sur trois seulement.
- Sans décalage : vagues 20, 50, 80, 110, 140, 170.
- Avec décalage : vagues 30, 60, 90, 120, 150, 180.
- Le décalage (`offsetGym`, une chance sur deux) est tiré une fois par partie avec la graine.
- Sources : `src/game-mode.ts` `isWaveTrainer` (l. 217) et `isTrainerBoss` (l. 256-265), `src/battle-scene.ts` (l. 1113, 1940-1950).

**Les autres vagues X0** : un Pokémon sauvage boss. Exceptions : la vague 190 (Maître) et la vague 200 (boss final).

**Combats fixes** (`src/enums/fixed-boss-waves.ts`, détail dans `src/data/trainers/fixed-battle-configs.ts`) :

| Vague | Combat | Récompenses particulières |
|---|---|---|
| 5 | Gamin | — |
| 8 | Rival 1 | — |
| 25 | Rival 2 | 3 choix garantis : Hyper, Super, Super |
| 35 | Sbire de la Team 1 | — |
| 55 | Rival 3 | 4 choix : Hyper ×2, Super ×2 |
| 62, 64 | Sbires de la Team 2 et 3 | — |
| 66 | Admin de la Team 1 | — |
| 95 | Rival 4 | 4 choix Hyper |
| 112 | Sbire de la Team 4 | — |
| 114 | Admin de la Team 2 | — |
| 115 | Chef de la Team 1 | 5 choix : Rogue ×2, Hyper ×3 |
| 145 | Rival 5 | 5 choix : Rogue ×3, Hyper ×2 |
| 164 | Admin de la Team 3 | — |
| 165 | Chef de la Team 2 | 6 choix : Rogue ×2, Hyper ×4 ; + Capsule Verrou (`LOCK_CAPSULE`) avant (`victory-phase.ts` l. 61-65) |
| 182, 184, 186, 188 | Conseil 4 | — |
| 190 | Maître (Red ou Lance) | — |
| 195 | Rival 6 | 6 choix : Rogue ×2, Hyper ×2, Super ×2 |
| 200 | Boss final (Éthernatus) | fin de partie |

**Dresseurs ordinaires** : possibles sur les vagues X2 à X9, jamais sur X1. Pas à moins de 2 vagues d'un combat fixe ou d'un champion (`isWaveTrainer`, l. 219-250).

**Rencontres mystères** : existent en Classique. Certaines soignent toute l'équipe (`PartyHealPhase` dans `src/data/mystery-encounters/encounters/*`).

### R3. Boss et segments (boucliers) ⚠️

**Qui est boss** :
- tout Pokémon sauvage d'une vague X0 ;
- **et** tout Pokémon sauvage légendaire, fabuleux ou sous-légendaire, **à n'importe quelle vague** ;
- certains Pokémon de dresseurs (starter du rival dans les derniers combats, chefs…).
- Sources : `src/battle-scene.ts` `getEncounterBossSegments` (l. 1964-2005), `src/data/trainers/rival-party-config.ts` (l. 48, 206, 585).

**Nombre de segments en Classique** : 2. +1 si niveau ≥ 100, +1 si total des stats de base ≥ 670. Donc de 2 à 4.

**Dégâts** : un coup s'arrête au bord du segment en cours. ⚠️ Mais un très gros surplus casse plusieurs segments d'un coup : sauter n segments demande au moins 2^n fois un segment de dégâts en trop.
- Source : `src/utils/damage.ts` `calculateBossSegmentDamage` (l. 22-67), appelée par `src/field/pokemon.ts` `EnemyPokemon.damage` (autour des l. 6917-6955).

**Boosts** : chaque segment cassé donne +1 cran à une stat du boss, tirée au hasard et pondérée par ses stats.
- Avec 3 segments ou plus : le dernier segment donne +2.
- Avec 5 segments ou plus : l'avant-dernier donne aussi +2.
- ⚠️ **Aucun boost si le boss appartient à un dresseur.**
- Source : `src/field/pokemon.ts` `handleBossSegmentCleared` (autour de la l. 6973-7012).

**Boss final** (vague 200, 1re forme) : ne descend pas sous le dernier segment, puis change de forme (`pokemon.ts`, autour des l. 6937-6939).

### R4. Soin gratuit ✅

**Quand** : au passage de X0 à X1 (après le boss des vagues 10, 20… 190).
- Déroulé : `SelectBiomePhase` → `setNextBiomeAndEnd` → `PartyHealPhase` si `nextWaveIndex % 10 === 1`.
- Source : `src/phases/select-biome-phase.ts` (l. 93-101).

**Ce qu'il fait** (`src/phases/party-heal-phase.ts`, l. 22-37) :
- PV au maximum ;
- statut soigné ;
- **PP au maximum** ;
- **ranime les K.O.** (sauf défi spécial) ;
- remet à zéro les Téracristallisations utilisées.

Au même moment, le jeu verse les intérêts de l'objet `COIN_CASE` (`MoneyInterestModifier`).

**Conséquences** :
- PV et PP perdus ne reviennent pas avant ce soin. Exception : les objets, et certaines rencontres mystères.
- La dernière boutique avant un soin est celle d'après la vague X9 (voir R5 et R6). Y soigner pour le boss X0 est légitime. Y soigner au-delà de ce qui sert au boss est perdu.

### R5. Récompenses après une vague ⚠️

**Vagues non X0** : écran « 1 objet parmi N » (`SelectModifierPhase`).
- N = 3, +1 par **Poké Ball Dorée** possédée (`ExtraModifierModifier`), + bonus temporaires.
- Source : `src/phases/select-modifier-phase.ts` `getModifierCount` (l. 377-398).
- Les combats fixes de R2 imposent leur nombre de choix et leurs niveaux de rareté.

⚠️ **Vagues X0** : **pas d'écran de choix, pas de boutique**. Le jeu donne à la place (`src/phases/victory-phase.ts`, l. 86-123) :
- un **Charme Exp** ;
- un **Super Charme Exp** sur les vagues de champion ;
- un Charme Exp de plus à la vague 10 ;
- une **Poké Ball Dorée** aux vagues 50, 100 et 150.

**Objets conditionnels** : certains n'apparaissent que s'ils servent (`src/modifier/init-modifier-pools.ts`, l. 64-210).
- Potions : seulement si des membres sont blessés.
- Rappel : seulement si quelqu'un est K.O.
- Total Soin : seulement s'il y a un statut.
- Éthers : seulement si des PP sont bas.
- Balls : jamais si leur stock est au maximum.

**Chances de rareté** (mesurées par le simulateur, étape 15) : commun 75 %, super 19 %, hyper 4,7 %, rogue 1,2 %.

### R6. Boutique ✅

Elle est sur le même écran que les récompenses (rangées du bas).

**Pas de boutique aux vagues X0** : `getPlayerShopModifierTypeOptionsForWave` renvoie une liste vide (`src/modifier/modifier-type.ts`, l. 2627-2630). De toute façon, il n'y a pas d'écran de récompenses à ces vagues.

**Prix de base** = l'argent d'une vague = `getWaveMoneyAmount(1)` (`src/battle-scene.ts`, l. 2399-2406). Une **Pépite** rapporte exactement ce prix de base.

**Articles débloqués par rangées** : rangées = `ceil((vague + 10) / 30)` (`modifier-type.ts`, l. 2632-2660).

| Vagues | Articles en vente |
|---|---|
| 1-20 | Potion (×0,2), Éther (×0,4), Rappel (×2) |
| 21-50 | + Super Potion (×0,45), Total Soin (×1) |
| 51-80 | + Élixir (×1), Max Éther (×1) |
| 81-110 | + Hyper Potion (×0,8), Rappel Max (×2,75), Champignon Mémoire (×4) |
| 111-140 | + Potion Max (×1,5), Max Élixir (×2,5) |
| 141-170 | + Guérison (×2,25) |
| 171-200 | + Cendre Sacrée (×10) |

**Ordre** :
- **Acheter ne termine pas l'écran.** On peut acheter plusieurs articles.
- **Prendre une récompense termine l'écran** et lance la vague suivante. Passer (« skip ») aussi.
- Donc : **boutique d'abord, récompense ensuite.**
- Source : `select-modifier-phase.ts` `applyModifier` (coût −1 = récompense → `super.end()`) et l. 80-93.

### R7. Relance, verrou, transfert ✅

**Relance** (`getRerollCost`, `select-modifier-phase.ts` l. 419-452) :
- Coût = `ceil(vague / 10) × 250 × 2^(relances déjà faites dans cette vague)`.
- Le compteur repart à zéro à chaque vague.
- La relance remplace les récompenses, **pas la boutique** (l. 187-206).

**Verrou des raretés** : avec la Capsule Verrou, la relance garde les raretés. Le coût devient la somme de 50 / 125 / 300 / 750 / 2000 par rareté affichée, × `ceil(vague / 10)` × 2^n.

**Transfert** d'objets tenus entre membres : gratuit, depuis l'écran des récompenses (l. 209-243).

### R8. Pas d'inventaire de consommables ⚠️

**Soin, Rappel, PP, vitamine, CT** : appliqués **tout de suite** à un Pokémon. On ne peut pas en stocker.
- Le jeu refuse une Potion sur un Pokémon K.O. ou en pleine forme.
- Il refuse un Rappel sur un Pokémon qui n'est pas K.O.
- Source : `src/modifier/modifier-type.ts`, filtres de `PokemonHpRestoreModifierType` (l. 464-500) et du Rappel (l. 528-550).

**Seuls « stocks »** :
- les **Poké Balls** ;
- les effets à durée : objets X, Leurres, Muscle +…

« Garder de quoi ranimer le porteur » veut donc dire **garder de l'argent**, pas un Rappel.

### R9. Stats modifiées et ce qui persiste entre deux vagues ⚠️🧪

**Où vivent les crans** (−6 à +6) : dans `summonData` (`src/data/pokemon/pokemon-data.ts`, l. 102-104).

**Ils sont effacés** quand le Pokémon est rappelé par un changement normal : `leaveField` → `resetSummonData` (`src/field/pokemon.ts`, autour de la l. 5657-5669).
- Le nettoyage n'a lieu que pour `SwitchType.SWITCH` (`src/phases/switch-summon-phase.ts`, l. 121 et 146).
- Relais (`BATON_PASS`) et `SHED_TAIL` gardent les effets.
- 🧪 Cas des sorties forcées (`FORCE_SWITCH`) à vérifier par un test.

**Entre deux vagues**, `doPostBattleCleanup` (`src/battle-scene.ts`, l. 1563-1603) rappelle l'équipe et efface tout dans trois cas :
- **la vague suivante est un nouveau biome** (après une vague X0) ;
- **la vague suivante est un dresseur ou une rencontre mystère** ;
- c'est le boss final.

**Sinon** (sauvage → sauvage dans le même biome) :
- le Pokémon en tête **reste sur le terrain avec ses crans** ;
- 🧪 les effets de terrain (météo, pièges) restent aussi (`resetArenaEffects` n'est appelé que dans les trois cas ci-dessus).

**Conséquences** :
- Un boost pris aux vagues X1-X9 contre des sauvages peut durer jusqu'au **boss sauvage X0**.
- Il est perdu avant un champion, un rival ou un dresseur.
- Changer de Pokémon a un coût caché : on perd ses crans.

### R10. Plafond de niveau ✅

Il est fixé par bloc de 10 vagues : `getMaxExpLevel` (`src/battle-scene.ts`, l. 2310-2324), avec `w = ceil(vague/10) × 10`, `ceil((1 + w/2 + (w/25)²) × 1,2 / 2) × 2 + 2`.

Il est relevé au changement de biome (`LevelCapPhase`, l. 1613-1619). L'expérience au-delà du plafond est perdue. Les Super Bonbons ne sont pas concernés : la Bonbonnière ajoute des niveaux.

### R11. IA adverse (rappel, vérifié le 01/10, revérifié aujourd'hui pour le changement) ✅

**Changement de Pokémon** : un dresseur change si son meilleur Pokémon de réserve a un score de duel ≥ 3 fois celui du Pokémon actuel (2 fois pour un dresseur « boss »). Ce seuil grimpe à chaque changement consécutif.
- Source : `src/phases/enemy-command-phase.ts` (l. 62-73).

**Choix de l'attaque** : contre le Pokémon en face **avant** notre changement. Le K.O. d'abord, puis puissance × efficacité (voir `observateur/prevision.ts` et `docs/etape-7-prevision.md`).

### R12. Overrides et reproductibilité ✅

`src/overrides.ts` (l. 68-347) propose :
- `SEED_OVERRIDE`, `STARTING_WAVE_OVERRIDE`, `STARTING_BIOME_OVERRIDE` ;
- `STARTING_MONEY_OVERRIDE`, `STARTING_LEVEL_OVERRIDE`, `STARTER_SPECIES_OVERRIDE` ;
- `STARTING_MODIFIER_OVERRIDE`, `STARTING_HELD_ITEMS_OVERRIDE`, `ITEM_REWARD_OVERRIDE` ;
- `BATTLE_TYPE_OVERRIDE`, `ENEMY_*` (dont `ENEMY_HEALTH_SEGMENTS_OVERRIDE`) ;
- `MYSTERY_ENCOUNTER_*`, `WAIVE_ROLL_FEE_OVERRIDE`, `LEVEL_CAP_OVERRIDE`, `XP_MULTIPLIER_OVERRIDE`.

L'outil de test (`test/framework/game-manager.ts`, `test/helpers/overrides-helper.ts`) a des réglages par défaut **différents du vrai jeu** :
- IV et natures normalisés ;
- chromatiques coupés ;
- objets des adversaires retirés ;
- rencontres mystères coupées ;
- hasard « toujours le jet maximum ».

Le simulateur les annule (`simulateur/environnement.test.ts`, l. 390-402 ; `docs/etape-0-vitesse.md`). **À revérifier à chaque mise à jour du jeu.**

**Déjà en place dans le projet** :
- graine par partie, starters et hasard liés à la graine (`simulateur/outils-partie.ts`) ;
- « photos » de début de vague, rejouées comme « Continuer » ;
- objets donnés au départ (triche d'entraînement seulement).

**Isolement** : le simulateur ne parle jamais au serveur public. L'outil de test remplace `fetch` et saute la connexion (`test/framework/game-manager.ts` l. 116, `game-wrapper.ts` l. 32-33).

### R13. Tirages du jeu qui ne dépendent pas de la graine ✅

Une partie des tirages du jeu passe par `Math.random()` (`randInt`, `src/utils/common.ts` l. 88-93), pas par la graine de la vague :
- combat double contre un sbire de la Team (1 chance sur 3) et genre du sbire (`src/battle.ts`, `getRandomTrainerFunc`) ;
- certaines rencontres mystères ;
- les œufs.

Dans le vrai jeu, c'est du vrai hasard. Pour qu'un banc soit apparié, le simulateur initialise `Math.random` avec la graine de la partie en mode `hasardDuJeu` (`simulateur/environnement.test.ts`).

### R14. Une défaite dans l'Éleveur expert ne termine pas la partie ✅

Dans la rencontre THE_EXPERT_POKEMON_BREEDER, on combat seul avec un des 3 Pokémon les moins amicaux. Si on perd, le jeu passe bien par `GameOverPhase`, mais la rencontre l'annule (`onGameOver`, `src/phases/game-over-phase.ts` l. 58-66). L'équipe est rendue, le Pokémon choisi reste K.O. et la partie continue. C'est la seule rencontre qui fait ça (`onGameOver` n'apparaît que dans `the-expert-pokemon-breeder-encounter.ts`).

Jusqu'au 05/10, le simulateur arrêtait la partie dès qu'il voyait `GameOverPhase`. Corrigé : une fin de partie annulée par la rencontre n'est plus une défaite.

---

## B. Règles de Carlos (non négociables)

**Perception**
- Tout sur nos Pokémon. De l'adversaire, seulement ce qui s'affiche.
- La connaissance publique est permise : Pokédex, règles de l'IA, équipes connues des rivaux et des champions.
- Triche (rejouer une graine, photo de vague, objets donnés) **à l'entraînement et au diagnostic seulement**, jamais en jeu.

**Compte et exécution**
- Compte neuf dédié à l'IA. Jamais le compte principal.
- **Mode Auto interdit en Daily Run.**
- Tout en local et gratuit. Extension pour Brave. Ce qui est destiné à Carlos s'ouvre sur son Mac.

**Objectif**
- Vague 200 en Classique. Minimum : rival 1 à 100 %.

**Analyse d'une défaite**
- Jamais « adversaire trop fort ».
- On cherche la décision fautive d'avant : argent, objets, attaques, captures, changements.

**Captures**
- Seulement si l'équipe n'est pas pleine, ou pour remplacer un membre.
- Sans risque pour l'équipe : pas d'acharnement sur un légendaire.
- Affaiblir d'abord, jamais en pleine forme.
- Poké Balls en début de partie seulement.

**Équipe**
- Ne jamais relâcher le porteur. Un porteur ranimé doit rejouer.
- Changer quand c'est nécessaire.
- En double, ne pas laisser un Pokémon faible face aux deux adversaires.

**Argent et objets**
- Économiser pour les combats difficiles (rival, champion, boss). Garder de quoi ranimer le porteur (en argent, voir R8).
- Prendre la Pépite plutôt que la Potion gratuite quand la boutique vend la Potion.
- Bonbonnière forte en début de partie. Ne pas laisser passer Charmes Exp et Multi Exp.
- Pas de Leurres.
- Méga-Gourmette ou Bracelet Dynamax si un membre peut s'en servir.
- Soigner la paralysie (Total Soin).
- Attention aux CT qui font oublier une meilleure attaque.

**Discipline**
- Ne jamais modifier le code partagé (observateur, pilote, simulateur) pendant un entraînement ou une mesure en cours.
- Git : commit et push autorisés sans redemander.
- Jamais de secrets suivis : `*.jks`, `*.keystore`, `local.properties`, `.env`, `*.apk`, `*.aab`.

---

## C. Décisions d'architecture

**Le code**
1. **On complète, on ne réécrit pas.** L'état, le pilote, le planificateur, le moteur de combat d'équipe et le banc apparié existent et marchent. Chaque phase ajoute ou corrige un morceau ciblé.
2. **L'observateur reste unique**, partagé par le simulateur et l'extension.
3. **Ajouter une variable au state** :
   - on incrémente `VERSION_OBSERVATION` ;
   - on ne touche **pas** à l'encodeur (`VERSION_ENCODAGE` reste à 5) ;
   - ainsi, le cerveau v5 reste lisible.

**Les données**

4. **Les valeurs de jeu** (poids, tiers, listes) vont dans des fichiers de données (matrices M1 à M4). Chaque ligne cite sa source : fichier du jeu, mesure ou règle de Carlos.

**La mesure**

5. **Mesure de référence** : banc apparié `entraineur/banc_complet.py`, protocole figé le 04/10 (détail dans `RESULTATS.md`).
   - Mêmes 480 parties pour chaque version : graine `complet-k`, trio Plante/Feu/Eau tiré avec k, hasard du jeu fixé.
   - Rencontres mystères au rythme du vrai jeu. Parties en erreur enregistrées et exclues.
   - Bancs officiels sur le Mac de Carlos uniquement. Le protocole ne change plus sans accord.
6. **Règle de décision** : on garde un changement si `moyenne(différences) > 2 × erreur-type appariée`.
   - Erreur-type appariée = écart-type des différences partie par partie ÷ √n. C'est la bonne formule pour des parties appariées.
   - La formule √(SE_A² + SE_B²) vaut pour des parties indépendantes. Elle est trop prudente ici.
7. **Un changement à la fois.** Si le gain est sous le seuil, on revient en arrière.

**Le périmètre**

8. **Pas de RL avant la Phase 7.** L'historique le montre :
   - le cerveau seul plafonne vers 27 ;
   - le plan décide presque tout (le cerveau s'en écarte nettement dans 0,7 à 5,5 % des cas) ;
   - imitation et juge : aucun gain.

**Les conventions**

9. **Nouveau code : aucun commentaire**, fonctions courtes, niveau première année. L'ancien code (très commenté) n'est pas réécrit pour autant.
10. **Version du jeu épinglée** sur le tag `v1.12.0.11`, pas sur `main` qui bouge.

---

## D. Procédure de début de session

1. Relire ce fichier, puis rappeler en 3 lignes les règles qui concernent la tâche.
2. Avant d'écrire du code, vérifier en une ligne :
   - règles du jeu respectées ;
   - variables du state disponibles ;
   - périmètre de la phase respecté ;
   - aucun commentaire ;
   - test prévu.
3. Idée hors phase → `BACKLOG.md`. Résultat chiffré → `RESULTATS.md`. Chaque requête → `historique_prompts.md`.
