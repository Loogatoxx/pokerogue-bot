#!/bin/zsh
# Lance les tests de l'observateur dans la copie locale du jeu.
#
# Usage : ./simulateur/lancer-tests.sh [--types]
#   --types : vérifie aussi, avec le compilateur TypeScript, que le contrat observateur/jeu.ts
#             colle aux vraies classes du jeu (plus lent : environ une minute).
set -euo pipefail

RACINE=${0:A:h:h}
JEU="$RACINE/jeu"

# Nos tests vivent dans notre dépôt ; l'outil de test du jeu ne trouve ses raccourcis d'import
# (#app, #enums…) que depuis l'intérieur du jeu, d'où la copie.
mkdir -p "$JEU/test/bot"
cp "$RACINE/simulateur/observateur.test.ts" "$JEU/test/bot/"

# Node 25+ fournit son propre localStorage, vide, qui masque celui du navigateur simulé.
export NODE_OPTIONS=--no-experimental-webstorage

cd "$JEU"
pnpm exec vitest run --silent=passed-only test/bot/observateur.test.ts

if [[ "${1:-}" == "--types" ]]; then
  echo "Vérification des types (contrat observateur ↔ jeu)…"
  # Configuration dédiée : celle du jeu refuse les fichiers hors de son dossier (rootDir).
  cp "$RACINE/simulateur/tsconfig.verification.json" "$JEU/test/bot/"
  # `|| true` : tsc renvoie une erreur dès qu'il trouve un problème, on veut lire son rapport.
  rapport=$(pnpm exec tsc -p test/bot/tsconfig.verification.json 2>&1 || true)
  if [[ -n "$rapport" ]]; then
    echo "$rapport"
    echo "✗ Le contrat ne colle plus au jeu (voir ci-dessus)."
    exit 1
  fi
  echo "✓ Contrat conforme au jeu."
fi
