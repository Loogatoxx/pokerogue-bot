# pokerogue-bot

Un cerveau qui apprend à jouer à [PokeRogue](https://github.com/pagefaultgames/pokerogue)
par **apprentissage par renforcement**, puis qui joue et commente ses décisions dans une
**extension de navigateur** (Brave, compatible Chrome) sur pokerogue.net.

## Objectif

Atteindre la **vague 200 en mode Classique** sur un compte neuf réservé à l'IA, avec des
décisions qu'un humain peut reproduire et comprendre.

## Principes

- **Il voit comme un humain** : tout sur ses propres Pokémon (IVs, nature…), et de
  l'adversaire uniquement ce qui s'affiche à l'écran.
- **Chaque décision est analysable** : ses chiffres bruts (qui font foi) d'un côté, et de
  l'autre une phrase qui explique pourquoi c'est un bon coup.
- **Tout est local et gratuit** : entraînement sur le Mac, explications par un modèle local.
- **Mode auto interdit en Daily Run**, pour ne pas fausser le classement des autres joueurs.

Détails : [`docs/architecture.md`](docs/architecture.md).

## Installer la copie locale du jeu

Il faut Node 24 ou plus récent et pnpm (`brew install pnpm`). On clone **la branche `main`**,
qui correspond à la version en ligne sur pokerogue.net :

```bash
git clone --depth 1 --branch main --recurse-submodules --shallow-submodules \
  https://github.com/pagefaultgames/pokerogue.git jeu
cd jeu && pnpm install
```

Jouer à la copie locale dans le navigateur : `pnpm --dir jeu start:dev`, puis
http://localhost:8000.

## Installer l'extension dans Brave

```bash
pnpm install
pnpm run extension
```

Puis dans Brave : `brave://extensions` → activer **Mode développeur** (en haut à droite) →
**Charger l'extension non empaquetée** → choisir le dossier `extension/dist`.
Après chaque `pnpm run extension`, cliquer sur la flèche ↻ de l'extension pour la recharger.

Elle s'active sur pokerogue.net et sur la copie locale (http://localhost:8000).

## Environnement Python (entraîneur)

```bash
python3 -m venv .venv && .venv/bin/pip install torch numpy
.venv/bin/python -m entraineur.creer_v0      # crée et évalue le cerveau v0 (sur le Lexar)
```

## Vérifier l'observateur

```bash
./simulateur/lancer-tests.sh --types
```

Joue de vraies situations dans le simulateur, vérifie que le cerveau ne voit que ce qu'un humain
voit, et que notre description du jeu (`observateur/jeu.ts`) colle toujours aux vraies classes.
Après une mise à jour du jeu : `python3 observateur/generer-noms.py` régénère les noms français.

## Où vivent les fichiers

| Quoi | Où | Pourquoi |
|---|---|---|
| Code, extension, copie du jeu | `~/Projets/pokerogue-bot` (SSD interne) | Le Lexar est en ExFAT : pas de liens symboliques (requis par pnpm) ni de permissions Unix (requises par git) |
| Cerveaux, courbes, replays, bancs | `/Volumes/Lexar/pokerogue-bot` | Gros fichiers, beaucoup de place |

## Statut

- ✅ Étape 0 : le simulateur tient une partie complète et enchaîne ~250 décisions/s
  ([résultats](docs/etape-0-vitesse.md)).
- ✅ Étape 1 : l'extension lit la partie en direct dans Brave et affiche ce que voit le cerveau.
- ✅ Étape 2 : chaîne complète jeu → cerveau → jeu ; cerveau v0 (non entraîné) importable, modes
  Conseil et Auto ([détails](docs/etape-2-cerveau-v0.md)).
- ⏭️ Étape 3 : premier entraînement (combat sur les premières vagues) et tableau de bord.

Journal des échanges : [`historique_prompts.md`](historique_prompts.md).
