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
- Entraînement 5 (2 h prévues, arrêté à 1 h 50, plateau) : pas mieux que le 4 → pas de v3.
  Entraînement 6 lancé avec la connaissance.

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
