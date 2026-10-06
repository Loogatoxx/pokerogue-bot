# Historique des prompts — pokerogue-bot

---

## 1. L'idée de départ — 30/09/2026

**Prompt**
> Nouveau projet !! aujourdhui j ai eu une envie de cree un bot pour pokerogue mais avec plusieur fonctionaliter deja le must du must c'est qu il puisse etre en local en tout ças on peu utiliser des api mais tout gratuit et ilimiter, la forme de l architecture du programme on la vois apres faut que tu me dise les pour et contre, faut quil puisse nous dire quel sont les meilleur action a chaque fois donc prise de decision si on çapture si on attque et sur le bonus, faut aussi pouvoir le mettre en mode en challenge avec par exemple des condition pour faire le jeu etc, faut que le programme puisse voir tout donc les ivs nature etc

Ajouté en cours de réponse :
> et avoir un mode auto

**Réponse**
- PokeRogue est open source (TypeScript + Phaser, licence AGPL-3.0) et se lance en local.
- 4 emplacements possibles pour le bot (lecture d'écran, extension navigateur, copie locale du
  jeu avec un module intégré, copie locale + cerveau Python), avec leurs pour et contre.
- 4 façons de décider (règles + scores, simulation, IA de langage locale, apprentissage par
  renforcement), avec leurs pour et contre.
- Correspondance entre les fonctionnalités voulues et les « phases » du jeu
  (`CommandPhase`, `AttemptCapturePhase`, `SelectModifierPhase`…).
- Recommandation de départ : copie locale du jeu + moteur de calcul exact.

**Modifications**
Aucun code. Projet enregistré dans la mémoire de Claude.

**Objectif**
Poser les options avant de choisir, comme demandé : comprendre ce que chaque architecture
permet et coûte.

---

## 2. Séance de questions (/grill-me) — 30/09/2026

**Prompt**
> justement moi j avais penser plus a l extension chrome, le ças du renforcement est une aproche tres intersseante j ai toujour voulu en faire une c'est ppeut etre le moment de voir cette aproche, fait un github, sinon ça change un peu se que tu avais prevue mais c'est interessant de cette maniere, le but n etait pas d avoir acces au donner du jeu et de faire que du perfect mais vraiment avoir un bot qui reflechi

Réponses données pendant la séance :
> enfaite j aime bien le fait de exp un cerveau mais j ai pas envie de l exp moi meme je te dirait tout le temps de comment on pourrais le faire evoluer mais pas moi qui touche au code j aimerais bien voir des simulation par exemple et des graphique pour montrer comment il evolue mais que a la fin on puisse implement un cerveau dans une extension navigateur et quil puisse analyse chaque decision, qui va du team buil au combat etc

> A et B on fera en sorte de faire plusieur reglage pour que se sois vraiment complet et implementer les fonctionaliter, ce qui serais bien c'est aussi que on puisse deja avoir l extension et que je puisse importer le cerveau comme ça je creer un compte de zero rien que pour l ia pour pas venir sur mon propre compte le but est que au lieu de voir les graphique seulement et une fois que c'est au point ça sois fort directement, voir les erreur etc et voir comment elle evolue de mes propre yeux, oui on pourrais faire en local mais je prefere voir comme ça se debrouille en extension

> quand je dis iv nature c'est les notre pas ceux de l adversaire ça je parlais pour le team build pas pour les adversaire faut que sont comportement sois 100% faisable et analysable par un humain

> les deux separer je m etait dis, et pour les phrase pas forcmenet dire pourquoi c'est le meuilleur coup mais dire pourquoi c'est un bon coup

> alors la c'est une question tres pertinente vu que les oeuf font parti du grind long terme mais que le bot jouera des partie court terme il est vrai quil va pas comprendre au choix de bonus pourquoi il devrais prendre les oeufs, faudrais faire en sorte que l ia comprene a quoi sert l oeuf et qui le prenne dans le cas ou elle pourrait prendre sans souci sans ruiner les game et ensuite evaluer quel machine pourrait rendre le meilleur type d oeuf selon les besoin du team buil

> faut qu'il atteint les 200 vagues, mais pas quil y est un score precis donc A et C

> je pense que plus tard est un bon choix on verra comment c'est possible

**Réponse**
Sept questions posées une par une, puis un récapitulatif validé :
- **Objectif** : un cerveau entraîné par renforcement qui atteint la vague 200 en Classique,
  joué et commenté dans une extension Chrome sur pokerogue.net.
- **Rôles** : Claude code, Carlos pilote l'évolution du cerveau.
- **Entraînement** sur une copie locale du jeu sans graphismes ; l'extension sert à utiliser
  le cerveau, disponible tôt, avec import de chaque version pour la voir progresser.
- **Compte** neuf réservé à l'IA, créé par Carlos. Conseil + mode auto (interdit en Daily Run).
- **Perception humaine** : tout sur ses Pokémon, de l'ennemi seulement ce qui est visible.
- **Analyse** : chiffres bruts d'un côté, phrases « pourquoi c'est un bon coup » de l'autre.
- **Œufs** : valeur d'un bon d'œuf réglable ; choix de la machine par analyse.
- **Challenges** : plus tard, en réentraînant un cerveau déjà formé.

**Modifications**
Aucun code.

**Objectif**
Passer d'un « bot qui donne le meilleur coup » à un « cerveau qui apprend et qu'on regarde
réfléchir », et fixer le périmètre avant d'écrire la moindre ligne.

---

## 3. Validation, création du projet et architecture — 30/09/2026

**Prompt**
> je valide juste pour la question de disque j ai brancher mon lexar vu que y aura besoin de beaucoup d espace ecrit la dessus et te limite pas avec les marquant defoule toi

**Réponse**
- Dépôt GitHub privé créé : https://github.com/Loogatoxx/pokerogue-bot (aucun commit).
- Données lourdes sur le Lexar, sans limite de versions de cerveau ; le code reste sur le
  SSD interne, car l'ExFAT ne gère ni les liens symboliques (pnpm) ni les permissions (git).
- Vérification en direct sur pokerogue.net : `window.Phaser` (v3.90.0) est exposé et un
  script de page peut capturer la scène de combat en cours (`party`, `field`, `arena`,
  `phaseManager`, `modifiers`…), avec des noms de propriétés lisibles. L'extension est
  donc faisable.
- Le jeu fournit un gestionnaire de partie sans graphismes pour ses tests
  (`test/framework/game-manager.ts`) : base possible du simulateur d'entraînement.
- Architecture détaillée présentée avec pour et contre, décisions à valider.

**Modifications**
- `README.md` : objectif, principes, emplacement des fichiers.
- `.gitignore` : dépendances, copie du jeu, cerveaux, secrets, binaires.
- `historique_prompts.md` : ce journal.
- Dossier `/Volumes/Lexar/pokerogue-bot/` créé.

**Objectif**
Mettre en place le projet et vérifier le point le plus risqué (l'accès au jeu depuis une
extension) avant de valider l'architecture.

---

## 4. Choix d'architecture, mémoire du cerveau et étape 0 — 30/09/2026

**Prompt**
> utilise mon mac sil faut faire des verification y a pas de souci ne te limite pas que a acceder a mon navigateur, parce que la je vois pas le pokerogue que tu a lancer, simulateur A, langage python, tronc commun, tableau de bord maison, essaye de voir la possibliter qu il puisse avoir comme un historique de decision qu il puisse comprendre toute la partie et rien oublier je sais aps i j avais compris ou pas ce passager mais je donne idee que c'est peut etre deja prevue

Ajouté en cours de réponse :
> oui tu peu installer le jeu en local

**Réponse**
- Choix actés : simulateur = outil de test du jeu, entraîneur en Python, cerveau à tronc commun,
  tableau de bord maison.
- Mémoire du cerveau : proposition « carnet de partie + relecture des derniers événements »
  (A + C), avec affichage de ce qu'il a relu pour décider. À valider.
- Étape 0 menée : copie du jeu installée (version 1.12.0.11, identique au site), banc de vitesse
  écrit et fiabilisé. Résultat : ~70 décisions/s par processus, ~250/s sur 8 processus,
  partie complète de 200 vagues en 10 à 15 s, 0 erreur sur 280 parties. **Feu vert.**
- Six pièges trouvés et corrigés (hasard désactivé, graine figée, starters sans attaque,
  localStorage de Node 26, courses entre phases, duos de dresseurs en simple forcé).
- La copie locale du jeu est lancée et ouverte dans le navigateur de Carlos (Safari).
- Découverte : Chrome n'est pas installé, seulement Brave (compatible avec les extensions
  Chrome) et Safari. Question posée sur le navigateur cible de l'extension.

**Modifications**
- `jeu/` : clone de PokeRogue (branche `main`), ignoré par git.
- `simulateur/banc-vitesse.test.ts` : banc de vitesse (joueurs hasard, glouton, marathon).
- `simulateur/lancer-banc.sh` : lance le banc en parallèle et range le résultat sur le Lexar.
- `docs/architecture.md` : architecture validée + proposition de mémoire.
- `docs/etape-0-vitesse.md` : résultats, pièges, limites connues.
- `.claude/launch.json` : lancement de la copie locale du jeu.
- `README.md`, `.gitignore` mis à jour.
- Outils : pnpm installé via Homebrew.

**Objectif**
Vérifier, avant d'écrire le cerveau, que le jeu peut tourner assez vite et assez fidèlement
pour l'entraîner : c'était le risque qui pouvait faire échouer tout le projet.

---

## 5. Validation, premier commit et étape 1 (extension minimale) — 30/09/2026

**Prompt**
> faison ta recomendation oui tout ce qui a a faire utilise brave, oui tu peu commit

