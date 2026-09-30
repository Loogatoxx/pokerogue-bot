# Architecture

Validée le 30/09/2026. Le pourquoi de chaque choix est dans [`historique_prompts.md`](../historique_prompts.md).

## Vue d'ensemble

```
            ┌──────── Observateur (TypeScript, écrit UNE seule fois) ─────────┐
            │         traduit la partie en « ce qu'un humain voit »           │
            ▼                                                                  ▼
 1. Simulateur (Mac) ⇄ 2. Entraîneur ──► 3. Lexar ──import──► 4. Extension Chrome
 PokeRogue sans écran   (Python) joue     cerveaux v1…vN        pokerogue.net : lit la
 plusieurs parties      des milliers de   courbes, replays      partie, fait tourner le
 en parallèle           parties                                 cerveau, conseille/joue
```

**L'observateur est partagé** entre le simulateur et l'extension : le cerveau voit la partie
décrite exactement de la même façon à l'entraînement et sur le site.

## Choix actés

| Brique | Choix | Pourquoi |
|---|---|---|
| Simulateur | Le gestionnaire de partie sans écran du jeu (`jeu/test/framework/game-manager.ts`) | Les vraies règles du jeu ; vitesse validée à l'[étape 0](etape-0-vitesse.md) |
| Entraîneur | Python + PyTorch, PPO écrit à la main (style CleanRL) | Nos copies du jeu en TCP et nos masques d'actions s'y branchent directement, et chaque chiffre reste visible (voir [étape 3](etape-3-entrainement.md)) |
| Cerveau | Un tronc commun + une « tête » par type de décision | Ce qu'il comprend en combat sert aux bonus ; un seul fichier à importer |
| Graphiques | Tableau de bord maison | Parle le langage du jeu : vague atteinte, captures, bonus préférés, replays |
| Format du cerveau | Maison (`.cerveau`) + calcul en TypeScript | ONNX pour navigateur pèse ~10 Mo et exige du WebAssembly ; notre petit réseau se calcule en 50 lignes, et on voit son intérieur (voir [étape 2](etape-2-cerveau-v0.md)) |
| Explications | IA de langage locale (Ollama) | Gratuite et illimitée |
| Navigateur de l'extension | **Brave** (Chromium) | Chrome n'est pas installé ; Brave charge les extensions Chrome telles quelles |
| Mémoire | Carnet de partie + relecture des derniers événements (A + C) | Rien ne s'oublie, et on voit ce qu'il a relu pour décider |

### Les têtes du cerveau

Combat (attaque, changement, Ball, fuite) · capture · boutique de bonus · attaque à oublier ·
choix du biome · starters (team build).

### Deux principes pour garder ses décisions analysables

- **Masquage d'actions** : les coups impossibles (attaque sans PP, Ball absente) sont interdits
  avant qu'il choisisse.
- **Perception humaine** : tout sur ses Pokémon ; de l'ennemi, seulement ce qui s'est affiché.

## La mémoire du cerveau (validée le 30/09 : A + C)

Idée de Carlos : un historique des décisions pour qu'il **comprenne toute la partie et
n'oublie rien**. Il y a deux besoins différents :

1. **Le combat en cours** : les attaques ennemies déjà vues, un talent ou un objet révélé par un
   message, qui a changé de Pokémon.
2. **La partie entière** : les bonus déjà pris, les Pokémon capturés, l'équipe du rival croisée
   aux vagues précédentes (il revient plus fort), les boss déjà battus.

| Option | Pour | Contre |
|---|---|---|
| A. Carnet de partie tenu par l'observateur | Lisible : on peut ouvrir le carnet et voir ce qu'il sait. N'oublie rien de ce qu'on y note. Léger | Ne retient que ce qu'on a prévu d'y noter |
| B. Mémoire interne du réseau (récurrente) | Découvre seul ce qui mérite d'être retenu | Boîte noire ; oublie sur plus de 1 000 décisions ; entraînement plus lent |
| C. Relecture de l'historique (attention) | Peut relire n'importe quel moment passé, **et on peut afficher ce qu'il a relu pour décider** | Coûte plus cher à chaque décision : il faut limiter la fenêtre relue |

**Recommandation : A + C.** Le carnet couvre la partie entière, et une fenêtre de relecture
couvre les derniers événements détaillés. L'extension affichera « pour décider, il a relu tel
moment », ce qui sert directement l'objectif « analysable par un humain ». Ce même historique
alimente le journal des décisions du tableau de bord et les replays.

Les connaissances générales qu'un humain a (un boss toutes les 10 vagues, les vagues du rival,
le boss final à 200) ne sont pas de la mémoire : elles sont données directement au cerveau.

## Lecture de la partie dans l'extension

L'extension a deux scripts, parce que Brave isole les extensions de la page :

| Script | Monde | Rôle |
|---|---|---|
| `extension/src/capteur.ts` | celui de la page (`"world": "MAIN"`) | capture la scène, fait tourner carnet + observateur 4 fois par seconde |
| `extension/src/panneau.ts` | isolé (celui de l'extension) | affiche l'observation dans une bulle à part (Shadow DOM) |

Ils se parlent par `window.postMessage`, avec une signature (`SOURCE`) vérifiée à la réception.
`window.__pokerogueCerveau` donne accès à la scène et à l'observation depuis la console.


Vérifié sur pokerogue.net (version 1.12.0.11) : `window.Phaser` est exposé. Remplacer une fois
`Phaser.Scenes.Systems.prototype.step` permet de capturer la scène `battle`, dont les propriétés
gardent des noms lisibles (`party`, `field`, `arena`, `phaseManager`, `modifiers`…).
Une mise à jour du jeu peut renommer ces propriétés : c'est la partie la plus fragile du projet.

## Où vivent les fichiers

| Quoi | Où |
|---|---|
| Code, extension, copie du jeu (`jeu/`, ignorée par git) | `~/Projets/pokerogue-bot` (SSD) |
| Cerveaux, courbes, replays, résultats de bancs | `/Volumes/Lexar/pokerogue-bot` |

Le Lexar est en ExFAT : pas de liens symboliques (pnpm), pas de permissions Unix (git), blocs
de 256 Ko. On n'y écrit donc que de gros fichiers, jamais des milliers de petits.

## Ordre de construction

0. ✅ Vitesse du simulateur — [résultats](etape-0-vitesse.md)
1. ✅ Extension minimale : lit la partie en direct et affiche ce que le cerveau « voit »
   (validée dans Brave le 30/09)
2. ✅ Cerveau v0 (non entraîné) importable, modes Conseil et Auto — [résultats](etape-2-cerveau-v0.md)
3. 🔄 Premier entraînement PPO + tableau de bord maison + note de synergie des attaques — [détails](etape-3-entrainement.md)
4. 🔄 Capture ([étape 4a](etape-4-capture.md)) ; équipe et objets jugés comme un tout par des notes
   lisibles ([étape 4b](etape-4b-equipe-objets.md)) ; plus tard : le cerveau décide lui-même, bons d'œuf, biomes
5. Team build
6. Phrases d'explication (Ollama) + mode auto complet
7. Programme progressif jusqu'à la vague 200 + machine à œufs

Plus tard : les challenges, par spécialisation d'un cerveau déjà formé.
