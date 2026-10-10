from __future__ import annotations

import argparse
import json
import threading
from collections import Counter
from pathlib import Path

from .banc_complet import BANC, choisir_plan_seul, lire_resultats, trio_de
from .juge_cible import classer
from .pont import Etat, Pont
from .professeur import note_equipe
from .statistiques_banc import type_de_mort

PERDUE = -5.0
ECART_NET = 0.3
TIRAGES = 8
TIRAGES_VERIFICATION = 16


def partie(k: int) -> dict:
    return {"especes": trio_de(k), "graine": f"complet-{k}", "hasard_du_jeu": True, "plan_capture": True,
            "mysteres": "jeu", "style_combat": "changer"}


def photo_avant(simulateur, k: int, vague: int) -> str | None:
    etat = simulateur.nouvelle_partie(photos=[vague], vague_max=vague - 1, **partie(k))
    while isinstance(etat, Etat):
        etat = simulateur.agir(choisir_plan_seul(etat))
    return etat.info.get("photos", {}).get(str(vague))


def jouer_vague(simulateur, k: int, vague: int, photo: str, prefixe: list[int] = (), coup: int | None = None,
                hasard: str | None = None, recit: bool = False) -> dict:
    reglages = partie(k)
    reglages.pop("especes")
    etat = simulateur.nouvelle_partie(depart=photo, photos=[vague + 1], vague_max=vague, recit=recit, **reglages)
    etats, actions = [], []
    while isinstance(etat, Etat):
        n = len(actions)
        graine = None
        if n < len(prefixe):
            action = prefixe[n]
        elif n == len(prefixe) and coup is not None:
            action, graine = coup, hasard
        else:
            action = choisir_plan_seul(etat)
        etats.append(etat)
        actions.append(action)
        etat = simulateur.agir(action, hasard=graine)
    info = etat.info
    gagne = bool(info.get("tronquee")) and str(vague + 1) in info.get("photos", {}) and "erreur" not in info
    return {"etats": etats, "actions": actions, "gagne": gagne, "valeur": note_equipe(info.get("bilan", {})) if gagne else PERDUE}


def juger(pont: Pont, i: int, k: int, vague: int, avenirs: int, decisions_max: int) -> dict:
    photo = photo_avant(pont.entretenir(i), k, vague)
    if not photo:
        return {"k": k, "vague": vague, "arrive": False}
    reel = jouer_vague(pont.entretenir(i), k, vague, photo, recit=True)
    chances = sum(jouer_vague(pont.entretenir(i), k, vague, photo, [], reel["actions"][0], f"chance-{k}-{r}")["gagne"]
                  for r in range(TIRAGES)) if reel["actions"] else 0
    erreurs, gagnable, jugees = [], False, 0
    for d, etat in enumerate(reel["etats"]):
        if jugees >= decisions_max:
            break
        coups = etat.info.get("coups") or []
        permis = [a for a, c in enumerate(coups) if c and c.get("genre") in ("attaque", "changement")]
        if len(permis) < 2:
            continue
        jugees += 1
        q = {}
        for a in permis:
            essais = [jouer_vague(pont.entretenir(i), k, vague, photo, reel["actions"][:d], a, f"juge-{k}-{d}-{r}") for r in range(avenirs)]
            q[a] = (sum(e["valeur"] for e in essais) / avenirs, sum(e["gagne"] for e in essais))
        habituel = reel["actions"][d]
        meilleur = max(q, key=lambda a: q[a][0])
        gagnable = gagnable or q[meilleur][1] > 0
        ecart = q[meilleur][0] - q.get(habituel, q[meilleur])[0]
        if meilleur != habituel and ecart > ECART_NET:
            erreurs.append({"decision": d, "tour": etat.info.get("tour"), "ecart": round(ecart, 2),
                            "habituel": coups[habituel], "meilleur": coups[meilleur],
                            "categorie": classer(coups[habituel], coups[meilleur]),
                            "victoiresHabituel": q.get(habituel, (0, 0))[1], "victoiresMeilleur": q[meilleur][1]})
    return {"k": k, "vague": vague, "arrive": True, "perduDepuisPhoto": not reel["gagne"], "victoiresSur8": chances, "decisions": jugees,
            "gagnableEnUnCoup": gagnable, "erreurs": erreurs}


def verifier(pont: Pont, i: int, ligne: dict, tirages: int) -> list[dict]:
    k, vague = ligne["k"], ligne["vague"]
    fortes = [e for e in ligne.get("erreurs", []) if e["victoiresMeilleur"] - e["victoiresHabituel"] >= 2]
    if not fortes:
        return []
    photo = photo_avant(pont.entretenir(i), k, vague)
    reel = jouer_vague(pont.entretenir(i), k, vague, photo, recit=True)
    sortie = []
    for e in fortes:
        d = e["decision"]
        coups = reel["etats"][d].info.get("coups") or []
        habituel = reel["actions"][d]
        meilleur = next((a for a, c in enumerate(coups) if c == e["meilleur"]), None)
        if meilleur is None or coups[habituel] != e["habituel"]:
            continue
        victoires = {}
        for nom, a in (("habituel", habituel), ("meilleur", meilleur)):
            victoires[nom] = sum(jouer_vague(pont.entretenir(i), k, vague, photo, reel["actions"][:d], a, f"verif-{k}-{d}-{r}")["gagne"]
                                 for r in range(tirages))
        sortie.append({"k": k, "vague": vague, "decision": d, "categorie": e["categorie"], **victoires})
    return sortie


