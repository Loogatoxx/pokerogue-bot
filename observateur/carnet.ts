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
import type { AttaqueVue, EntreeJournal, Libelle } from "./types";

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
  readonly journal: EntreeJournal[] = [];

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

  attaquesVuesDe(uid: number): AttaqueVue[] {
    return [...(this.attaquesVues.get(uid)?.values() ?? [])];
  }

  talentReveleDe(uid: number): Libelle | null {
    return this.talentsReveles.get(uid) ?? null;
  }

  private nouvelleVague(scene: ScenePokerogue): void {
    const combat = scene.currentBattle!;
    this.vague = combat.waveIndex;
    this.attaquesVues.clear();
    this.talentsReveles.clear();
    this.dejaNotes.clear();

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
    this.attaquesVues.clear();
    this.talentsReveles.clear();
    this.dejaNotes.clear();
  }
}
