#!/bin/zsh
# Arrête proprement un entraînement en cours : il finit sa mise à jour, sauvegarde le cerveau,
# puis ferme les copies du jeu.   Usage : ./entraineur/arreter.sh entrainement-2
set -euo pipefail
DOSSIER="/Volumes/Lexar/pokerogue-bot/entrainements/${1:?nom de l\'entraînement}"
PID=$(cat "$DOSSIER/processus.pid" 2>/dev/null) || { echo "Aucun entraînement en cours dans $DOSSIER"; exit 1; }
kill -INT "$PID"
echo "Arrêt demandé (processus $PID) : attente de la sauvegarde…"
while kill -0 "$PID" 2>/dev/null; do sleep 2; done
echo "Arrêté. Dernier cerveau : $(ls -t "$DOSSIER"/cerveaux/*.cerveau | grep -v '/\._' | head -1)"
