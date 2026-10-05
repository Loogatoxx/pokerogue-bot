# REPRISE.md — point de reprise pour Claude Code en local (05/10/2026)

À lire en premier, avant REGLES.md, quand le travail reprend sur le Mac. Ce fichier dit où on en
est, ce qui reste à décider, comment le décider, et ce qu'on a appris. Mettre à jour la section
« Verdicts » dès qu'un banc est fini.

---

## 1. Où on en est

- Branche de travail : `claude/pokerogue-bot-macro-strategy-33yi1e`, PR #9 (brouillon) vers `main`.
- **Référence actuelle (plan seul, simulateur corrigé)** : `p7-ref` = **60,03 vagues** sur 475
  parties valides (rival 2 : 79 %, rival 4 : 75 %). Code des décisions : `77dabf3` (identique à
  `cc7a855` pour les décisions).
- Gains gardés depuis le début : changements (+3,91), rencontres mystères (+9,31), boucle du pilote
  (erreurs 57 → 6), bug du banc de l'Éleveur expert (le jeu continue après une défaite dans cette
  rencontre : la référence est passée de 57,9 à 60,0 sans changer le bot).
- **Deux changements jugés dans le cloud le 05/10, tous les deux annulés** (voir « Verdicts ») :

| Commit | Changement | Banc | Comparé à |
|---|---|---|---|
| `45e2f0d` (**annulé**, voir Verdicts) | Moteur d'équipe : au tour d'un changement, l'IA adverse vise le Pokémon **qui part** (comme le jeu : `EnemyCommandPhase` avant `TurnStartPhase`) | `p13-ciblage` | `p7-ref` |
| `0fff884` (**annulé**, voir Verdicts) | Moteur d'équipe : Pokémon pas encore vus d'un **rival** joués avec le niveau et les stats de leur emplacement (`donnees/rivaux.json`, exporté du jeu ; rival 2 : 3e Pokémon niveau 16, pas une copie du starter) | `p14-rivaux` (mesuré **sans** `45e2f0d`) | `p7-ref` |

Un troisième essai (ciblage + prix de changement plus élevé, `p15-ciblage-prix`) tournait au moment
où les crédits s'épuisaient : voir « Verdicts ».

## 2. Ce qu'il faut faire en reprenant (dans l'ordre)

### 2.1 Refaire la référence en local, puis finir les essais en attente

Les résultats des bancs du cloud n'existent plus (dossier temporaire). Pour comparer en local, il faut
d'abord refaire la référence sur le Mac. Le banc lance le jeu depuis `jeu/` à la racine du dépôt :
faire les bancs l'un après l'autre, jamais en même temps.

```bash
cd ~/Projets/pokerogue-bot
git fetch origin && git checkout claude/pokerogue-bot-macro-strategy-33yi1e && git pull
git -C jeu describe --tags                      # doit afficher v1.12.0.11
.venv/bin/python -m entraineur.banc_complet --nom p7-ref --plan-seul --processus 8
```

(Le code de la branche a les mêmes décisions que `77dabf3`, la référence.) Ensuite, pour chaque essai
de la section « Verdicts » encore marqué « programmé » ou « en cours », suivre ses commandes. Règle :
verdict « GARDER » → reporter le changement sur la branche avec son test ; sinon rien à faire.

### 2.2 Mettre à jour ce que joue le site (le « cerveau le plus performant »)

- Le site joue avec le cerveau v5 (`cerveau/le-plus-fort-v5.cerveau`, aussi sur le Lexar) **guidé par
  le moteur** (valeurs du plan × 30) : presque toutes les décisions viennent du moteur, qui est dans
  le code de l'extension, pas dans le fichier `.cerveau`. Mettre à jour le site = reconstruire
  l'extension après la fusion :
  ```bash
  git checkout main && git pull
  pnpm install && pnpm test && pnpm verifier
  pnpm extension          # extension/dist/
  ```
  puis dans Brave : `brave://extensions` → recharger l'extension. Recharger le même `.cerveau`.
