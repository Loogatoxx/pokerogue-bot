"""Entraîne le cerveau par renforcement (PPO), à partir d'un cerveau existant.

Le cycle, répété sans fin :
1. **Collecte** : les 8 copies du jeu jouent ensemble 8 × N décisions avec le cerveau actuel,
   chacune à son rythme (en tirant au sort selon ses probabilités, pour qu'il continue d'explorer).
2. **Bilan** : pour chaque décision, était-elle meilleure ou pire que prévu ? C'est
   « l'avantage », calculé à partir des récompenses reçues ensuite (méthode GAE).
3. **Apprentissage (PPO)** : on ajuste les poids pour rendre un peu plus probables les
   décisions meilleures que prévu, et un peu moins les autres — mais jamais trop d'un coup
   (le « clip »), pour ne pas tout désapprendre sur une série malchanceuse.

Tout est écrit sur le Lexar : journal des mises à jour et des parties (pour le tableau de bord),
un .cerveau toutes les N mises à jour, et un état complet pour reprendre plus tard.

Usage :
  .venv/bin/python -m entraineur.entrainer --depart /Volumes/Lexar/pokerogue-bot/cerveaux/v0-2026-09-30.cerveau --minutes 30
  .venv/bin/python -m entraineur.entrainer --reprendre /Volumes/Lexar/pokerogue-bot/entrainements/<nom> --minutes 30
Arrêt propre à tout moment : Ctrl+C (le cerveau du moment est sauvegardé).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import threading
import time
import tomllib
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from torch.distributions import Categorical

from .ensemble import Ensemble
from .format_cerveau import ecrire, lire
from .pont import Pont
from .reseau import Cerveau

LEXAR = Path("/Volumes/Lexar/pokerogue-bot")
REGLAGES = Path(__file__).resolve().parent / "reglages.toml"


class Entrainement:
    def __init__(self, dossier: Path, cerveau: Cerveau, reglages: dict, origine: str,
                 mises_a_jour: int = 0, decisions: int = 0, parties: int = 0):
        self.dossier = dossier
        self.cerveau = cerveau
        self.reglages = reglages
        self.a = reglages["apprentissage"]
        self.origine = origine
        self.optimiseur = torch.optim.Adam(cerveau.parameters(), lr=self.a["taux_apprentissage"], eps=1e-5)
        self.mises_a_jour, self.decisions, self.parties = mises_a_jour, decisions, parties
        (dossier / "cerveaux").mkdir(parents=True, exist_ok=True)

    # ─── Sauvegardes ────────────────────────────────────────────────────────────────────────

    def sauvegarder(self, versions: dict, evaluation: dict | None = None) -> Path:
        chemin = self.dossier / "cerveaux" / f"mise-a-jour-{self.mises_a_jour:05d}.cerveau"
        ecrire(chemin, self.cerveau, nom=f"{self.dossier.name} · mise à jour {self.mises_a_jour}",
               description=f"Entraîné par PPO à partir de {self.origine}.", versions=versions,
               entrainement={"parties": self.parties, "decisions": self.decisions}, evaluation=evaluation)
        torch.save({
            "cerveau": self.cerveau.state_dict(), "optimiseur": self.optimiseur.state_dict(),
            "tailles": [m.out_features for m in self.cerveau.tronc if isinstance(m, torch.nn.Linear)],
            "mises_a_jour": self.mises_a_jour, "decisions": self.decisions, "parties": self.parties,
            "origine": self.origine,
        }, self.dossier / "etat.pt")
        return chemin

    def noter(self, fichier: str, ligne: dict) -> None:
        with open(self.dossier / fichier, "a", encoding="utf-8") as f:
            f.write(json.dumps(ligne, ensure_ascii=False) + "\n")

    # ─── Un cycle collecte → bilan → apprentissage ──────────────────────────────────────────

    def collecter(self, ensemble: Ensemble):
        """Collecte asynchrone : chaque copie du jeu joue dans son propre fil, à son rythme, jusqu'à
        ce que l'ensemble ait joué `decisions_par_collecte × simulateurs` décisions.

        Avant, la collecte avançait « au pas » : à chaque décision, les 8 copies attendaient la plus
        lente. Un redémarrage (toutes les 50 parties) ou un long écran d'une seule copie
        immobilisait alors les 7 autres (141 → 10 à 45 décisions par seconde dans entrainement-3).
        Maintenant, une copie lente joue simplement moins de décisions pendant cette collecte.
        """
        n = ensemble.nombre
        restantes = [self.a["decisions_par_collecte"] * n]
        verrou = threading.Lock()
        # Une « piste » par copie : la suite de ses décisions, dans l'ordre où elle les a jouées.
        pistes: list[list[tuple]] = [[] for _ in range(n)]
        self.cerveau.eval()

        def jouer(i: int) -> None:
            while True:
                with verrou:
                    if restantes[0] <= 0:
                        return
                    restantes[0] -= 1
                etat = ensemble.etats[i]
                o, m = torch.from_numpy(etat.observation), torch.from_numpy(etat.masque)
                with torch.no_grad():
                    scores, valeur = self.cerveau(o[None], m[None])
                loi = Categorical(logits=scores[0])
                action = loi.sample()
                recompense, finie = ensemble.jouer(i, int(action))
                pistes[i].append((o, m, action, loi.log_prob(action), valeur[0], recompense, finie))

        list(ensemble.fils.map(jouer, range(n)))

        # Bilan (GAE), copie par copie : pour chaque décision, a-t-elle mieux tourné que ce que la
        # tête « valeur » avait prévu ? Les récompenses futures comptent, de moins en moins.
        gamma, lam = self.a["gamma"], self.a["lambda_gae"]
        lignes: list[tuple] = []
        for i, piste in enumerate(pistes):
            if not piste:
                continue
            etat = ensemble.etats[i]  # la décision suivante, pas encore jouée
            with torch.no_grad():
                _, valeur_suivante = self.cerveau(torch.from_numpy(etat.observation)[None],
                                                  torch.from_numpy(etat.masque)[None])
            suivante, accumule = valeur_suivante[0], torch.tensor(0.0)
            bilan = []
            for o, m, action, logprob, valeur, recompense, finie in reversed(piste):
                continue_ = 0.0 if finie else 1.0  # une partie finie ne regarde pas la suivante
                ecart = recompense + gamma * suivante * continue_ - valeur
                accumule = ecart + gamma * lam * continue_ * accumule
                bilan.append((o, m, action, logprob, accumule, accumule + valeur, recompense))
                suivante = valeur
            lignes.extend(reversed(bilan))

        obs, masques, actions, logprobs, avantages, retours, recompenses = zip(*lignes)
        return (torch.stack(obs), torch.stack(masques), torch.stack(actions), torch.stack(logprobs),
                torch.stack(avantages), torch.stack(retours), float(sum(recompenses)))

    def apprendre(self, obs, masques, actions, logprobs, avantages, retours) -> dict:
        self.cerveau.train()
        total = obs.shape[0]
        taille_lot = total // self.a["mini_lots"]
        mesures = {"pertePolitique": [], "perteValeur": [], "entropie": [], "klApprox": [], "fractionClip": []}
        for _ in range(self.a["epoques"]):
            ordre = torch.randperm(total)
            for debut in range(0, total, taille_lot):
                lot = ordre[debut:debut + taille_lot]
                scores, valeur = self.cerveau(obs[lot], masques[lot])
                loi = Categorical(logits=scores)
                ratio = (loi.log_prob(actions[lot]) - logprobs[lot]).exp()
                av = avantages[lot]
                av = (av - av.mean()) / (av.std() + 1e-8)
                # PPO : on suit l'avantage, mais sans s'éloigner de plus de « clip » de l'ancienne politique.
                perte_politique = torch.max(-av * ratio, -av * ratio.clamp(1 - self.a["clip"], 1 + self.a["clip"])).mean()
                perte_valeur = 0.5 * ((valeur - retours[lot]) ** 2).mean()
                entropie = loi.entropy().mean()
                perte = perte_politique - self.a["coef_entropie"] * entropie + self.a["coef_valeur"] * perte_valeur
                self.optimiseur.zero_grad()
                perte.backward()
                torch.nn.utils.clip_grad_norm_(self.cerveau.parameters(), self.a["norme_gradient_max"])
                self.optimiseur.step()
                with torch.no_grad():
                    mesures["pertePolitique"].append(float(perte_politique))
                    mesures["perteValeur"].append(float(perte_valeur))
                    mesures["entropie"].append(float(entropie))
                    mesures["klApprox"].append(float(((ratio - 1) - ratio.log()).mean()))
                    mesures["fractionClip"].append(float(((ratio - 1).abs() > self.a["clip"]).float().mean()))
        return {k: round(float(np.mean(v)), 5) for k, v in mesures.items()}


def charger_reglages() -> dict:
    return tomllib.loads(REGLAGES.read_text(encoding="utf-8"))


def main() -> None:
    parametres = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    groupe = parametres.add_mutually_exclusive_group(required=True)
    groupe.add_argument("--depart", type=Path, help="cerveau .cerveau de départ (nouvel entraînement)")
    groupe.add_argument("--reprendre", type=Path, help="dossier d'un entraînement à poursuivre")
    parametres.add_argument("--minutes", type=float, default=30)
    parametres.add_argument("--nom", help="nom du dossier d'entraînement (par défaut : date et heure)")
    parametres.add_argument("--simulateurs", type=int, help="nombre de copies du jeu (par défaut : reglages.toml)")
    args = parametres.parse_args()
    torch.set_num_threads(4)

    reglages = charger_reglages()
    if args.simulateurs:
        reglages["apprentissage"]["simulateurs"] = args.simulateurs
    if args.reprendre:
        dossier = args.reprendre
        etat = torch.load(dossier / "etat.pt")
        cerveau = None  # recréé une fois les tailles connues (plus bas)
        origine = etat["origine"]
    else:
        dossier = LEXAR / "entrainements" / (args.nom or f"entrainement-{datetime.now():%Y-%m-%d-%Hh%M}")
        dossier.mkdir(parents=True, exist_ok=False)
        cerveau, entete = lire(args.depart)
        origine = args.depart.name
        etat = None
    # On garde une copie des réglages utilisés : un entraînement doit pouvoir être compris plus tard.
    shutil.copy(REGLAGES, dossier / f"reglages-{datetime.now():%Y%m%d-%H%M%S}.toml")
    # Numéro de ce processus, pour l'arrêter proprement : entraineur/arreter.sh <nom>
    fichier_pid = dossier / "processus.pid"
    fichier_pid.write_text(str(os.getpid()))

    a = reglages["apprentissage"]
    print(f"Entraînement : {dossier}")
    with Pont(a["simulateurs"]) as pont:
        if etat is not None:
            cerveau = Cerveau(pont.taille_entree, pont.nombre_actions, tuple(etat["tailles"]))
            cerveau.load_state_dict(etat["cerveau"])
            entrainement = Entrainement(dossier, cerveau, reglages, origine,
                                        etat["mises_a_jour"], etat["decisions"], etat["parties"])
            entrainement.optimiseur.load_state_dict(etat["optimiseur"])
        else:
            if (cerveau.taille_entree, cerveau.nombre_actions) != (pont.taille_entree, pont.nombre_actions):
                raise SystemExit("Ce cerveau ne correspond pas aux observations actuelles du jeu.")
            entrainement = Entrainement(dossier, cerveau, reglages, origine)

        ensemble = Ensemble(pont, reglages)
        debut = time.time()
        fin = debut + args.minutes * 60
        parties_recentes: list[dict] = []
        # Parties d'exercice (reparties d'une photo d'un combat qui bloque) : suivies à part, pour
        # que la vague moyenne reste celle de vraies parties, comparable d'un entraînement à l'autre.
        exercices_recents: list[dict] = []
        # Ctrl+C (ou arrêt du système) : on termine la mise à jour en cours, puis on sauvegarde
        # et on ferme les copies du jeu proprement, au lieu de s'interrompre n'importe où.
        arret = {"demande": False}

        def demander_arret(*_):
            if not arret["demande"]:
                print("\nArrêt demandé : fin de la mise à jour en cours, puis sauvegarde.", flush=True)
            arret["demande"] = True

        signal.signal(signal.SIGINT, demander_arret)
        signal.signal(signal.SIGTERM, demander_arret)
        while time.time() < fin and not arret["demande"]:
            t0 = time.time()
            *lot, recompense_totale = entrainement.collecter(ensemble)
            t_collecte = time.time() - t0
            mesures = entrainement.apprendre(*lot)
            entrainement.mises_a_jour += 1
            entrainement.decisions += lot[0].shape[0]

            finies = ensemble.vider_parties_finies()
            entrainement.parties += len(finies)
            for partie in finies:
                entrainement.noter("parties.jsonl", {"miseAJour": entrainement.mises_a_jour, **partie})
            parties_recentes = (parties_recentes + [p for p in finies if p.get("depart") is None])[-200:]
            exercices_recents = (exercices_recents + [p for p in finies if p.get("depart") is not None])[-200:]
            vagues = [p["vague"] for p in parties_recentes] or [0]
            # Un exercice est réussi quand la partie dépasse la vague photographiée (le combat est gagné).
            reussite = (round(float(np.mean([p["vague"] > p["depart"] for p in exercices_recents])), 3)
                        if exercices_recents else None)
            ligne = {
                "miseAJour": entrainement.mises_a_jour, "date": datetime.now().isoformat(timespec="seconds"),
                "decisions": entrainement.decisions, "parties": entrainement.parties,
                "partiesCollecte": len(finies),
                "vagueMoyenne": round(float(np.mean(vagues)), 3), "vagueMax": int(max(vagues)),
                "recompenseMoyenne": round(float(np.mean([p["recompense"] for p in parties_recentes] or [0])), 3),
                "capturesMoyennes": round(float(np.mean([p.get("recrues", p.get("captures", 0)) for p in parties_recentes] or [0])), 3),
                "decisionsParSeconde": round(lot[0].shape[0] / t_collecte, 1),
                "exercices": len([p for p in finies if p.get("depart") is not None]),
                "reussiteExercices": reussite,
                "photos": {v: len(r) for v, r in sorted(ensemble.photos.items())},
                "reussiteParCombat": {v: round(r, 3) for v in sorted(ensemble.resultats_exercices)
                                      if (r := ensemble.reussite_exercices(v)) is not None},
                **mesures,
            }
            entrainement.noter("journal.jsonl", ligne)
            print(f"maj {ligne['miseAJour']:4d} · {ligne['parties']:6d} parties · vague moy. {ligne['vagueMoyenne']:5.2f} "
                  f"(max {ligne['vagueMax']:3d}) · récompense {ligne['recompenseMoyenne']:6.2f} · "
                  f"entropie {mesures['entropie']:.3f} · {ligne['decisionsParSeconde']:.0f} déc/s"
                  + (f" · exercices réussis {100 * reussite:.0f} %" if reussite is not None else "")
                  + "".join(f" · v{v} {100 * r:.0f} %" for v, r in ligne["reussiteParCombat"].items() if v in (8, 20, 25)),
                  flush=True)
            if entrainement.mises_a_jour % reglages["sauvegarde"]["cerveau_toutes_les"] == 0:
                entrainement.sauvegarder(pont.versions)
        chemin = entrainement.sauvegarder(pont.versions)
        print(f"Dernier cerveau : {chemin}", flush=True)
    fichier_pid.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
