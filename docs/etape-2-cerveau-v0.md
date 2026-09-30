# Étape 2 — Le cerveau v0 (30/09/2026)

**Résultat : la chaîne complète fonctionne**, du jeu au cerveau et retour, dans le simulateur
comme dans Brave. Le cerveau v0 existe, joue, et s'importe dans l'extension.

## La chaîne

```
jeu ──► observateur ──► encodeur ──► cerveau ──► action ──► pilote ──► jeu
        ce qu'un        1 290        réseau      1 sur 14    appuie sur
        humain voit     nombres      de neurones             les touches
```

Chaque maillon est écrit **une seule fois** et sert à la fois au simulateur (entraînement) et
à l'extension (jeu en ligne), pour que le cerveau vive la même chose des deux côtés.

| Maillon | Fichier | Rôle |
|---|---|---|
| Observateur | `observateur/observateur.ts` | La partie telle qu'un humain la voit (observation v2) |
| Actions permises | `observateur/actions.ts` | Les 14 actions et celles que le jeu autorise à l'instant |
| Encodeur | `observateur/encodeur.ts` | L'observation en 1 290 nombres entre 0 et ~1 |
| Cerveau (Python) | `entraineur/reseau.py` | Tronc commun 512 → 256, tête « politique » (14), tête « valeur » (1) |
| Cerveau (navigateur) | `cerveau/cerveau.ts` | Le même calcul en TypeScript, pour l'extension |
| Pilote | `pilote/pilote.ts` | Joue l'action du cerveau ; règles simples pour tout le reste |
| Pont | `entraineur/pont.py` + `simulateur/environnement.test.ts` | N copies du jeu en parallèle, reliées au Python en TCP |

### Les 14 actions

| N° | Action |
|---|---|
| 0 à 7 | attaque 1 à 4 sur l'ennemi 1 ou 2 (en simple, une seule cible) |
| 8 à 13 | envoyer le Pokémon de la place 1 à 6 |

Les coups impossibles (sans PP, Entrave, remplaçant K.O.…) sont **masqués** : le cerveau ne peut
pas les choisir. En double, seules les attaques qui visent un ennemi au choix proposent deux
cibles (Trempette ou Rugissement n'en ont qu'une).

**Confié au cerveau** : l'action de combat et le remplacement après un K.O.
**Encore géré par des règles simples** (en attendant les étapes suivantes) : récompenses (la
première), objet à donner (au plus blessé), biome (le premier), attaque à apprendre (refusée),
« Changer de Pokémon ? » (non), messages (suite). Pas encore de Poké Balls ni de fuite.

## Pourquoi un format maison plutôt qu'ONNX

L'architecture prévoyait ONNX (format standard). Mais son moteur pour navigateur pèse ~10 Mo et
exige du WebAssembly, que les extensions encadrent strictement. Notre réseau est petit : un calcul
écrit à la main (≈ 50 lignes, `cerveau/cerveau.ts`) suffit, et il laisse voir l'intérieur du
réseau, ce qui servira à analyser ses décisions. Un test (`tests/cerveau.test.ts`) vérifie qu'il
donne **les mêmes probabilités que PyTorch** à 5 décimales près.

Format `.cerveau` : signature « CRVO », en-tête JSON (nom, date, versions, tailles des couches,
évaluation), puis les poids en float32.

## La v0

Un réseau complet (796 175 poids, 3,2 Mo) **jamais entraîné** : ses poids sont tirés au hasard
(graine 0, donc reproductible). Il joue au hasard, avec des préférences arbitraires.

| Joueur (64 parties chacun) | Vague moyenne | Médiane | Max | Erreurs |
|---|---|---|---|---|
| Cerveau v0 | 4,64 | 5 | 8 | 0 |
| Hasard pur (référence) | 4,8 | 5 | 7 | 0 |

C'est le **point zéro** de la courbe d'évolution. Chaque version suivante devra faire mieux.
Fichiers : `/Volumes/Lexar/pokerogue-bot/cerveaux/v0-2026-09-30.cerveau` et
`/Volumes/Lexar/pokerogue-bot/evaluations/v0-2026-09-30.json` (les 128 parties).

Le style de combat « Changer » (le jeu propose de changer après chaque K.O. adverse) a aussi été
vérifié : 16 parties, 0 erreur, la règle « ne change pas » répond bien.

## Dans l'extension

- **Importer un cerveau…** : choisir un fichier `.cerveau` ; il est retenu par Brave.
- **Conseil** : le panneau montre ce qu'il pense (probabilité de chaque action permise, valeur
  estimée) ; c'est toi qui joues.
- **Auto** : il joue les combats lui-même, et le pilote gère le reste par règles, au rythme
  choisi (lente, normale, rapide). **Jamais en Daily Run** : le capteur et le panneau le coupent.
- Le panneau se déplace en glissant son en-tête.

## Commandes

```bash
.venv/bin/python -m entraineur.creer_v0 --processus 8 --parties 64   # recréer la v0
pnpm test                                                            # PyTorch ↔ TypeScript
./simulateur/lancer-tests.sh --types                                 # observateur sur le vrai jeu
pnpm run extension                                                   # reconstruire l'extension
```