**Réponse**
- Mémoire A + C et Brave actés ; premier commit poussé sur GitHub (65bf4b2).
- Étape 1 : l'observateur (ce que voit le cerveau), le carnet (sa mémoire) et l'extension
  (capteur + panneau) sont écrits et testés :
  - 7 tests sur le vrai jeu (perception humaine : ni IVs, ni nature, ni attaques non vues de
    l'adversaire ; attaques et talent retenus une fois révélés ; tables de noms à jour) ;
  - une vérification de types prouve que notre description du jeu colle à ses vraies classes
    (testée en la cassant volontairement) ;
  - le capteur capture bien la scène du jeu local ; le panneau s'affiche correctement sur une
    vraie observation de combat double (page d'aperçu).
- Le navigateur intégré, masqué, ralentit le jeu : l'essai en direct se fait dans Brave.

**Modifications**
- `observateur/` : `types.ts` (forme de l'observation), `jeu.ts` (ce qu'on lit du jeu),
  `carnet.ts`, `observateur.ts`, `noms.ts` (généré) et `generer-noms.py`.
- `extension/` : `manifest.json`, `src/capteur.ts`, `src/panneau.ts`, `src/messages.ts`,
  `construire.mjs`, `apercu.html` + `apercu-observation.json`.
- `simulateur/` : `observateur.test.ts`, `exporter-enums.test.ts`, `lancer-tests.sh`,
  `tsconfig.verification.json`.
- Racine : `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- `README.md`, `docs/architecture.md` mis à jour.

**Objectif**
Donner au cerveau des yeux fidèles à ceux d'un joueur, écrits une seule fois pour le
simulateur et l'extension, et permettre à Carlos de voir ce que le cerveau perçoit pendant
qu'il joue.

---

## 6. Essai en direct dans Brave — 30/09/2026

**Prompt**
> [capture d'écran : le panneau « Ce que le cerveau voit » en direct dans Brave, vague 1,
> Tiplouf niv. 5 contre Chenipotte niv. 2]

**Réponse**
- Essai réussi : panneau « en direct », noms en français, argent et Poké Balls conformes à l'écran.
- Point vérifié : les IVs de Tiplouf tous à 15 sont corrects. Le jeu donne 15 dans chaque IV
  aux starters d'un compte neuf (`jeu/src/system/game-data.ts:1664`), et une nature fixe.
- Remarque : le panneau recouvre une partie du jeu (le sprite adverse, l'option « Balls ») ;
  proposition de le rendre déplaçable.

**Modifications**
- `README.md`, `docs/architecture.md` : étape 1 marquée comme validée.

**Objectif**
Confirmer en conditions réelles que le cerveau voit la partie comme un joueur, avant de
construire le cerveau lui-même.

---

## 7. Étape 2 : le cerveau v0 — 30/09/2026

**Prompt**
> oui fait toujours les commit, donc je comprend mieu pourquoi il avais rien choisi pour les pokemon de depart il y a avait pas de cerveau pour les choisir, oui tu peu faire la v0 fait tou prend controle

**Réponse**
- Commits désormais faits sans redemander (consigne de Carlos, pour ce projet).
- Précision : le panneau n'affichait rien aux starters pour deux raisons, pas de cerveau ET
  l'observateur ne regarde pas encore cet écran (team build = étape 5).
- Étape 2 réalisée : chaîne complète jeu → observateur → encodeur → cerveau → pilote → jeu,
  partagée entre simulateur et extension.
- Cerveau v0 (796 175 poids, non entraîné) : vague 4,64 en moyenne sur 64 parties, contre 4,8
  pour le hasard pur ; 0 erreur sur 128 parties. Enregistré sur le Lexar.
- Extension 0.2.0 : import d'un .cerveau, réflexion affichée (probabilités, valeur), modes
  Conseil / Auto avec vitesse, verrou Daily Run, panneau déplaçable.
- Choix technique changé : format maison .cerveau + calcul TypeScript au lieu d'ONNX (poids du
  moteur, WebAssembly) ; un test prouve l'égalité avec PyTorch.

**Modifications**
- Nouveaux : `observateur/actions.ts`, `observateur/encodeur.ts`, `observateur/valeurs.ts`,
  `pilote/pilote.ts`, `cerveau/cerveau.ts`, `entraineur/` (reseau, format_cerveau, pont, jouer,
  creer_v0, fixture_equivalence), `simulateur/environnement.test.ts`, `simulateur/outils-partie.ts`,
  `tests/` (équivalence PyTorch ↔ TypeScript), `docs/etape-2-cerveau-v0.md`.
- Modifiés : observation v2 (`types.ts`, `jeu.ts`, `observateur.ts`, `carnet.ts`), noms générés
  (+ valeurs d'interface du jeu), extension (capteur, panneau, messages, manifeste), tests.
- Environnement Python `.venv` (PyTorch 2.14, MPS disponible).

**Objectif**
Avoir un cerveau réel, même nul, qui décide dans le simulateur et dans Brave par exactement le
même chemin : c'est la base sur laquelle l'entraînement va le faire progresser.

---

## 8. Premier regard sur la v0 en mode auto — 30/09/2026

**Prompt**
> vraiment nul en effet pour linstant 😂 mais je lai vue et c'est interesant

**Réponse**
- La v0 joue en mode auto dans Brave, sans blocage signalé : l'étape 2 est validée en direct.
- Lancement de l'étape 3 (premier entraînement + tableau de bord).

**Modifications**
Aucune pour ce message.

**Objectif**
Passer du cerveau qui joue au hasard au cerveau qui apprend.

---

## 9. Étape 3 : premier entraînement et note de synergie — 30/09/2026

**Prompt** (pendant le travail)
> faut plutot donner une note sur l synergie de l ensembles des attaque avec tout les parametre environementaux pas prendre cas a ças faut qu elle puisse faire le pour et contre et garder celle qui lui donne un avantage

**Réponse**
- Règle « attaque à oublier » réécrite en **note de synergie du jeu d'attaques complet** :
  couverture des 18 types (table générée depuis le jeu), bonus de même type, stats physiques ou
  spéciales, précision, attaque de statut, couverture de l'équipe, variété des types. Chaque
  option a sa note, ses pour et ses contre, affichés dans le panneau de l'extension.
- Premier entraînement PPO lancé depuis la v0 (45 min) ; en 13 mises à jour, vague moyenne
  4,7 → 7,4 : il dépasse déjà le bot glouton (6,8).
- Tableau de bord maison (http://localhost:8766) ouvert dans Brave, mis à jour en direct.

**Modifications**
- `observateur/synergie.ts` (note de synergie), table des types dans `observateur/noms.ts`,
  `pilote/pilote.ts` (règle par note), panneau (options notées), observation (options notées).
- `entraineur/` : `reglages.toml`, `ensemble.py`, `entrainer.py` (PPO), `evaluer.py`,
  `tableau_de_bord.py` ; `tableau/index.html`.
- Simulateur : vague maximale (programme progressif), style de combat, décompte des règles.
- Tests : `tests/synergie.test.ts`, test sur un vrai écran d'apprentissage d'attaque.
- `docs/etape-3-entrainement.md`.

**Objectif**
Voir le cerveau apprendre pour de vrai, avec des règles d'accompagnement qui raisonnent sur
l'ensemble (synergie) plutôt que cas par cas.

---

## 10. « J'ai l'impression ça plafonne » — 30/09/2026

**Prompt**
> j ai l impression ça plafone

**Réponse**
- Oui : vague moyenne ~8,4 depuis ~1 400 parties. Deux causes : **le rival de la vague 8**
  (45 % des défaites, premier combat fixe du jeu) contre une équipe restée à 3 starters, car le
  cerveau ne capture pas et ne choisit pas ses récompenses (plafond structurel) ; et une
  exploration éteinte (entropie 1,43 → 0,28).
- Le ralentissement observé (174 → 14 décisions/s) venait de minuteries du jeu accumulées
  partie après partie : corrigé. Fuite de mémoire contournée (redémarrage des copies toutes les
  150 parties). Arrêt par Ctrl+C rendu propre.
- Cerveau v1 publié : vague 8,4 (meilleur coup), record 19.

**Modifications**
- `simulateur/environnement.test.ts` : ménage des minuteries, diagnostic mémoire/minuteries.
- `entraineur/pont.py` : redémarrage échelonné et parallèle des copies, arrêt par groupe de
  processus, sessions séparées ; `entraineur/entrainer.py` : arrêt propre par signal.
- `entraineur/reglages.toml` : `coef_entropie` 0,01 → 0,02.
- `docs/etape-3-entrainement.md` : résultats et diagnostic.

**Objectif**
Comprendre le plafond avec des chiffres, et remettre l'entraînement en état de tourner
longtemps et vite avant de confier de nouvelles décisions au cerveau.

---

## 11. Étape 4a : la capture — 30/09/2026

**Prompt**
> etape 4

**Réponse**
- Capture confiée au cerveau d'abord (le levier le plus direct contre le rival de la vague 8).
- 19 actions (+ 5 Poké Balls, masquées selon les vraies règles du jeu), observation v3 (« déjà
  capturé »), encodage v2 (+ 9 nombres ajoutés à la fin), récompense `capture = 0.5`.
- Greffe de la v1 (nouvelles entrées et actions à zéro) : l'entraînement 2 repart directement
  au niveau de la v1 (vague 8,35) ; les captures montent (0,7 → 1,1 par partie en 4 mises à jour).
- Tableau de bord : captures par partie, défaites par vague avec les combats fixes annotés.

**Modifications**
- `observateur/` : actions (Balls), types (v3), jeu.ts (Pokédex, isActive), observateur,
  encodeur (v2), valeurs (commande BALL).
- `pilote/pilote.ts` : lancer de Ball, équipe pleine → le nouveau n'est pas gardé.
- `entraineur/` : `greffe.py`, `test_greffe.py`, récompense de capture, captures au journal,
  `tableau_de_bord.py` (défaites par vague, combats fixes).
- `simulateur/` : taille d'équipe et captures dans l'info ; tests des Balls.
- Extension 0.3.0 ; `tableau/index.html` (graphiques défaites et captures) ;
  `docs/etape-4-capture.md`.

**Objectif**
Lui permettre de s'agrandir une équipe pour franchir le mur du rival, sans lui faire oublier
ce qu'il sait déjà du combat.

---

## 12. Gérer l'équipe et les objets comme un tout — 30/09/2026

**Prompt**
> okay c'est nice je vois que ça plafonne les pokemon a 6 maintenant mais maintenant faut essayer de justement pouvoir a gerer aussi l equipe et donc comme les attaque evaluer pas seulement le pokemon seul je sais meme pas s il fait ça mais aussi le tout en meme temps pas faire des doublon par exemple, sinon laisse continuer l entrainement il est pas encore fini juste pour preciser pour que tu fais les modif apres ou maintenant tout depend de si c'est vraiment necessaire, et fait aussi pour les objet

**Réponse**
- Réponse franche : aujourd'hui, équipe pleine = le nouveau Pokémon est toujours relâché, sans
  rien évaluer.
- L'entraînement 2 continue : les copies du jeu relisent le code partagé à chaque redémarrage
  (toutes les 50 parties), modifier le pilote maintenant changerait les règles en plein
  entraînement. Travail en deux temps : nouveaux fichiers et tests maintenant, branchement après.
- **Note d'équipe** (`observateur/equipe.ts`) : puissance offensive par type pondérée par les
  vraies stats, défense (quelqu'un résiste à chaque type), faiblesses empilées, doublons de type
  et d'espèce, solidité ; options « ne pas garder » / « remplacer X », avec pour et contre.
- **Note des objets** (`observateur/objets.ts`) : chaque récompense jugée selon l'état de
  l'équipe (Potion inutile en pleine forme, Rappel si K.O., CT par synergie d'attaques, objet de
  type pour qui a ces attaques…), meilleur receveur parmi ceux que le jeu accepte (son filtre),
  objet refusé à tous écarté.
- Adaptateurs du jeu (`observateur/decisions-jeu.ts`) prêts à brancher.

**Modifications**
- Nouveaux : `observateur/equipe.ts`, `observateur/objets.ts`, `observateur/decisions-jeu.ts`,
  `tests/equipe.test.ts`, `tests/objets.test.ts` (14 tests au total, tous verts).

**Objectif**
Que les décisions d'accompagnement (qui garder, quel objet prendre) raisonnent sur l'ensemble,
comme la note des attaques, avant de les confier un jour au cerveau.

---

## 13. « Les 45 min sont passées, on peut continuer » — 30/09/2026

**Prompt**
> les 45 min sont passer on peut continuer

**Réponse**
- L'entraînement 2 ne s'arrêtait pas : une copie du jeu figée sur un écran inconnu, et le
  Python l'attendait sans fin. Diagnostic par échantillonnage des fils du Python (un seul fil en
  lecture réseau, les autres sur des verrous). Arrêt forcé ; cerveau de la mise à jour 90 sauvegardé.
- Protections ajoutées : écran bloqué 60 s → partie arrêtée avec l'écran en cause ; copie muette
  10 min → redémarrée, l'entraînement continue.
- Notes d'équipe et d'objets branchées (pilote, observation, panneau). La note d'équipe a été
  corrigée (critère de « profondeur ») après un test sur le vrai jeu.
- 64 parties de vérification ont révélé des défauts du pilote dans l'écran d'équipe (touches à
  l'aveugle) : réécrit en « une touche par passage selon l'état de l'écran ». Résultat : 0 blocage,
  « bonus inutilisables » 780 → 0, un relâcher par remplacement.
- v2 évaluée avec les nouvelles règles et publiée ; extension 0.4.0.

**Modifications**
- `simulateur/environnement.test.ts` (détection de blocage), `entraineur/pont.py` et
  `ensemble.py` (copie muette redémarrée), `pilote/pilote.ts` (écran d'équipe, notes),
  `observateur/observateur.ts`, `types.ts`, `valeurs.ts`, `noms.ts` (options de l'écran d'équipe),
  `observateur/equipe.ts` (profondeur), panneau (équipe pleine, récompenses notées), tests,
  `docs/etape-4b-equipe-objets.md`.

**Objectif**
Que l'entraînement ne puisse plus rester figé, et que les choix d'équipe et d'objets suivent
une logique d'ensemble lisible.

---

## 14. Extension : clavier et design pixel — 30/09/2026

**Prompt**
> en attendant tes credit sur la version claude abonement je vais utiliser tes credit claude de github […] tu va juste faire le point 2 et 3 ne t'es occupe pas du cerveau occupe toi de l extension : fait gaffe pour l extension quand je fais fleche ça descend la barre de lextenision ou monte et quand je fais espace ou entre ça met en grand ou ça raptissie et essaye de de ameliorer le design deje fait un truc plus moderne plus dans le theme peut etre a la pixel art […] et va a l essentiel aussil la y a trop d info on sais pas ou regarder sinon top

**Réponse**
- Seulement l'extension (le cerveau v3 attend) : le correctif clavier et le nouveau design.
- Clavier : plus aucun élément du panneau ne prend le focus (clic sans focus, focus rendu
  aussitôt à la page). Espace et Entrée ne replient plus le panneau. Chrome faisait aussi
  défiler aux flèches la dernière zone cliquée, même sans focus : le panneau ne défile plus
  qu'à la molette. Vérifié dans Chromium : 7 touches tapées après des clics dans le panneau,
  toutes reçues par la page, panneau ni replié ni défilé.
- Design repris du jeu, sans autre IA : sa police pixel `emerald` et son cadre `window_1.png`,
  lus sur la page elle-même (pokerogue.net ou la copie locale).
- L'essentiel d'abord : en haut ce que le jeu attend et le choix du cerveau en gros (avec sa
  probabilité et les 3 autres options), puis adversaires et équipe en une ligne chacun ; le
  reste (partie, fiches IVs/attaques, carnet, cerveau) replié et retenu d'une fois sur l'autre.
- Boutons pixel à la place des cases et de la liste : CONSEIL / AUTO, et la vitesse
  (LENT / NORMAL / RAPIDE) qui n'apparaît qu'en auto. Replié, le panneau ne garde que le choix.

**Modifications**
- `extension/src/panneau.ts` (réécrit), `extension/apercu.html` (ressources du jeu, touches
  reçues affichées), `extension/manifest.json` (0.5.0).

**Objectif**
Que le panneau ne vole plus jamais les touches du jeu, et qu'on voie d'un coup d'œil ce que
le cerveau décide, dans le style de PokeRogue.

---

## 15. Vérifier l'extension du cloud, le cerveau qui « fuit le combat », v3 et productivité — 30/09/2026

**Prompt**
> l'extension j'ai demandé à une autre session de claude mais dans le cloud pour continuer avec les crédits de github fais le nécessaire pour mettre à jour localement et voir si ça colle avec ce qui a été demandé sinon j'ai testé le cerveau avant celui qu'on vient d'entraîner donc le premier v2 et j'ai remarqué, alors j'ai choisi le pokemon moi-même bah il faisait tout pour éviter le combat j'avais l'impression genre il échangeait à chaque fois les pokemon du banc et choisissait ensuite avec le dernier pokemon en vie une attaque qui fait pas de dégâts final des comptes il est même pas passé à la vague 2 j'espère le comportement a été corrigé depuis sinon on peut continuer les entraînements publier la v3 et augmenter la productivité
>
> (en cours de route) montre moi la fenetre aussi je veu voir

**Réponse**
- Extension 0.5.0 de la session cloud récupérée (avance rapide de main) et conforme : flèches,
  Espace et Entrée arrivent au jeu, le panneau ne se replie ni ne défile ; style pixel du jeu.
  Seul défaut : le chemin des ressources de l'aperçu (jeu/public → jeu/assets), corrigé.
- « Fuite du combat » : non reproduite. Au simulateur, la v2 joue normalement avec six trios de
  starters (1 à 3 % de changements). Dans la copie locale du vrai jeu, avec la vraie extension en
  mode auto et Kaiminus + Héricendre + Carapuce : vague 15, aucun refus, même avec le jeu figé.
  Le code de combat de pokerogue.net est identique au nôtre. Cause la plus probable : une
  ancienne version de l'extension encore chargée dans Brave (à recharger).
- La fenêtre : le panneau Navigateur de l'app était masqué de son côté ; captures envoyées.
- Entraînement 3 : pas de progrès net sur la v2 (24,66 contre 22,44 avec Kanto, mais 22,1 contre
  25,0 avec les autres starters) : pas de v3 publiée.
- Productivité : collecte asynchrone, et la fuite principale du simulateur trouvée (écouteurs
  d'animation), plus trois petites. 86 → 189 décisions/s en moyenne sur un banc de 4 minutes
  (entrainement-3 : 30). Entraînement 4 lancé (120 min, starters au hasard).

**Modifications**
- `extension/apercu.html` (chemin des ressources).
- `entraineur/diagnostic_starters.py` (nouveau), `entraineur/entrainer.py` (collecte asynchrone,
  `--simulateurs`), `entraineur/ensemble.py` (starters au hasard, `jouer` public),
  `entraineur/pont.py` (redémarrage toutes les 25 parties, échelonné), `entraineur/reglages.toml`
  (`starters = "hasard"`, `coef_entropie = 0.015`).
- `simulateur/environnement.test.ts` (fuites colmatées, compteurs de diagnostic, console coupée,
  correction de type).
- `docs/etape-4c-diagnostic-et-vitesse.md`.

**Suite (01/10, fin de l'entraînement 4)**
950 000 décisions en 2 heures (entrainement-3 : 110 000 en 1 heure). Cerveau final : 22,81 (Kanto)
et 22,3 (six trios), pas mieux que la v2 : pas de v3. Les défaites se concentrent sur le rival
(vagues 8 et 25 : 55 % des défaites) et le boss de la vague 20 : c'est là qu'il faut agir.

**Objectif**
Vérifier le travail du cloud, comprendre le comportement vu dans Brave avant de toucher au
cerveau, et entraîner plus vite : chaque heure d'entraînement joue maintenant environ quatre fois
plus de décisions.

---

## 16. Le mur du rival, puis toute la suite d'un trait — 01/10/2026

**Prompt**
> analyse les défaites contre le rival d'abord et fait ensuite lz suite mais tout a la suite
>
> (en cours de route) je t avoue jai pas tout lu des le debut mais si c'est deja pas fait lui emporter peut etrer avec des api toutes les attaque de chaque pokmemon qui est possible et a quel niveau comme ça il sais d avance quest que sont adversaire peut avoir comme attaque talent çacher etc et sais de quoi faut se mefier, comme ça elle a moin d hesitation deja que je vois que son hesitation monte
>
> faut qu il connaissae tout les pokemon imaginon il le voit sauvage faut qu il çapture et le remplacer par un autre parce que c'est un bon pokemon faut pas quil pense que c'est bon il a çapturer les 3 ila plus besoin de capturer

**Réponse**
- Analyse (récit de partie + `entraineur/analyse_defaites.py`, 320 parties) : contre le rival, le
  cerveau est à niveau égal mais arrive blessé (au boss de la vague 20 : 68 % de PV pour les
  perdants, 86 % pour les gagnants) et choisit 5 fois plus d'attaques de statut quand il perd.
  Les captures sont indispensables (sans : vague moyenne 8,9 au lieu de 24).
- Soins avant les combats importants (rival, champion, boss) et achats en boutique : même
  cerveau, vague moyenne 23,7 → 27,2.
- Prochain combat important dans l'observation (encodage v3), affiché dans le panneau.
- Fuites de mémoire : trouvées par comptage d'objets et photo de la mémoire (terrain, cadres
  d'info, interface, étincelles, icônes d'équipe, file d'animation) ; il reste une petite fuite
  de textes, compensée par un redémarrage des copies toutes les 30 parties.
- Idées de Carlos : connaissance « Pokédex » générée depuis le jeu, sans API en ligne (attaques
  par niveau, talents possibles dont le caché, immunités, potentiel de la forme finale) dans
  l'observation (encodage v4) et dans le panneau (« À craindre pour X : … ») ; la note d'équipe
  tient compte du potentiel ; chaque capture gardée est récompensée, même équipe pleine.
- Entraînement 5 (arrêté à 1 h 50, plateau) : au-dessus de la v2 (27,3 contre 25,1 dans les mêmes
  conditions) → publié **v3** (27,17 à l'évaluation officielle, record 95).
- Entraînement 6 (connaissance, recrues) : moins bon (24-25) ; ni les Balls ni la note d'équipe
  n'en sont la cause, c'est le combat qui s'est dégradé. L'apprentissage plafonne vers la vague
  27 : les gains viennent des règles de joueur. Pistes notées dans docs/etape-5-rival.md.
- Productivité : une copie figée bloquait la collecte 10 min → délai de silence 2 min.

**Modifications**
- Nouveaux : `entraineur/analyse_defaites.py`, `observateur/combats.ts`, `observateur/especes.ts`,
  `observateur/donnees-especes.ts` (généré), `observateur/generer-especes.py`,
  `simulateur/exporter-especes.test.ts`, `tests/combats.test.ts`, `tests/especes.test.ts`,
  `docs/etape-5-rival.md`.
- Modifiés : `simulateur/environnement.test.ts` (récit, ménage entre parties, diagnostics
  PONT_COMPTAGE / PONT_INSTANTANE, recrues), `simulateur/outils-partie.ts`, `observateur/objets.ts`
  (soins avant combat, boutique), `observateur/decisions-jeu.ts`, `pilote/pilote.ts` (achats),
  `observateur/encodeur.ts` (v3, v4), `observateur/types.ts` (v4), `observateur/equipe.ts`
  (potentiel), `observateur/noms.ts` (combats fixes), `entraineur/ensemble.py` (recrues),
  `entraineur/reseau.py` (anciens cerveaux), `entraineur/reglages.toml` (vague_max 75),
  `extension/src/panneau.ts` (0.7.0).

**Objectif**
Comprendre précisément pourquoi le cerveau bute sur le rival, corriger ce que les règles font mal
(se soigner, acheter), donner au cerveau ce qu'un joueur sait (le prochain combat, le Pokédex), et
récompenser une bonne équipe plutôt qu'une équipe pleine.

---

## 17. Dépasser le plafond : entraînement ciblé, puis prévoir l'IA adverse — 01/10/2026

**Prompts**
> oui on peut essayer de daplcer le plafond
>
> (pause) on arrete la arrete tout je reprend plus tard — aller on continue l entrainement
>
> je vien de me renseigner et le facteur clee pour pouvoir gagner c'est d anticiper l ia adverse elle est souvent trop dans la superefficaciter et le changement de pokemon faut jouer sur ça et fabriquer notre ia pour contrer en predisant pile poile se qu'elle va faire un peu comme une partie d echecs, on analyse pas seulement la position actuel mais les position eventuel future aussi en trouvent qu elle est le meilleur chemin, l ia ne bluff jamais comme elle ne fait jamais de bluff en essayant de predire le mouvement humain c'est a nous de predire et parfois pas prendre toujours la meilleur attaque sur la situation actuel mais plutot sur la prochaine situation, je vois que notre ia stagne trop dans les 30 depuis 1h

**Réponse**
- Entraînement ciblé : photos du début des combats qui bloquent (la sauvegarde que fait le jeu),
  reprises comme « Continuer » ; une partie sur deux repart d'une photo, le combat le plus raté
  étant tiré le plus souvent. Entraînement 7 : moins bon que la v3 (25,2 contre 27,4).
- IA adverse lue dans le jeu : elle choisit son coup contre le Pokémon en face d'elle avant ton
  changement, K.O. d'abord, puis puissance × efficacité (elle adore le super efficace).
- Prédicteur (`observateur/prevision.ts`) mesuré sur 12 250 coups : 65 % d'attaques annoncées
  exactement (proche du maximum, un sauvage tire au sort 3 fois sur 8). Donné au cerveau
  (encodage v5) et affiché dans le panneau (0.8.0).
- Diagnostic du plafond : les entraînements 6 et 7 payaient chaque remplacement → supprimé ;
  pas d'apprentissage réduit. Entraînement 8 lancé (v3 greffée + prévision + ciblé).

**Modifications**
- Nouveaux : `observateur/prevision.ts`, `tests/prevision.test.ts`, `docs/etape-6-entrainement-cible.md`,
  `docs/etape-7-prevision.md`.
- Modifiés : `simulateur/outils-partie.ts` (photos, reprise), `simulateur/environnement.test.ts`
  (photos, départ, précision du prédicteur), `entraineur/ensemble.py` (réserve de photos, tirage
  adaptatif, récompense des captures), `entraineur/entrainer.py`, `entraineur/pont.py`,
  `entraineur/tableau_de_bord.py`, `entraineur/analyse_defaites.py`, `entraineur/reglages.toml`,
  `observateur/encodeur.ts` (v5), `extension/src/panneau.ts`.

**Objectif**
Que le cerveau joue avec un coup d'avance sur l'IA adverse, et cesser d'être payé pour autre
chose que gagner.

---

## 18. Recherches de stratégie, audit des possibilités, planificateur — v4 — 01/10/2026

**Prompt**
> vasy on continue, verifie aussi que le bot aies acces a toutes les possibiliter et si y a pas un truc qu il rate, informe toi sur les wiki les reddit comment on fait pour avoir des run presque parfaite et pour alterer le cerveau pour qu'il se dirige vers la, sinon on peu continuer juste petite question j ai fait refresh de l extension j ai voulu mettre le cerveau mais ça na pas marche c'était ecrit que c'est pas compatible le cerveau avec l extension parce que le cerveau a ete entrainer d une autre version

**Réponse**
- Extension : la 0.8.0 accepte la v3 (vérifié) → Brave avait une version plus ancienne ; version
  affichée dans le panneau, message de refus clair ; piège corrigé (en-tête d'un cerveau republié).
- Recherches : stratégie du porteur, argent gardé pour la fin, rotation contre les boss ; vérifié
  dans le code : soin complet au changement de biome, récompenses du rival.
- Audit : 6 manques (planificateur, « changer ? » après K.O., bonbons, Total Soin, rencontres
  mystères, relances/Téra/biome) ; 3 corrigés.
- Planificateur (« comme aux échecs ») : cerveau guidé × 30 → 52,7 de vague moyenne avec starters
  au hasard (27,9 seul). **v4 publiée : 53,33, record 115.** Entraînement 9 lancé par-dessus.

**Modifications**
- Nouveaux : `observateur/planificateur.ts`, `tests/planificateur.test.ts`, `docs/etape-8-planificateur.md`.
- Modifiés : `cerveau/cerveau.ts` (poidsPlan), `entraineur/reseau.py`, `format_cerveau.py`,
  `jouer.py`, `evaluer.py` (--plan, versions d'origine), `entrainer.py` (plan dans PPO, --plan),
  `greffe.py`, `analyse_defaites.py` (--plan, --vague-max), `pont.py` (plan),
  `simulateur/environnement.test.ts` (plan envoyé), `observateur/prevision.ts` (cible au choix),
  `observateur/objets.ts` (porteur, Total Soin), `extension/src/panneau.ts` (0.9.0), `reglages.toml`.

**Objectif**
Jouer comme un humain qui voit un coup d'avance, et suivre ce que font les meilleurs joueurs.

---

## 19. Captures, rencontres mystères, rapport du rival, préparation — 01/10/2026

**Prompts**
> je vien de voir l ia en action et sur les premiere vague, l ia va toujours essayer de çapturer les pokemon […] si un pokemon est rancunier ils rentre pas et finira par mettre ko les pokemon et peut tu remettre le http://localhost:8766/
>
> le mode auto c'est arreter ici je sais pas si c'est parce que il a jamais vu ça en partie local mais la il bloque (capture : rencontre mystère « Promos au Centre Commercial »)
>
> les 10 minutes sont passer ça fait 25 min on fait quoi maintenant ?
>
> on voit que l ia meurt le plus souvent face au rival faut faire en sorte que il capture et aprennent des attaque counter de ceux du rival surtout sur le pokemon carry
>
> faut aussi que on puisse avoir des rapport avec une reproduction de la partie pour pouvoir analyser pourquoi encore il arrive pas a passer le rival de vague 8 […] il devrais avoir 0 defaite avant la vague 10

**Réponse**
- Tableau de bord relancé.
- Captures : chance de capture par la formule du jeu (affichée dans le panneau). Mesuré : laisser
  le planificateur juger les Balls fait perdre (35,3 et 31,9 contre 37,1) → les Balls restent au
  cerveau ; les captures fréquentes rapportent plus qu'elles ne coûtent.
- Rencontres mystères : le pilote choisit une option, choisit un Pokémon, passe les éclosions,
  revient au menu de combat ; testé (rencontres forcées puis au rythme du jeu) : aucun blocage.
- Entraînement 9 : 35,1 contre 37,1 (v4) → pas de v5.
- Rapport des défaites contre le rival avec reproduction tour par tour (`entraineur/rapport_rival.py`) :
  porteur faible face au starter du rival (tiré au hasard), banc en retard, combat perdu dès le
  premier tour → préparation au rival dans les notes d'attaques et d'équipe : rival 2 65 % → 80 %,
  rival 1 90 → 91 % (défaites serrées, en partie dues aux starters tirés au hasard).

**Modifications**
- Nouveaux : `observateur/capture.ts`, `entraineur/rapport_rival.py`.
- Modifiés : `pilote/pilote.ts` (rencontres mystères, équipe, éclosions, menu d'attaque),
  `observateur/valeurs.ts`, `observateur/planificateur.ts` (option capture), `observateur/combats.ts`
  (prochainRival, typesAPreparer), `observateur/synergie.ts`, `observateur/equipe.ts`,
  `observateur/objets.ts`, `observateur/decisions-jeu.ts`, `observateur/especes.ts` (taux de capture),
  `simulateur/environnement.test.ts` (mysteres, journal de combat), `entraineur/pont.py`,
  `entraineur/analyse_defaites.py`, `extension/src/panneau.ts` (0.9.3).

**Objectif**
Que le mode auto ne bloque plus dans le vrai jeu, voir précisément pourquoi le bot perd contre le
rival, et le préparer comme un joueur prépare ce combat.

## 20. Juger le top 3 des coups adverses — 01/10/2026

**Prompt**
> regarde si le probleme ne vient pas du fait que quand il essaye de prevoir un moov par exemple un remplacement ver un pokemon feu donc d utiliser une attque eau mais sur un pokemon sur le terrain qui est en eau […] essaye de faire en sorte qu il evalue avec une formule mathematque quel decision prendre pour l ensemble du top 3 et non pas le coup qu'il pense prevue

**Réponse**
- Vérifié : le planificateur ne jouait pas « tout sur un coup » ; il utilisait déjà les dégâts
  moyens pondérés par les probabilités du top 3.
- Ajouté l'évaluation par scénarios (espérance, avec une part de prudence) : moins bonne
  (36,4 et 34,5 contre 38,8) → option désactivée par défaut.

**Modifications**
- `observateur/planificateur.ts` (options `scenarios`, `prudence`), `simulateur/environnement.test.ts`,
  `entraineur/pont.py`, `entraineur/analyse_defaites.py` (`--scenarios`, `--prudence`).

**Objectif**
Vérifier que les décisions ne reposent pas sur un seul coup adverse supposé.

## 21. Prévoir les changements de Pokémon adverses — 01/10/2026

**Prompt**
> quoi mais c'est la base de la prediction c'est savoir quand ils changent les pokemon
>
> c'est normal que l entrainement du cerveau j ai l impression il est arreter je vois depuis un moment 50.0 sans bouger
>
> parce que en sois c'est le dernier truc qui permet d augmenter les chance de gagner si on considere l echange de pokemon

**Réponse**
- Règle du jeu relue (EnemyCommandPhase) : seuls les dresseurs changent, quand un membre du banc
  fait 3 fois mieux (2 fois pour un boss) au score de duel.
- Mesuré : 89 % des changements vont vers un Pokémon jamais vu. Nouvelle prévision à partir des
  Poké Balls restantes et du score de duel du Pokémon actuel : 61 % des changements annoncés
  (avant 12 %), 7 annonces sur 10 justes. Affichée dans le panneau (0.9.4).
- Dans le planificateur : aucun gain mesurable sur 480 parties (35,6 → 36,2 / 36,0, rival 2
  73 → 68 / 71 %). L'IA change quand on gagne déjà l'échange ; nos défaites viennent des tours où
  elle reste. Option désactivée par défaut.
- Bruit des mesures découvert : 160 parties ne suffisent pas (38,8 puis 34,8 / 34,9 / 37,0).
- Entraînement 9 : arrêté à 18 h 27 pour libérer la machine pendant les mesures (d'où le 50,0 figé).

**Modifications**
- `observateur/carnet.ts` (banc vu), `observateur/types.ts` (observation v5, champ `banc`),
  `observateur/observateur.ts`, `observateur/prevision.ts` (`scoreDuel`, `scoresChangement`,
  `prevoirChangement`), `observateur/planificateur.ts` (option `changements`),
  `simulateur/environnement.test.ts` (justesse des annonces, calibration), `entraineur/pont.py`,
  `entraineur/analyse_defaites.py` (`--changements`), `extension/src/panneau.ts`, manifest 0.9.4,
  `docs/etape-9-changements.md`.

**Objectif**
Que le bot sache, comme un joueur, quand le dresseur va changer de Pokémon, et vérifier par la
mesure si en tenir compte fait gagner.

## 22. Ce que Carlos voit en jeu : captures, porteur, doubles, argent, PNJ — 01-02/10/2026

**Prompts**
> regarde a un moment il a fait une moyenne a 60 et la sa descend sans plus jamais redescendre […]
>
> tu peu mettre disponible le cerveau le plus fort dans la section cerveau
>
> […] il sacharne avec des pokeball sur un pokemon alors qu il a deja toute l equipe de 6 et il a pas fait la liason que si on affaiblit un pokemon il a plus de chance de çapturer […]
>
> j ai remarquer pour un combat 2v2 il a pas voulu sortir un pokemon qui avait une faiblesse face au deux autre […] quand le pokemon meurt et qu il est reanimer il le joue plus vraiment pour le monter […] il bloque encore sur les npc qui propose des objet […] vague 60 essayer de capturer des pokemon et que l equipe un a un meurt […] il va jamais achetter de total soin […] morte vague 66 contre un dresseur, parce plus d argent pour la boutique pour revive le çarry (zacian) […]
>
> la capture fais en sorte que elle s active uniquement si l equipe n est pas complete ou que le pokemon servira a remplacer un autre et sans risque pour nos propre pokemon […] jamais les laisser full hp pour les capturer
>
> oui pour les debut pourquoi pas les pokeball mais pas au bout d un moment ou ça sert plus rien
>
> […] oublie pas tout ce qu on avais dis […] relire ces passage voir si tu n oublie rien et fait tout dans l opti
>
> si rien ne marche une chose que je autorise pour l entrainement de l ia est de tricher […] en lui montrant des run parfaite et elle essayera de reproduire […] chaque seed est 100% gagnable […]

**Réponse**
- Courbe : la fenêtre des 200 parties repartait vide à la reprise (pic à 60) ; corrigé. Cerveaux
  de l'entraînement 9 évalués sur 480 parties : pas de recul, un plafond (130 : 37,7).
- **v5** = cerveau 130, « Le plus fort » sur le tableau de bord (bouton Télécharger).
- Captures : la règle complète mesurée (affaiblir d'abord) faisait perdre (rival 1 91 → 76 %) ;
  retenu : Ball inutile ou dangereuse interdite quand sa chance est sous 50 %.
- Changement gratuit en début de vague (style « Changer ») + porteur favorisé ; combats doubles
  (les coups des deux adversaires) ; réserve d'argent pour un Rappel dès la vague 30 ; Balls en
  récompense moins prisées avec l'équipe pleine. Mesures : neutres dans le bruit (±2 vagues).
- Test des 31 rencontres mystères : Delibird-y fige le jeu ; Fun and Games et Safari parfois.
- Statuts : rares (4 % des vagues), Total Soin acheté quand il est en vente.
- Idée du professeur qui « triche » pendant l'entraînement : plan proposé (rejouer chaque vague
  plusieurs fois, garder la meilleure, faire imiter le cerveau).

**Modifications**
- `observateur/planificateur.ts` (règle de capture, `changerAuDebut`, `valeurEntree`,
  `BONUS_PORTEUR`, `degatsDesAutres`), `pilote/pilote.ts` (changement gratuit),
  `observateur/objets.ts` (réserve, Balls), `simulateur/environnement.test.ts` (`mystere`,
  compteurs `achats`, `recompenses`, `statuts`), `entraineur/pont.py`, `entraineur/analyse_defaites.py`
  (redémarrage des copies, copies figées, `--style`), `entraineur/entrainer.py` (fenêtre glissante,
  disque qui disparaît), `entraineur/tableau_de_bord.py` et `tableau/index.html` (le plus fort),
  nouveau `entraineur/tester_mysteres.py`, `docs/etape-10-retours-de-jeu.md`, extension 0.9.5.

**Objectif**
Corriger ce que Carlos voit en regardant jouer le bot, en vérifiant chaque correction par la mesure.

## 23. Le professeur qui triche, et les rencontres qui bloquaient — 02/10/2026

**Prompts**
> pour la prochaine etañe tu peu faire les 2 en meme temps ya pas de soucis
>
> hesite pas non plus a la fin donner les chiffre quel vague moyenne ça fait et les rivaux

**Réponse**
- Rencontres mystères : trace + garde-fou contre les boucles du pilote ; Delibird-y (filtre de
  l'écran), Zone Safari (équipe pleine), Fun and Games (menu d'attaques imposé) corrigés ;
  30 rencontres sur 31 passent (Delibird-y : seulement le cas impossible forcé par le test).
- Professeur : rejoue chaque vague 8 fois (température pour varier les décisions), garde le
  meilleur essai, recule face à un mur ; 7 parties d'essai sur 7 au bout de la vague 60.
- Élève : imitation supervisée des choix du professeur.

**Modifications**
- `pilote/pilote.ts`, `observateur/decisions-jeu.ts`, `simulateur/environnement.test.ts` (trace,
  garde-fou, bilan, photo de la vague suivante), `entraineur/pont.py`, nouveaux
  `entraineur/professeur.py` et `entraineur/imitation.py`, `docs/etape-11-professeur.md`,
  extension 0.9.6.

**Objectif**
Que le mode auto ne bloque plus sur aucune rencontre, et donner au cerveau des parties
quasi parfaites à imiter (triche permise par Carlos à l'entraînement seulement).

## 24. Le juge de coups — 02/10/2026 (soir)

**Prompts**
> reprend fait tous ce que tu veu
>
> attention mon disque dur a ete deconnecter

**Réponse**
- Imitation du professeur en bloc : rien de gagné (36,1 contre 37,2) ; les exemples sont du bruit.
- Juge de coups : chaque décision importante rejouée à l'identique (hasard du jeu conservé) avec
  ses 3 coups les plus probables, finie sur 3 avenirs ; le meilleur en moyenne devient l'exemple.
- Premier élève du juge (40 parties) : 36,7 / 92 % / 73 % contre 37,2 / 95 % / 73 % pour la v5 —
  jeu égal ; il généralise (23 % des corrections retrouvées), il faut plus d'exemples.
- Disque déconnecté : rien d'abîmé (tout relu) ; le juge réessaie ses écritures 2 minutes.

**Modifications**
- Nouveau `entraineur/juge.py` ; `simulateur/environnement.test.ts` (hasardDuJeu, graine changée
  en pleine vague, info « important ») ; `entraineur/pont.py` ; `entraineur/imitation.py` (poids,
  confirmations) ; tableau de bord (sections Professeur et Juge) ; docs.

**Objectif**
Donner au cerveau des exemples où l'on sait vraiment quel coup était le meilleur.

## 25. Le plafond de verre — 02/10/2026 (soir)

**Prompt**
> ou sont passer la moyenne des vague a 50, et demande des hypothese a dautre ia pour voir se quel pense le probleme du plafond de verre […] est ce que on a atteint la vrai limite ? regarde comment se debrouille et le conseil des jouer qui font que avec des starter disponible au debut ou randoms […]

**Réponse**
- v5 sans limite : 49,1 (les 36-37 étaient des mesures arrêtées à la vague 50).
- Avis de Sonnet 5.5 et Haiku 4.5 (Fable indisponible, crédits épuisés) ; vérifiés : le plan
  décide presque tout (le cerveau s'en écarte nettement dans 0,7 à 5,5 % des cas) ; le modèle de
  nos attaques ignore précision, priorité et barres des boss.
- Joueurs : défi Fresh Start = nos conditions ; conseils (porteur, argent gardé pour la fin,
  biomes, boosts, statuts sur les boss).

**Modifications**
- `docs/etape-12-plafond.md`. Juge en pause (65 parties gardées).

**Objectif**
Comprendre le plafond avant d'aller plus loin, et choisir la suite sur des faits.

## 26. Autonomie : le rival 1 — 02-03/10/2026 (nuit)

**Prompts**
> prochaine etape tu peut tourner en arriere plan et tout faire de maniere organiser […] ne pas venir a la conclusion l adversaire etait trop fort ou c'était une partie serrer […] il y a toujours une raison a çause d une decision precedente […] je serais deja content si les ia passe le premier rival a 100% […]
>
> un indice […] tu peu reprendre la graine et jouer la partie parfaite […] si tu vois qu elle etait gagnable tu pourra mieu voir ensuite d ou vient les erreur […]
>
> bonne initiative de faire un equilibrage, quand t'aura bien optimiser tout ça […] faire en sorte que l ia construise elle meme l equipe de starter mais avec une plus grosse base de starter […] l entrainer sur le late game pour tenter de faire en sorte que elle reussi le lvl 200 le plus de fois possible […] elle avait du mal dans les vagues 110

**Réponse**
- Cause n° 1 au rival 1 : son starter, tiré au hasard, contre notre porteur (15 % de défaites,
  trois quarts du total). Parties perdues rejouées par le professeur : 24/24 gagnables ; deux
  tiers mal jouées pendant le combat.
- Moteur de combat d'équipe (le combat entier simulé pour chaque coup) : 92-94 → 96 %.
- Bug : le porteur était relâché avant le rival (2 à 10 % des parties) ; corrigé.
- Le porteur garde l'expérience avant le rival ; priorité, barres des boss, oiseau du rival.
- Trio Plante + Feu + Eau : rival 1 99-100 %. Sans limite : 49,1 → 53,6 (rival 2 : 72 → 84 %).

**Modifications**
- Nouveaux : `observateur/combat-equipe.ts`, `observateur/priorites.ts`,
  `observateur/effets-statut.ts`, `entraineur/rejouer_defaites.py`, `entraineur/diagnostic_vague.py`,
  `entraineur/juge_cible.py`, `docs/etape-13-rival-1.md`.
- Modifiés : planificateur (moteur, porteur, second), `equipe.ts` (porteur jamais relâché,
  couverture), `objets.ts` (Super Bonbon), simulateur (description des coups), analyse
  (`--sans-equipe`, `--trio-equilibre`), tests, extension 0.9.8.

**Objectif**
Passer le rival 1 à 100 % en corrigeant les vraies décisions fautives, mesurées une par une.

## 27. Autonomie : la fin de partie et le banc apparié — 03/10/2026 (matin)

**Prompts**
> (suite de l'entrée 26 : entraîner la fin de partie, viser la vague 200)
>
> okay juste importe dans le dossier cerveau le cerveau qui a le meilleur resultat pour li nstant et on continue ça un autre moment ça fais quand meme 10h on est deja le matin du lendemain 😂

**Réponse**
- Bug de mesure trouvé : la même graine donnait des parties différentes (nature des starters tirée
  sans graine) ; corrigé, les parties sont reproductibles.
- Banc apparié : les mêmes 480 parties pour chaque version ; bruit ±2 → ±0,6 à 1,3 vague.
- Diagnostic « et si » (triche d'entraînement) : avec 5 Multi Exp au départ, le banc suit le
  porteur et la moyenne passe de 55 à 91,6 (rival 2 : 75 → 100 %). La cause des défaites jusqu'à
  la vague 66 est la profondeur de l'équipe.
- Dix essais pour y arriver sans tricher : neutres ou perdants (l'expérience totale est fixée par
  le jeu). Trio conseillé : 57,3 contre 55,7.
- Meilleur cerveau : toujours la v5, copiée dans `cerveau/le-plus-fort-v5.cerveau` ; extension 0.10.0.

**Modifications**
- Nouveaux : `entraineur/banc_complet.py`, `entraineur/diagnostic_tardif.py`, `docs/etape-15-banc-apparie.md`.
- Modifiés : simulateur (starters selon la graine, objets de départ, récompenses proposées),
  `objets.ts` (expérience et plafond de niveau), carnet (starter du rival), moteur (spécialité des
  champions, starter du rival), pilote (vrai carnet), `diagnostic_vague.py --banc`, extension 0.10.0.

**Objectif**
Mesurer assez juste pour voir des gains d'une demi-vague, et trouver la vraie cause du plafond
avant d'y investir.

## 28. Retours de jeu : objets et argent — 04/10/2026

**Prompts**
> je suis de retours on peut continuer alors a savoir j ai fais le test du cerveau, on peu nottament apercevoir des mauvaise gestion des objet […] il devrais economiser pour les moment difficile […] il n a pas pris le dynamax et a preferer une CT […] il prend la potion gratuite alors que si il paye la potion et prend la pepite il y gagne […] il decide d envoyer une pokeball au pokemon full life […] mauvais choix sur les CT […] il esquivais les charme exp […] parfum de double combat […] il a skip 2 bonboniere […] la partie c'est fini puisque j avais plus d argent pour reanimer […] y a un fosser entre ce que un humain arrive a analyser […] peut etre on commence a arriver a un moment ou l ia dois juste s entrainer et s apercevoir par elle meme […]
>
> petit truc pour que tu regle a un autre moment c'est que quand l equipe est pas a 100% complete l extension me met 100% de capture […] plutot ecrire 99% et 1% avec une alternative […] imaginon s'il etait contre un dresseur il aurait fait quoi

**Réponse**
- Ces décisions (objets, boutique, CT) sont des règles écrites, pas apprises : chaque remarque a
  été corrigée directement, puis mesurée sur le banc apparié.
- Règles du jeu vérifiées : Pépite = l'argent d'une vague = prix de base de la boutique ; soin et
  réanimation complets à chaque nouveau biome.
- Objets et argent : +2,29 ± 1,37 vague (55,7 → 58,0) ; attaques trompeuses : +0,65 (58,6).
- Panneau : jamais 100 % s'il existe une autre action ; alternative « sans capturer ».

**Modifications**
- `observateur/objets.ts` (valeur de l'argent, Pépites, soins gratuits plafonnés par leur prix,
  boutique économe, Bonbonnière, Leurres, bracelets selon l'équipe, Charmes et Multi Exp),
  `decisions-jeu.ts` (argent, prix, formes Méga/Gigamax), `planificateur.ts` (Balls équipe pleine),
  nouveaux `observateur/generer-attaques.py` et `contraintes-attaques.ts` (synergie, moteur,
  prévision), `extension/src/panneau.ts`, tests, `docs/etape-16-retours-objets.md`, extension 0.10.1.

**Objectif**
Corriger les décisions hors combat qu'un joueur voit tout de suite, et dont la partie dépendait.

## 29. Nouveau cadre de travail et Phase 0 (audit sans code) — 04/10/2026

**Prompt** (résumé : prompt structuré en sections rôle, objectif, situation, règles du jeu, règles
perso, diagnostic H1-H7, architecture cible, matrices M0-M4, state, RL, évaluation, méthode par
phases, contraintes de code, mémoire du projet)
> Tu es mon ingénieur senior […] Un bot qui décide comme un joueur humain […] Cible de départ : faire
> monter la vague moyenne de façon mesurable […] Ne code rien. Fais la Phase 0 : 1. Reformule le
> projet en 10 lignes maximum […] 2. Pose-moi tes questions manquantes en une seule fois (5 maximum)
> […] 3. Vérifie dans le code du jeu chaque règle de <regles_du_jeu_immuables> […] 4. Donne le plan
> de phases avec l'effort estimé, les risques, et ce qui te semble infaisable. 5. Crée REGLES.md.
> Puis attends mon "GO phase 1".

**Réponse**
- Règles vérifiées dans PokéRogue `v1.12.0.11` (cloné au tag exact) :
  - confirmées : 200 vagues, biomes de 10 vagues, soin gratuit complet (PV, PP, statut, K.O.) au
    passage X0 → X1, boutique d'abord puis récompense, pas de boutique aux X0, overrides présents ;
  - différentes de ce qui était écrit : champion d'arène seulement toutes les 30 vagues (20/50/80…
    ou 30/60/90…, une chance sur deux par graine) ; aucune récompense au choix aux vagues X0 (Charme
    Exp imposé) ; un gros coup peut casser plusieurs segments ; un boss de dresseur ne gagne pas
    de boost ; les légendaires sauvages sont des boss à toute vague ; aucun inventaire de soins
    (appliqués tout de suite) ; les crans durent entre sauvages du même biome, mais pas avant un
    dresseur, une rencontre mystère ou un nouveau biome.
- Audit : l'architecture cible existe déjà en grande partie (state versionné, pilote, garde-fous
  boutique, règles d'objets, planificateur, moteur d'équipe, banc apparié). Manques : variables du
  state (pièges, objets passifs, historique des changements, prochain soin), segments contre les boss
  sauvages, relances, transferts, biome, statistiques de mesure (écart-type, p10/p90, morts par
  type).
- Corrections : la mesure n'est pas « starters aléatoires » mais un banc apparié (trio
  Plante/Feu/Eau par graine) ; la dernière mesure est 58,6, pas 57 ; l'erreur-type à utiliser
  est celle des différences appariées.
- Plan de phases avec efforts et risques ; vague 200 jugée hors de portée à court terme.
- Question GitHub : déjà réglée (dépôt Loogatoxx/pokerogue-bot, entrée 3).

**Modifications**
- Nouveaux : `REGLES.md` (règles du jeu sourcées, règles de Carlos, décisions d'architecture),
  `BACKLOG.md` (11 idées hors phase), `RESULTATS.md` (mesures d'avant protocole).
- Aucun code modifié.

**Objectif**
Repartir sur une base écrite et vérifiée, pour qu'aucune règle du jeu ne soit plus oubliée ni
devinée, et savoir ce qui existe déjà avant d'investir dans une phase.

## 30. Phase 1 : instrumentation, protocole figé, baseline — 04/10/2026

**Prompt**
> question 1 je suis d accord, question 2 on peu faire la reponse a, 3 je suis d accord, 4 je suis
> daccord, on est la pas pour tout refaire mais justement detecter les anomalie et tout corriger,
> oui c'est vrai les objet non pas le meme poid/valeur selon la situation et la vague. GO

**Réponse**
- Décisions actées :
  - le banc apparié devient le protocole figé ;
  - les bancs officiels tournent sur le Mac ;
  - on mesure « cerveau v5 » contre « plan seul » ;
  - pas de commentaire dans le nouveau code, et les anciens restent.
- Le simulateur tourne maintenant aussi dans le cloud : Node 24, jeu au tag `v1.12.0.11`, seulement
  les données JSON du dépôt d'images. Une partie complète prend environ 4 s.
- Instrumentation, sans changer aucune décision (vérifié : 6 parties identiques avant et après) :
  - type du combat perdu (rencontre mystère, dresseur, sauvage) et boss ou non ;
  - changements volontaires consécutifs (H4) ;
  - total des stats de base des starters.
- Banc : statistiques complètes (écart-type, erreur-type, p10/p90, histogramme, morts par type de
  vague, argent et objets à la mort, changements, tiers de force des starters) et verdict
  automatique « garder » ou « revenir en arrière » à 2 erreurs-types appariées.
  - Nouvelles options : `--plan-seul`, `--mysteres` (par défaut au rythme du jeu), `--dossier`.
  - Les parties en erreur sont enregistrées au lieu de disparaître.
- Anomalies trouvées :
  - l'ancien banc jouait **sans rencontres mystères** ;
  - le pilote prend toujours **la 1re option** d'une rencontre mystère, souvent le combat
    contre un boss : 3 morts sur 6 au premier test, 4 sur 24 au second ;
  - un mort au champion avec 3 176 ₽ non dépensés ;
  - 9 parties sur 24 ont au moins 3 changements d'affilée (plan seul).
- Le cerveau v5 ne fait pas que départager : il décide aussi des captures (Ball contre attaque à
  valeur égale). « Plan seul » utilise donc la règle de capture du planificateur.
- Aperçu cloud (plan seul, 480 parties, à confirmer sur le Mac) :
  - avec les rencontres mystères 40,26, sans 54,69 : **−14,24 ± 1,44 vagues** ;
  - les rencontres mystères sont la 1re cause de mort (35 %) ;
  - 34 à 49 % des parties ont au moins 3 changements d'affilée, avec des séries jusqu'à 91 contre
    des dresseurs (H4 confirmée) ;
  - 15 parties bloquées dans une boucle du pilote (rencontre mystère, écran de résumé).
- Correctif du banc : une partie bloquée au démarrage (copie du jeu en mauvais état) est rejouée au
  lieu d'être comptée comme erreur.

**Modifications**
- `simulateur/environnement.test.ts` : 23 lignes ajoutées (défaite, changements, total des stats).
- `entraineur/banc_complet.py` : statistiques via le nouveau module, plan seul, rencontres
  mystères, erreurs enregistrées, dossier au choix.
- Nouveaux : `entraineur/statistiques_banc.py`, `entraineur/test_statistiques_banc.py`,
  `donnees/vagues-classique.json` (combats fixes, source citée).
- `RESULTATS.md` (protocole figé), `REGLES.md` (C5), `BACKLOG.md` (n° 1 fait, n° 12 à 14),
  `README.md` (jeu épinglé au tag `v1.12.0.11`).

**Objectif**
Mesurer juste et complet avant de corriger quoi que ce soit, en jouant dans les conditions du vrai
jeu, pour que chaque correction des phases suivantes soit gardée ou rejetée sur des chiffres.

## 31. Bancs officiels de la Phase 1 et reproductibilité — 04/10/2026

**Prompt**
> c'est vrai que pour les changement ya un probleme je vais aussi ajouter que a chaque rencontre on
> peut choisir avec quel pokemon commencer mais parfois l ia faissais l etrange non pour changer de
> pokemon mais une fois elle dois choisir les attaque elle decide de changer de pokemon et perd un
> tour, [sortie des bancs p1-reference, p1-plan-seul et de la comparaison]

**Réponse**
- Bancs officiels (Mac) : référence (cerveau v5 + plan) 41,56 ; plan seul 40,54 ; écart −0,96 ±
  1,35, dans le bruit.
- Le v5 change 2 fois moins souvent de Pokémon (série maximale 13 contre 84) et passe le rival 4 à
  89 % au lieu de 59 %.
- Les rencontres mystères restent la 1re cause de mort (35 %), aussi avec le cerveau v5.
- Anomalie trouvée : la même partie donnait des résultats différents d'un lancement à l'autre.
  Cause : des tirages du jeu passent par `Math.random()` au lieu de la graine (combat double contre
  un sbire de la Team, rencontres mystères, œufs). Corrigé dans le simulateur en mode « hasard du
  jeu fixé » ; vérifié sur 4 copies en parallèle. Les bancs officiels sont à relancer.
- Remarque de Carlos notée : préférer le changement gratuit du début de vague au changement en
  combat, qui fait perdre un tour (BACKLOG n° 18).
- Question ouverte : cerveau v5 ou plan seul pour les phases suivantes (BACKLOG n° 19).

**Modifications**
- `simulateur/environnement.test.ts` : `Math.random` initialisé avec la graine en mode
  `hasardDuJeu`.
- `RESULTATS.md` (bancs officiels provisoires, reproductibilité), `REGLES.md` (R13),
  `BACKLOG.md` (n° 18, 19).

**Objectif**
Un banc vraiment apparié : sans ce correctif, une partie sur cinq changeait sans qu'aucune décision
change, et les petits gains se perdaient dans ce bruit.

## 32. Changements de Pokémon au moment de choisir l'attaque — 04/10/2026

**Prompt**
> (fil du projet) l'IA change parfois de Pokémon au moment où elle doit choisir une attaque, et perd
> un tour. Reprendre le travail des PR #2 et #3, reproduire, trouver la cause, proposer un correctif.

**Réponse**
- Reproduit sans le jeu : 2 000 combats tirés au hasard, le plan rejoué tour après tour. Avant le
  correctif : des allers-retours 0 → 1 → 0 → 1, contre les dresseurs comme contre les sauvages.
- Cause 1, moteur d'équipe (dresseurs) : dans un combat perdu d'avance, attaquer et changer ont la
  même note ; le départage (PV × niveau de celui qui entre) favorisait toujours le changement, puis le
  rechangement au tour suivant. Changer ne coûtait rien.
- Cause 2, planificateur par duels (sauvages) : une attaque qui ne sauve pas le Pokémon vaut −1, alors
  qu'un changement vers un duel perdu gardait le crédit des dégâts « qu'il infligera ensuite ». Il
  esquivait le coup prévu, puis rechangeait, sans jamais attaquer.
- Correctif : un changement en plein combat coûte 0,01 dans le moteur d'équipe (au-dessus des
  départages) ; un changement vers un duel perdu vaut −1,2, sous toute attaque.
- Après : aucune série de 2 changements sur les 2 000 combats ; changements au 1er tour 1 004 → 217
  (dresseurs).

**Modifications**
- `observateur/combat-equipe.ts` (`COUT_CHANGEMENT`), `observateur/planificateur.ts`
  (`CHANGEMENT_PERDU`), nouveau `tests/changements.test.ts`, `BACKLOG.md` (n° 16 et 18).

**Objectif**
Ne plus perdre de tours en changements inutiles ; à confirmer par les bancs officiels sur le Mac.

## 33. Extension : mode semi-auto — 04/10/2026

**Prompt**
> on es sur 1h deja, sinon en paralelle tu peu modifier l extension et mettre un entre deux en auto
> et conseil un semi auto ou on choisi les objet et le combat est auto

**Réponse**
- Nouveau mode **SEMI**, entre CONSEIL et AUTO : le cerveau et le pilote jouent tout comme en auto,
  sauf l'écran des récompenses et de la boutique (`SelectModifierPhase`, avec le choix du Pokémon
  qui reçoit l'objet), laissé au joueur. Le Daily Run reste interdit, comme en auto.
- Hors périmètre des phases : fait à la demande de Carlos. Seuls les fichiers de l'extension
  changent : pas le pilote ni l'observateur, qui servaient au banc en cours.
- Vérifié : types (`pnpm run verifier`), 47 tests unitaires, construction de l'extension. Pas
  encore essayé dans Brave.

**Modifications**
- `extension/src/capteur.ts` (règles du pilote suspendues sur l'écran des récompenses en semi-auto),
  `extension/src/messages.ts` (`objetsALaMain`), `extension/src/panneau.ts` (bouton SEMI, état
  « direct · semi-auto »), `extension/manifest.json` (0.11.0).

**Objectif**
Que Carlos garde la main sur les objets, la partie où le bot est le plus faible, tout en laissant
le combat au cerveau.

## 34. Viser la vague 200 : les rencontres mystères — 04/10/2026

**Prompt**
> c'est fusionner, et l extension a merveille, fais le optimal pour augmenter les resultat pour que
> un jour l ia puisse finir le jeu sans probleme
>
> (en cours) c'est normal le verdict ça fait 20min il tourne?

**Réponse**
- Le plus gros levier mesuré passe en premier : les rencontres mystères (35 % des morts).
- Le banc enregistre maintenant le type de rencontre mortelle et l'option choisie.
- `donnees/rencontres-mysteres.json` : l'option à préférer pour chacune des 31 rencontres, avec la
  raison tirée du code du jeu. Exemples : ne jamais vendre son Pokémon le plus fort ; refuser un
  défi brutal quand refuser soigne toute l'équipe ; ne pas fuir le Rêve Étrange, qui fait perdre
  10 % des niveaux.
- Banc apparié : **+9,31 ± 1,44 vagues** (43,0 → 52,4), morts en rencontre mystère 35 % → 17 %.
  Gardé.
- Boucle du pilote corrigée : équipe pleine quand une rencontre donne un Pokémon.
- Expert Breeder : combattre avec le Pokémon de plus haut niveau parmi les trois proposés (banc en
  cours).
- Les commits non fusionnés de la PR #3 (extension semi-auto, reproductibilité) ont été réintégrés.

**Modifications**
- Nouveaux : `donnees/rencontres-mysteres.json`, `tests/rencontres.test.ts`.
- Modifiés : `pilote/pilote.ts` (`optionRencontre`, plus haut niveau pour l'éleveur, équipe
  pleine dans une rencontre), `observateur/jeu.ts` (`mysteryEncounter`, `friendship`),
  `tsconfig.json` (`resolveJsonModule`), `simulateur/environnement.test.ts`, `entraineur/` (banc),
  `RESULTATS.md`, `BACKLOG.md`.

**Objectif**
Retirer la première cause de mort, venue d'une règle trop simple (« toujours l'option 1 »), avec un
choix lisible et sourcé pour chaque rencontre.

## 35. Deux essais rejetés par le banc — 05/10/2026

**Prompt**
> (suite de l'entrée 34, travail autonome vers la vague 200)

**Réponse**
- Expert Breeder (combattre avec le Pokémon de plus haut niveau) : +0,62 ± 0,55, dans le bruit :
  annulé. La boucle du pilote corrigée en même temps est gardée (57 parties en erreur → 6).
- Super Bonbon au membre qui évolue au niveau suivant : −0,60 ± 0,70, dans le bruit : annulé.
  L'export des niveaux d'évolution du jeu (`donnees/evolutions.json`) est gardé pour la suite.
- Nouvelle référence en plan seul : 57,7 de vague moyenne (474 parties valides).
- Analyse du rival 2 : équipe en pleine forme, porteur au niveau ; le banc a 4 à 6 niveaux de
  retard. Le moteur d'équipe joue presque au hasard quand il se croit perdant.

**Modifications**
- Annulations `dc1080d` et `0b2b41e` ; nouveaux : `simulateur/exporter-evolutions.test.ts`,
  `donnees/evolutions.json` ; `RESULTATS.md`.

**Objectif**
Ne garder que ce que le banc confirme : deux idées plausibles ne passent pas la règle des 2
erreurs-types, elles sortent du code.

## 36. Moteur de combat avec hasard : rejeté — 05/10/2026

**Prompt**
> (fusion de la PR #7 ; suite du travail autonome vers la vague 200)

**Réponse**
- Idée : le moteur d'équipe joue chaque combat avec les dégâts moyens ; en position perdante, toutes
  les actions se valent. Essai : noter chaque action sur 16 combats tirés avec le hasard du jeu.
- Banc apparié : −3,20 ± 1,51 vagues, plus de séries de changements (64 contre 33). Annulé.

**Modifications**
- `observateur/combat-equipe.ts` modifié puis remis comme avant (`4d99858` puis son annulation) ;
  `RESULTATS.md`.

**Objectif**
Tester une idée de combat sur le banc avant de la garder : celle-ci fait perdre, elle sort.

## 37. Équipe enregistrée à chaque vague, cerveau v5 dans le dépôt — 05/10/2026

**Prompt**
> oui ut peu faire ça Enregistrer l'équipe à chaque vague (espèces, évolutions, objets) dans le
> banc. On saura alors ce qui différencie vraiment les gagnants du rival 2 et des champions. Coût
> faible, aucune décision changée. 1. Mettre le cerveau v5 dans le dépôt […] 2. Ensuite seulement,
> un nouvel essai de règle, guidé par les données du point 1.

**Réponse**
- Le banc enregistre maintenant, à chaque vague, les espèces de l'équipe (les évolutions s'y
  lisent) et ses objets. Vérifié : 6 parties identiques avant et après, aucune décision changée.
- Cerveau v5 : exception dans `.gitignore` pour `cerveau/le-plus-fort-v5.cerveau`. Le banc
  l'utilise quand le Lexar est absent. Le fichier est à ajouter par Carlos depuis son Mac.
- Banc de référence lancé pour récolter ces données.

**Modifications**
- `simulateur/environnement.test.ts` (espèces et objets par vague dans le récit),
  `entraineur/banc_complet.py` (`especes`, `objetsParVague`, `chemin_cerveau`), `.gitignore`.

**Objectif**
Savoir ce qui distingue vraiment les parties qui passent le rival 2 et les champions avant de
proposer la prochaine règle, et pouvoir mesurer avec le cerveau v5 ici.


## 38. Audit : contrecoups, effets secondaires, précision, objets, captures, chromatiques — 05/10/2026

**Prompt**
> il y a aussi un point a verifier c'est que l ia mesure que la puissance mais jamais le contre
> coup d une attaque ou les effet secondaire […] lentille pour forcer les attaque avec moins de
> precision […] le teambuilding au long du jeu […] capturer des pokemon qui non pas de sens dans
> l equipe et ne jamais les utiliser, et il connais pas ce que fait les shiny avec le facteur luck

**Réponse (vérifié dans le code)**
- Contrecoup, soin par drainage, baisse de ses propres stats, effets secondaires (brûlure, peur,
  baisse de stats chez l'adversaire) : ignorés partout. Seuls la charge, la recharge et le
  sacrifice sont comptés (`observateur/contraintes-attaques.ts`).
- Précision : comptée contre les dresseurs (`combat-equipe.ts`), **ignorée contre les sauvages,
  les boss sauvages et en double** (`planificateur.ts`, `mesDegats`). Corrigé, mesure en cours.
- Objets tenus et talents : lus par l'observateur, ignorés dans la formule des dégâts
  (`prevision.ts`, `degats`). Grosse Loupe : +5 points de précision par exemplaire, 3 au plus.
- Captures : toute capture est « utile » tant que l'équipe a moins de 6 membres
  (`planificateur.ts`, `captureUtile`).
- Chromatiques : chaque chromatique en vie donne de la chance (1, jusqu'à 3 pour les variantes,
  total plafonné à 14). Elle augmente la chance d'objets de meilleur rang. Un Pokémon K.O. ne
  compte pas. La note d'équipe (`equipe.ts`, `evaluerArrivee`) ne connaît pas le chromatique :
  il peut être relâché pour une capture.

**Modifications**
- `observateur/planificateur.ts` (précision et crans de précision/esquive dans les duels),
  `observateur/combat-equipe.ts` (export de `multiplicateurPrecision`),
  `tests/planificateur.test.ts`, `BACKLOG.md`.

**Objectif**
Corriger, une mesure à la fois, ce que le planificateur ne voit pas dans un combat.

## 42. Juge des défaites du banc — 05/10/2026

**Prompt**
> Vasy je te laisse faire

**Réponse**
- Effets des attaques rejetés aussi en essais séparés (soi −1,05 ± 0,96 ; adversaire −2,61 ± 1,38).
- Nouvel outil `entraineur/juge_banc.py` : pour chaque défaite d'un banc (plan seul, parties
  reproductibles), photo au début de la vague fatale, vérification que la défaite se reproduit,
  taux de victoire du bot depuis la photo sur 8 autres tirages, puis chaque décision du combat
  jugée (tous les coups permis × 3 avenirs, mêmes tirages pour tous les coups).
- Essai (rival 2, k=0) : 8 min, 23 décisions ; le coup habituel gagnait 2 avenirs sur 3 dès la
  première décision : une part de la défaite est de la malchance.

**Modifications**
- `entraineur/juge_banc.py`.

**Objectif**
Trouver quelles décisions perdent vraiment (triche permise au diagnostic) avant toute nouvelle règle.

## 43. Juge vérifié : erreurs de changement ; ciblage de l'IA adverse au tour d'un changement — 05/10/2026

**Prompt**
> Vasy je te laisse faire (suite)

**Réponse**
- Juge sur 36 défaites (rival 2, rival 4, champions 50-110) : depuis la photo, le bot gagne ~1/3
  avec d'autres tirages ; 81 erreurs fortes. Revérifiées sur 16 avenirs neufs : coup du bot 28 % de
  victoires, coup du juge 57 % (+4,6 victoires sur 16, erreur-type 0,53). Les erreurs de changement
  sont réelles (« aurait dû changer » 24 % → 62 %, « mauvais Pokémon envoyé » 29 % → 56 %) ; les
  attaques de statut ne le sont pas.
- Défaut trouvé : dans le moteur d'équipe, au tour d'un changement, l'adversaire choisissait son
  attaque contre le remplaçant. Dans le jeu (`EnemyCommandPhase`, avant `TurnStartPhase`), il la
  choisit contre le Pokémon qui part. Corrigé, test ajouté.
- Option de diagnostic `observationBrute` (simulateur et `pont.py`) : l'observation complète à
  chaque décision, désactivée par défaut.

**Modifications**
- `observateur/combat-equipe.ts`, `tests/planificateur.test.ts`, `simulateur/environnement.test.ts`,
  `entraineur/pont.py`.

**Objectif**
Corriger les changements de Pokémon, l'erreur que le juge confirme.

## 44. Équipe des rivaux connue (emplacements fixés par le jeu) — 05/10/2026

**Prompt**
> Vasy je te laisse faire (suite)

**Réponse**
- Trace d'une défaite au rival 2 (k=41) : l'IA du rival retire son starter dès qu'il est menacé ;
  la branche gagnante sacrifie Feunnec contre l'oiseau et garde Brindibou, qui évolue en plein
  combat et bat le starter. Le moteur ne prévoit ni le retrait adverse, ni l'évolution, et joue le
  3e Pokémon du rival comme une copie du starter (niveau 18) alors que c'est un bébé niveau 16.
- Nouvel export `simulateur/exporter-rivaux.test.ts` → `donnees/rivaux.json` : pour chaque combat
  de rival, la liste de chaque emplacement, son niveau fixé et les stats de base moyennes.
- Moteur d'équipe : les Pokémon pas encore vus d'un rival sont joués avec ces niveaux et ces stats
  (`adversairesSupposes`, testée).

**Modifications**
- `simulateur/exporter-rivaux.test.ts`, `donnees/rivaux.json`, `observateur/combat-equipe.ts`,
  `tests/planificateur.test.ts`.

**Objectif**
Le rival 2 est la première cause de mort (86 parties sur 475) : mieux connaître son équipe, avec ce
qui est public.

## 45. Point de reprise pour la suite en local — 05/10/2026

**Prompt**
> je vois que les credit cloud sont bientot epuiser peut tu laisser les prochaine consigne bien
> defini avec tout le savoir pour la suite quand je reviendrais en local avec claude code et ainsi
> d actualiser le nouveau cerveau le plus performant bien sur continue jusqua epuiser le dernier
> credit juste fait ça en checkpoint

**Réponse**
- `REPRISE.md` : état, deux changements en attente de verdict (commandes pour refaire les bancs en
  local), mise à jour du site (reconstruire l'extension ; le moteur est dans l'extension, pas dans le
  `.cerveau`), ce qu'on a appris, prochains chantiers, méthode.
- Les bancs continuent dans le cloud ; les verdicts seront notés dans `REPRISE.md` s'ils finissent.

**Modifications**
- `REPRISE.md`.

**Objectif**
Pouvoir reprendre sur le Mac sans rien perdre.

## 46. Capture forcée dans l'extension — 06/10/2026

**Prompt**
> ne touche plus a une amlioration du cerveau je vais te demander juste de ajouter une feature a l
> extension, en gros ça va etre une feature qui va essayer toute les maniere possible de çapturer le
> pokemon […] si la çapture echou l extension fais un f5 ou un truc qui marche pour recommencer la
> partie, si il çapture le pokemon l extension devera nous laisser sur le choix de remplacement

**Réponse**
- Vérifié dans le jeu : le hasard de capture est fixé par tour (graine du combat + tour) ; un boss
  doit avoir tous ses boucliers cassés pour une Ball normale ; sauvegarde au début de chaque vague.
- Bouton « CAPTURE FORCÉE » : tentative n = Ball lancée après n tours d'attente sans risque ; boucliers
  d'un boss cassés d'abord ; échec → rechargement de la page et « Continuer » ; succès → arrêt, et
  l'écran de remplacement est laissé au joueur. Jamais en Daily Run ; 100 tentatives au plus.
- Exception notée dans REGLES.md (voulue par Carlos).

**Modifications**
- `extension/src/capture-forcee.ts` (nouveau), `extension/src/capteur.ts`, `extension/src/messages.ts`,
  `extension/src/panneau.ts`, `extension/manifest.json` (0.12.0), `observateur/valeurs.ts` (écran titre),
  `tests/capture-forcee.test.ts`, `REGLES.md`, `REPRISE.md`.

**Objectif**
Capturer un Pokémon rare (Zygarde, vague 60, une seule Ball) sans tout essayer à la main.
