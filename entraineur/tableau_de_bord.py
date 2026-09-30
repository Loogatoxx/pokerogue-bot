"""Tableau de bord : suivre l'évolution du cerveau dans le navigateur.

Sert la page tableau/index.html et, en JSON, ce que les entraînements écrivent sur le Lexar
(journal des mises à jour, dernières parties, versions du cerveau). La page se met à jour seule.

Usage : .venv/bin/python -m entraineur.tableau_de_bord   puis   http://localhost:8766
"""
from __future__ import annotations

import json
from collections import Counter
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

RACINE = Path(__file__).resolve().parent.parent
PAGE = RACINE / "tableau"
LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
PORT = 8766


def lire_jsonl(chemin: Path, dernieres: int | None = None) -> list[dict]:
    if not chemin.exists():
        return []
    lignes = chemin.read_text(encoding="utf-8").splitlines()
    if dernieres:
        lignes = lignes[-dernieres:]
    return [json.loads(l) for l in lignes if l.strip()]


def references() -> dict:
    """Les repères fixes : la v0 et le hasard pur (évaluation), le bot glouton (étape 0)."""
    reperes = {"glouton": 6.8}
    for fichier in sorted((LEXAR / "evaluations").glob("v0-*.json")):
        if fichier.name.startswith("._"):
            continue
        donnees = json.loads(fichier.read_text(encoding="utf-8"))
        reperes["v0"] = donnees["v0"]["resume"]["vagueMoyenne"]
        reperes["hasard"] = donnees["hasard"]["resume"]["vagueMoyenne"]
    return reperes


def entrainements() -> list[dict]:
    resultats = []
    for dossier in sorted((LEXAR / "entrainements").glob("*"), key=lambda d: d.stat().st_mtime, reverse=True):
        if not dossier.is_dir() or dossier.name.startswith("._"):
            continue
        dernier = lire_jsonl(dossier / "journal.jsonl", 1)
        resultats.append({"nom": dossier.name, "dernier": dernier[0] if dernier else None})
    return resultats


def detail(nom: str) -> dict:
    dossier = LEXAR / "entrainements" / nom
    if not dossier.is_dir() or "/" in nom:
        raise FileNotFoundError(nom)
    parties = lire_jsonl(dossier / "parties.jsonl", 40)
    versions = sorted(
        (f for f in (dossier / "cerveaux").glob("*.cerveau") if not f.name.startswith("._")),
        key=lambda f: f.name,
    )
    return {
        "nom": nom,
        "journal": lire_jsonl(dossier / "journal.jsonl"),
        "parties": parties[::-1],
        "regles": Counter(k for p in parties for k, n in p.get("regles", {}).items() for _ in range(n)),
        "versions": [{"nom": f.name, "chemin": str(f), "taille": f.stat().st_size} for f in versions][::-1],
        "references": references(),
    }


class Serveur(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PAGE), **kwargs)

    def log_message(self, *_args) -> None:  # pas de ligne par requête dans le terminal
        pass

    def envoyer_json(self, donnees: object, code: int = 200) -> None:
        corps = json.dumps(donnees, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self) -> None:
        chemin = urlparse(self.path).path
        if not LEXAR.exists() and chemin.startswith("/api/"):
            self.envoyer_json({"erreur": "Le Lexar n'est pas branché."}, 503)
        elif chemin == "/api/entrainements":
            self.envoyer_json(entrainements())
        elif chemin.startswith("/api/entrainement/"):
            try:
                self.envoyer_json(detail(unquote(chemin.removeprefix("/api/entrainement/"))))
            except FileNotFoundError:
                self.envoyer_json({"erreur": "Entraînement introuvable."}, 404)
        else:
            super().do_GET()


def main() -> None:
    serveur = ThreadingHTTPServer(("127.0.0.1", PORT), Serveur)
    print(f"Tableau de bord : http://localhost:{PORT}  (Ctrl+C pour arrêter)")
    serveur.serve_forever()


if __name__ == "__main__":
    main()
