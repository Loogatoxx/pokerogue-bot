// Fichier GÉNÉRÉ par observateur/generer-attaques.py depuis la copie locale du jeu — ne pas modifier à la main.
/**
 * Attaques dont la puissance affichée trompe (identifiant → part de la puissance vraiment utile,
 * tour pour tour) : le lanceur sacrifié (Explosion), un tour de recharge (Ultralaser) ou de charge
 * (Lance-Soleil), une condition rarement remplie (Mitra-Poing, Dévorêve). Absentes : 1.
 */
export const CONTRAINTES_ATTAQUES: Readonly<Record<number, number>> = {
  13: 0.6, // RAZOR_WIND (charge)
  19: 0.6, // FLY (charge)
  63: 0.55, // HYPER_BEAM (recharge)
  76: 0.6, // SOLAR_BEAM (charge)
  91: 0.6, // DIG (charge)
  120: 0.15, // SELF_DESTRUCT (sacrifice)
  130: 0.6, // SKULL_BASH (charge)
  138: 0.3, // DREAM_EATER (condition)
  143: 0.6, // SKY_ATTACK (charge)
  153: 0.15, // EXPLOSION (sacrifice)
  264: 0.3, // FOCUS_PUNCH (condition)
  291: 0.6, // DIVE (charge)
  307: 0.55, // BLAST_BURN (recharge)
  308: 0.55, // HYDRO_CANNON (recharge)
  338: 0.55, // FRENZY_PLANT (recharge)
  340: 0.6, // BOUNCE (charge)
  416: 0.55, // GIGA_IMPACT (recharge)
  439: 0.55, // ROCK_WRECKER (recharge)
  459: 0.55, // ROAR_OF_TIME (recharge)
  467: 0.6, // SHADOW_FORCE (charge)
  507: 0.6, // SKY_DROP (charge)
  515: 0.15, // FINAL_GAMBIT (sacrifice)
  553: 0.6, // FREEZE_SHOCK (charge)
  554: 0.6, // ICE_BURN (charge)
  566: 0.6, // PHANTOM_FORCE (charge)
  669: 0.6, // SOLAR_BLADE (charge)
  711: 0.55, // PRISMATIC_LASER (recharge)
  794: 0.55, // METEOR_ASSAULT (recharge)
  795: 0.55, // ETERNABEAM (recharge)
  800: 0.6, // METEOR_BEAM (charge)
  802: 0.15, // MISTY_EXPLOSION (sacrifice)
  937: 0.6, // ELECTRO_SHOT (charge)
};

/** La part de sa puissance qu'une attaque rapporte vraiment (1 pour une attaque ordinaire). */
export const facteurAttaque = (id: number | undefined): number => (id === undefined ? 1 : CONTRAINTES_ATTAQUES[id] ?? 1);
