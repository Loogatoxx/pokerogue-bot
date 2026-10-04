from __future__ import annotations

from .statistiques_banc import (
    RIVAUX,
    comparer_apparie,
    resume,
    strates_de_force,
    taux_de_passage_des_rivaux,
    tranche_de,
    type_de_mort,
)


def mort(vague: int, dresseur: str | None = None, type_combat: str | None = None, boss: bool | None = None) -> dict:
    defaite: dict = {"dresseur": dresseur}
    if type_combat is not None:
        defaite["typeCombat"] = type_combat
    if boss is not None:
        defaite["boss"] = boss
    return {"vague": vague, "defaite": defaite}


def tester_type_de_mort() -> None:
    assert type_de_mort(mort(25, "RIVAL_2", "TRAINER", False)) == "rival"
    assert type_de_mort(mort(20, "CHEREN", "TRAINER", False)) == "champion d'arène"
    assert type_de_mort(mort(30, None, "WILD", True)) == "boss sauvage"
    assert type_de_mort(mort(33, None, "WILD", True)) == "boss sauvage"
    assert type_de_mort(mort(33, None, "WILD", False)) == "sauvage"
    assert type_de_mort(mort(24, None, "MYSTERY_ENCOUNTER", True)) == "rencontre mystère"
    assert type_de_mort(mort(47, "HIKER", "TRAINER", False)) == "dresseur"
    assert type_de_mort(mort(66, "PETREL", "TRAINER", False)) == "team"
    assert type_de_mort(mort(184, "LORELEI", "TRAINER", False)) == "conseil 4"
    assert type_de_mort(mort(200, None, "WILD", True)) == "boss final"
    assert type_de_mort({"vague": 200, "victoire": True}) == "victoire"
    assert type_de_mort(mort(40)) == "boss sauvage"
    assert type_de_mort(mort(41)) == "sauvage"


def tester_rivaux() -> None:
    assert RIVAUX == {8: "rival 1", 25: "rival 2", 55: "rival 3", 95: "rival 4", 145: "rival 5", 195: "rival 6"}
    assert taux_de_passage_des_rivaux([8, 8, 25, 30, 30]) == ["rival 1 60 %", "rival 2 67 %"]


def tester_comparaison_appariee() -> None:
    _, erreur_type, verdict = comparer_apparie([1, 1, 1, 1])
    assert erreur_type == 0 and verdict.startswith("GARDER")
    moyenne, erreur_type, verdict = comparer_apparie([1, 3])
    assert moyenne == 2 and abs(erreur_type - 1) < 1e-9 and "bruit" in verdict
    assert "bruit" in comparer_apparie([2, -2, 2, -2])[2]
    assert "perte" in comparer_apparie([-3, -3, -3, -2])[2]


def tester_tranches() -> None:
    assert [tranche_de(v) for v in (1, 10, 11, 58, 200)] == [1, 1, 11, 51, 191]


def tester_strates() -> None:
    resultats = [{"vague": 10 * (i + 1), "totalStatsDepart": 900 + 10 * i} for i in range(6)]
    lignes = strates_de_force(resultats)
    assert lignes[0].startswith("starters faibles : 2 parties")
    assert lignes[2].startswith("starters forts : 2 parties · vague moyenne 55.0")


def tester_resume_avec_erreur() -> None:
    resultats = [mort(25, "RIVAL_2", "TRAINER", False), mort(41), {"k": 3, "vague": 12, "erreur": "bloqué"}]
    texte = resume(resultats)
    assert "2 parties valides (1 en erreur, exclues)" in texte
    assert "vague moyenne 33.00" in texte


def tester_plan_seul() -> None:
    from types import SimpleNamespace

    from .banc_complet import choisir_plan_seul
    assert choisir_plan_seul(SimpleNamespace(masque=[False, True, True, True], plan=[9.0, 1.0, 3.0, 3.0])) == 2
    assert choisir_plan_seul(SimpleNamespace(masque=[False, False, True], plan=None)) == 2


def main() -> None:
    tester_type_de_mort()
    tester_rivaux()
    tester_comparaison_appariee()
    tester_tranches()
    tester_strates()
    tester_resume_avec_erreur()
    print("statistiques du banc : OK")
    tester_plan_seul()
    print("plan seul : OK")


if __name__ == "__main__":
    main()
