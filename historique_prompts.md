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