- **Quel cerveau ?** Rien n'a encore battu le v5 sur le site. Plan seul contre v5 : −0,96 ± 1,35
  (dans le bruit, BACKLOG n° 19). Après les verdicts, refaire la comparaison sur le Mac avec le
  moteur à jour :
  ```bash
  .venv/bin/python -m entraineur.banc_complet --nom v5-maj --processus 8          # avec le cerveau v5
  .venv/bin/python -m entraineur.banc_complet --comparer v5-maj <référence plan seul>
  ```
  Garder sur le site celui qui gagne (si « plan seul » gagne nettement, il faudra un mode « sans
  cerveau » dans l'extension : à proposer à Carlos, pas encore codé).
- Ne réentraîner un cerveau (v6) que si un banc montre que le cerveau change le résultat : guidé
  par le moteur, il ne départage que les égalités (5,5 % des décisions importantes, docs/étape 12).

### 2.3 Fusionner

PR #9 : ne contient que des changements mesurés (gardés), neutres ou de diagnostic. Elle peut être
fusionnée telle quelle.

## 3. Ce qu'on a appris (à ne pas refaire)

**Rejeté sur le banc apparié** (détails et chiffres dans RESULTATS.md) :

| Idée | Écart | Leçon |
|---|---|---|
| Précision dans le planificateur (sauvages) | +0,76 ± 1,00 | trop petit seul (rival 4 : 73 → 82 %) ; à recombiner avec d'autres corrections ? |
| Captures limitées aux espèces qui finissent ≥ 480 | **−13,14 ± 1,93** | les captures du début aident ce bot : une capture finit le combat sans encaisser |
| Remplacements : niveaux perdus comptés partout, chromatiques gardés | −0,05 ± 0,44 | 422 parties identiques : pas un levier |
| Effets des attaques (contrecoup, drainage, crans, statuts, peur) dans le moteur | −2,08 ± 1,50 ; soi −1,05 ; adversaire −2,61 | en espérance (« 10 % de brûlure ») le moteur devient trop optimiste et change plus |
| Moteur avec le hasard du jeu (16 tirages) | −3,20 ± 1,51 | le bruit fait paraître des changements meilleurs |
| Éleveur expert : plus haut niveau ; Super Bonbon vers l'évolution | dans le bruit | — |

**Ce que disent les données** :
- La composition de l'équipe ne distingue pas les gagnants des perdants (rival 2 : 0,5 niveau et 50
  points de stats d'écart). Le meilleur prédicteur de la suite est le niveau du membre le plus faible.
- 60 % des morts : rivaux et champions. Rival 2 (vague 25) = 86 morts sur 475, la 1re cause.
- **Le juge** (`entraineur/juge_banc.py`, triche permise au diagnostic) sur 36 défaites : depuis la
  même position, le bot gagne ~1/3 de ces combats avec d'autres tirages ; ses erreurs fortes,
  revérifiées sur 16 avenirs neufs : coup du bot 28 % de victoires, coup du juge 57 %. Les erreurs
  réelles sont les **changements de Pokémon** (« aurait dû changer » 24 → 62 %, « mauvais Pokémon
  envoyé » 29 → 56 %), pas les attaques de statut.
- Trace d'un cas (rival 2, k=41, `observationBrute`) : l'IA du rival **retire** son starter dès qu'il
  est menacé ; la branche gagnante **sacrifie** un faible contre l'oiseau et **épargne** Brindibou,
  qui **évolue en plein combat** et bat le starter. Le moteur ne voit aucune de ces trois choses.

**Outils ajoutés aujourd'hui** :
- `entraineur/statistiques_banc.py` (résumé, verdict apparié) ; le banc enregistre l'équipe, les
  espèces et les objets à chaque vague.
- `entraineur/juge_banc.py` : `--banc p7-ref --types rival --vagues 25 --nombre 12 --sortie f.jsonl`,
  puis `--verifier f.jsonl --sortie g.jsonl` (revérification sur 16 avenirs).
- Option `observation_brute=True` (`pont.py`) : l'observation complète à chaque décision.
- Exports du jeu : `donnees/evolutions.json`, `donnees/rivaux.json`, `donnees/rencontres-mysteres.json`.

## 4. Prochains chantiers (par ordre de priorité, un seul à la fois, chacun mesuré)

1. **Le retrait de l'IA adverse dans le moteur d'équipe.** Lire la logique du jeu
   (`jeu/src/phases/enemy-command-phase.ts` : score de duel et seuil de changement des dresseurs) et
   la reproduire dans `observateur/combat-equipe.ts` (le planificateur a déjà `prevoirChangement`).
   Cas test : rival 2, k=41, décision 1.
1 bis. **Ciblage au tour d'un changement + garde-fou contre les séries** : le ciblage seul (`45e2f0d`)
   a donné −0,93 avec deux fois plus de séries de changements. Le refaire avec, par exemple, un prix
   de changement plus élevé quand le Pokémon vient d'entrer.
2. **Épargner le Pokémon qui contre** : dans un combat jugé perdu, le moteur ne cherche que les
   dégâts ; valoriser le membre qui bat le plus fort adversaire restant, et le niveau proche d'une
   évolution (`donnees/evolutions.json`) quand des K.O. vont donner de l'expérience.
3. **Le juge comme professeur** : les décisions corrigées (avec les mêmes tirages pour tous les coups)
   sont un meilleur signal que l'ancien professeur (qui gardait la chance). Ne servira que si le
   cerveau peut corriger le moteur (aujourd'hui il ne départage que les égalités).
4. Bas : sommeil, objets tenus et talents dans les dégâts (BACKLOG n° 22) — à reprendre seulement
   après un diagnostic du juge qui les montre.

## 5. Méthode (rappel de REGLES.md)

- Une seule modification par mesure ; banc apparié de 480 parties (graines `complet-k`) ; garder si
  gain > 2 erreurs-types, sinon annuler ; noter dans RESULTATS.md ; une entrée par demande dans
  historique_prompts.md ; idées hors phase dans BACKLOG.md.
- Pas de commentaire dans le nouveau code ; niveau 1re année ; valeurs du jeu dans `donnees/` ; un
  test simple par règle dure ; pas de nouvelle dépendance sans demander.
- Ne jamais modifier le code partagé pendant une mesure en cours (dans le cloud : chaque banc avait
  son propre dossier `git worktree` avec sa copie de `jeu/`).
- Compte de jeu neuf dédié à l'IA ; mode Auto interdit en Daily Run ; triche seulement à
  l'entraînement et au diagnostic ; jamais de secret suivi par git.

## 6. Verdicts (à remplir)

- `p13-ciblage` contre `p7-ref` : **−0,93 ± 1,26 → annulé** (fait dans le cloud, partie moteur retirée). Les séries de 3 changements ou plus passent de 36 à 77 parties : à recombiner plus tard avec un garde-fou contre les séries (chantier n° 1 bis).
- `p14-rivaux` contre `p7-ref` : **+0,81 ± 0,90 → annulé** (fait dans le cloud, partie moteur retirée ; `donnees/rivaux.json` gardé). Rival 2 inchangé à 79 %.
- `p15-ciblage-prix` contre `p7-ref` (chantier 1 bis : `45e2f0d` + `COUT_CHANGEMENT = 0.05` au lieu de
  0.01 dans `observateur/combat-equipe.ts`, pas encore commité sur la branche) : _programmé après
  p14_. Pour le refaire en local :
  ```bash
  git checkout --detach 45e2f0d
  sed -i '' 's/^const COUT_CHANGEMENT = 0.01;/const COUT_CHANGEMENT = 0.05;/' observateur/combat-equipe.ts
  .venv/bin/python -m entraineur.banc_complet --nom p15-ciblage-prix --plan-seul --processus 8
  git checkout -- . && git checkout claude/pokerogue-bot-macro-strategy-33yi1e
  .venv/bin/python -m entraineur.banc_complet --comparer p15-ciblage-prix p7-ref
  ```
  S'il gagne : le reporter sur la branche (les 3 lignes de `45e2f0d` dans `combat-equipe.ts` et le
  prix 0.05), avec le test « le remplaçant reçoit l'attaque choisie contre celui qui part ».