def main() -> None:
    parametres = argparse.ArgumentParser(description="Juge des défaites d'un banc complet (plan seul) : quel coup aurait gagné ?")
    parametres.add_argument("--banc", default="p7-ref")
    parametres.add_argument("--dossier", default=str(BANC))
    parametres.add_argument("--types", nargs="+", default=["rival", "champion d'arène"])
    parametres.add_argument("--vagues", nargs="*", type=int, default=[])
    parametres.add_argument("--nombre", type=int, default=20)
    parametres.add_argument("--avenirs", type=int, default=3)
    parametres.add_argument("--decisions-max", type=int, default=30)
    parametres.add_argument("--processus", type=int, default=4)
    parametres.add_argument("--sortie", type=Path, required=True)
    parametres.add_argument("--verifier", type=Path, nargs="*", default=[])
    args = parametres.parse_args()
    if args.verifier:
        verifier_tout(args)
        return
    resultats = lire_resultats(args.banc, Path(args.dossier))
    morts = [(k, r["vague"]) for k, r in sorted(resultats.items())
             if type_de_mort(r) in args.types and (not args.vagues or r["vague"] in args.vagues)]
    faites = set()
    if args.sortie.exists():
        faites = {(r["k"], r["vague"]) for r in map(json.loads, args.sortie.read_text(encoding="utf-8").splitlines())}
    a_faire = [m for m in morts[: args.nombre] if m not in faites]
    print(f"{len(morts)} défaites retenues, {len(a_faire)} à juger", flush=True)
    verrou = threading.Lock()

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                k, vague = a_faire.pop(0)
            try:
                ligne = juger(pont, i, k, vague, args.avenirs, args.decisions_max)
            except (TimeoutError, ConnectionError, OSError) as e:
                pont.redemarrer(i)
                ligne = {"k": k, "vague": vague, "erreur": str(e)}
            with verrou:
                with open(args.sortie, "a", encoding="utf-8") as f:
                    f.write(json.dumps(ligne, ensure_ascii=False) + "\n")
                print(f"  k={k} vague {vague} : {len(ligne.get('erreurs', []))} erreurs nettes, "
                      f"gagnable en un coup : {ligne.get('gagnableEnUnCoup')}", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    lignes = [json.loads(x) for x in args.sortie.read_text(encoding="utf-8").splitlines()]
    jugees = [r for r in lignes if r.get("arrive") and r.get("perduDepuisPhoto")]
    bilan = Counter(e["categorie"] for r in jugees for e in r["erreurs"])
    print(f"\n{len(jugees)} défaites rejouées à l'identique sur {len(lignes)}")
    print(f"gagnables en changeant un seul coup : {sum(r['gagnableEnUnCoup'] for r in jugees)}")
    if jugees:
        print(f"le bot gagne ce combat depuis la photo {100 * sum(r['victoiresSur8'] for r in jugees) / (TIRAGES * len(jugees)):.0f} % du temps (autres tirages)")
    for cle, n in bilan.most_common():
        print(f"  {n:4}  {cle}")


def verifier_tout(args) -> None:
    a_faire = [json.loads(x) for f in args.verifier for x in f.read_text(encoding="utf-8").splitlines()]
    a_faire = [r for r in a_faire if r.get("perduDepuisPhoto")]
    verrou = threading.Lock()
    toutes: list[dict] = []

    def boucle(pont: Pont, i: int) -> None:
        while True:
            with verrou:
                if not a_faire:
                    return
                ligne = a_faire.pop(0)
            resultats = verifier(pont, i, ligne, TIRAGES_VERIFICATION)
            with verrou:
                toutes.extend(resultats)
                with open(args.sortie, "a", encoding="utf-8") as f:
                    for r in resultats:
                        f.write(json.dumps(r, ensure_ascii=False) + "\n")
                print(f"  k={ligne['k']} : {len(resultats)} erreurs revérifiées", flush=True)

    with Pont(args.processus) as pont:
        fils = [threading.Thread(target=boucle, args=(pont, i)) for i in range(len(pont.simulateurs))]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
    n = len(toutes) * TIRAGES_VERIFICATION or 1
    print(f"\n{len(toutes)} erreurs fortes revérifiées sur {TIRAGES_VERIFICATION} nouveaux avenirs :")
    print(f"  coup habituel : {100 * sum(r['habituel'] for r in toutes) / n:.0f} % de victoires · "
          f"meilleur coup du juge : {100 * sum(r['meilleur'] for r in toutes) / n:.0f} %")
    par = Counter(r["categorie"] for r in toutes)
    for cat, nombre in par.most_common():
        h = sum(r["habituel"] for r in toutes if r["categorie"] == cat)
        m = sum(r["meilleur"] for r in toutes if r["categorie"] == cat)
        print(f"  {cat} ({nombre}) : {100 * h / (nombre * TIRAGES_VERIFICATION):.0f} % → {100 * m / (nombre * TIRAGES_VERIFICATION):.0f} %")


if __name__ == "__main__":
    main()
