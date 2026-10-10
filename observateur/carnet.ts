/**
 * Le carnet de partie : la mémoire du cerveau (option A de docs/architecture.md).
 *
 * Il note ce qu'un joueur attentif retiendrait et qui n'est plus forcément à l'écran :
 * - pendant un combat : les attaques déjà utilisées par l'adversaire, son talent s'il a été affiché ;
 * - sur toute la partie : un journal (vagues, dresseurs, rencontres, K.O. subis).
 *
 * Il ne lit que des informations visibles : il ne « devine » jamais une donnée cachée.
 */
import type { MoveJeu, PokemonJeu, ScenePokerogue } from "./jeu";
import { BattleType, BiomeId, MoveCategory, PokemonType } from "./noms";
import type { AttaqueVue, EntreeJournal, Libelle, PokemonAdverse } from "./types";

/** Ce qu'un joueur sait d'une attaque qu'il a vue : son type, sa catégorie, sa puissance. */
export function attaqueVue(move: MoveJeu): AttaqueVue {
  return {
    id: move.id,
    nom: move.name,
    type: { id: move.type, nom: PokemonType[move.type]?.fr ?? `n°${move.type}` },
    categorie: { id: move.category, nom: MoveCategory[move.category]?.fr ?? `n°${move.category}` },
    puissance: move.power,
    precision: move.accuracy,
  };
}

export class Carnet {
  private vague = -1;
  /** uid de l'adversaire → attaques vues (id → attaque). Remis à zéro à chaque vague. */
  private attaquesVues = new Map<number, Map<number, AttaqueVue>>();
  /** uid de l'adversaire → talent affiché par le jeu. Remis à zéro à chaque vague. */
  private talentsReveles = new Map<number, Libelle>();
  /** Pokémon déjà notés dans le journal pour cette vague (rencontres, K.O.). */
  private dejaNotes = new Set<string>();
  /** uid → dernier état vu d'un Pokémon adverse sur le terrain (le banc dont on se souvient). */
  private adversairesVus = new Map<number, PokemonAdverse>();
  readonly journal: EntreeJournal[] = [];
  /**
   * Type du starter du rival, vu au rival 1 (vague 8) : il garde la même lignée toute la partie
   * (jeu : rival-team-gen.ts), un joueur s'en souvient pour préparer le rival 2.
   */
  private starterRival: number | undefined;

  /** À appeler régulièrement (à chaque phase dans le simulateur, plusieurs fois par seconde en ligne). */
  mettreAJour(scene: ScenePokerogue): void {
    const combat = scene.currentBattle;
    if (!combat || !scene.arena) {
      return;
    }
    if (combat.waveIndex < this.vague) {
      // La vague recule : c'est une nouvelle partie.
      this.oublierTout();
    }
    if (combat.waveIndex !== this.vague) {
      this.nouvelleVague(scene);
    }

    for (const adversaire of scene.getEnemyField()) {
      if (!adversaire.isOnField()) {
        continue;
      }
      this.noterUneFois(`vu-${adversaire.id}`, `Rencontre : ${adversaire.getNameToRender()} niv. ${adversaire.level}`);
      // Au rival 1 : son starter (Plante, Feu ou Eau en premier type) ; l'oiseau est Normal ou Vol.
      const type = adversaire.getTypes()[0];
      if (combat.waveIndex === 8 && combat.trainer && (type === 9 || type === 10 || type === 11)) {
        this.starterRival = type;
      }
      this.noterAttaquesVues(adversaire);
      if (adversaire.waveData?.abilityRevealed) {
        const talent = adversaire.getAbility();
        this.talentsReveles.set(adversaire.id, { id: talent.id, nom: talent.name });
      }
    }

    for (const allie of scene.getPlayerParty()) {
      if (allie.isFainted()) {
        this.noterUneFois(`ko-${allie.id}`, `${allie.name} est K.O.`);
      }
    }
  }

  /** Le type du starter du rival, s'il a été vu (rival 1). */
  typeStarterRival(): number | undefined {
    return this.starterRival;
  }

  attaquesVuesDe(uid: number): AttaqueVue[] {
    return [...(this.attaquesVues.get(uid)?.values() ?? [])];
  }

  talentReveleDe(uid: number): Libelle | null {
    return this.talentsReveles.get(uid) ?? null;
  }

  /** Retenir l'état d'un adversaire vu sur le terrain (appelé par l'observateur). */
  retenirAdversaire(adversaire: PokemonAdverse): void {
    this.adversairesVus.set(adversaire.uid, adversaire);
  }

  /**
   * Le banc adverse dont on se souvient : les Pokémon déjà vus pendant ce combat et qui ne sont
   * plus sur le terrain, dans leur dernier état vu (K.O. ou non : le jeu l'affiche). Un Pokémon
   * jamais sorti reste inconnu, comme pour un joueur.
   */
  bancVu(surTerrain: Set<number>, estKo: (uid: number) => boolean): PokemonAdverse[] {
    return [...this.adversairesVus.values()]
      .filter(a => !surTerrain.has(a.uid))
      .map(a => ({ ...a, position: -1, ko: estKo(a.uid) }));
  }

  private nouvelleVague(scene: ScenePokerogue): void {
    const combat = scene.currentBattle!;
    this.vague = combat.waveIndex;
    this.attaquesVues.clear();
    this.talentsReveles.clear();
    this.dejaNotes.clear();
    this.adversairesVus.clear();

    const biome = BiomeId[scene.arena!.biomeId]?.fr ?? `biome ${scene.arena!.biomeId}`;
    const dresseur = combat.trainer ? ` contre ${combat.trainer.getName(undefined, true)}` : "";
    const type = BattleType[combat.battleType]?.fr ?? "combat";
    this.journal.push({ vague: this.vague, texte: `Vague ${this.vague} (${biome}) : combat ${type}${dresseur}` });
  }

  private noterAttaquesVues(adversaire: PokemonJeu): void {
    const vues = this.attaquesVues.get(adversaire.id) ?? new Map<number, AttaqueVue>();
    for (const tour of adversaire.summonData?.moveHistory ?? []) {
      if (tour.move > 0 && !vues.has(tour.move)) {
        // On ne retient que les attaques de sa propre liste : une attaque appelée par une autre
        // (Métronome…) ne dit rien de ce qu'il pourra rejouer.
        const connue = adversaire.getMoveset().find(a => a.moveId === tour.move);
        if (connue) {
          vues.set(tour.move, attaqueVue(connue.getMove()));
        }
      }
    }
    this.attaquesVues.set(adversaire.id, vues);
  }

  private noterUneFois(cle: string, texte: string): void {
    if (!this.dejaNotes.has(cle)) {
      this.dejaNotes.add(cle);
      this.journal.push({ vague: this.vague, texte });
    }
  }

  private oublierTout(): void {
    this.vague = -1;
    this.journal.length = 0;
    this.starterRival = undefined;
    this.attaquesVues.clear();
    this.talentsReveles.clear();
    this.dejaNotes.clear();
    this.adversairesVus.clear();
  }
}
