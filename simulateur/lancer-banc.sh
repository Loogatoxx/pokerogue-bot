#!/bin/zsh
# Lance le banc de vitesse du simulateur et range le résultat sur le Lexar.
#
# Usage : ./simulateur/lancer-banc.sh [nombre de processus en parallèle]
# Réglages (variables d'environnement) :
#   BANC_PARTIES=8          parties « hasard » et « glouton » par processus
#   BANC_MARATHONS=2        parties « marathon » (200 vagues visées) par processus
#   BANC_NIVEAU_MARATHON=300
set -euo pipefail

RACINE=${0:A:h:h}
JEU="$RACINE/jeu"
PROCESSUS=${1:-1}
HORODATAGE=$(date +%Y-%m-%d_%H%M%S)
DEST_LEXAR="/Volumes/Lexar/pokerogue-bot/bancs"
TMP=$(mktemp -d)

if [[ ! -d "$JEU" ]]; then
  echo "Le jeu n'est pas installé dans $JEU (voir README)." >&2
  exit 1
fi

# Le banc vit dans notre dépôt ; l'outil de test du jeu ne trouve ses raccourcis d'import
# (#app, #test…) que depuis l'intérieur du jeu, d'où la copie.
mkdir -p "$JEU/test/bot"
cp "$RACINE/simulateur/banc-vitesse.test.ts" "$JEU/test/bot/"

# Node 25+ fournit son propre localStorage, vide, qui masque celui du navigateur simulé.
export NODE_OPTIONS=--no-experimental-webstorage

echo "Banc de vitesse : $PROCESSUS processus en parallèle…"
debut=$(date +%s)
for i in $(seq 1 "$PROCESSUS"); do
  (cd "$JEU" && BANC_SORTIE="$TMP/processus-$i.json" \
    pnpm exec vitest run --silent=passed-only test/bot/banc-vitesse.test.ts > "$TMP/journal-$i.txt" 2>&1) &
done
wait
duree=$(( $(date +%s) - debut ))

# Un seul fichier de résultat : le Lexar (ExFAT, blocs de 256 Ko) n'aime pas les petits fichiers.
python3 - "$TMP" "$duree" "$PROCESSUS" > "$TMP/banc.json" <<'EOF'
import glob, json, sys
dossier, duree, processus = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
parties = [p for f in sorted(glob.glob(f"{dossier}/processus-*.json")) for p in json.load(open(f))]
json.dump({"duree_murale_s": duree, "processus": processus, "parties": parties}, sys.stdout, ensure_ascii=False, indent=1)
EOF

python3 - "$TMP/banc.json" <<'EOF'
import json, statistics, sys
banc = json.load(open(sys.argv[1]))
parties, duree = banc["parties"], banc["duree_murale_s"]
for politique in ("hasard", "glouton", "marathon"):
    ps = [p for p in parties if p["politique"] == politique]
    if not ps:
        continue
    vagues = [p["vagueAtteinte"] for p in ps]
    secondes = sum(p["ms"] for p in ps) / 1000
    erreurs = sum(1 for p in ps if p.get("erreur"))
    print(f"{politique:9s} {len(ps):3d} parties, {erreurs} erreur(s), vague moyenne {statistics.mean(vagues):5.1f}, "
          f"max {max(vagues):3d}, {secondes / len(ps):5.1f} s par partie")
decisions = sum(p["decisions"] for p in parties)
print(f"Débit global : {decisions / duree:.0f} décisions/s sur {duree} s (démarrage compris)")
EOF

if [[ -d /Volumes/Lexar ]]; then
  mkdir -p "$DEST_LEXAR"
  cp "$TMP/banc.json" "$DEST_LEXAR/banc-$HORODATAGE.json"
  echo "Résultat rangé dans $DEST_LEXAR/banc-$HORODATAGE.json"
else
  cp "$TMP/banc.json" "$RACINE/banc-$HORODATAGE.json"
  echo "Lexar absent : résultat laissé dans $RACINE/banc-$HORODATAGE.json"
fi
rm -rf "$TMP"
