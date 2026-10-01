/**
 * Le panneau : tourne dans le monde isolé de l'extension et affiche, par-dessus le jeu,
 * ce que le cerveau voit (observation envoyée par le capteur) et ce qu'il en pense.
 *
 * Rangé du plus important au moins important, pour ne jamais avoir à chercher :
 * - En-tête : état du jeu, mode Conseil / Auto (et vitesse en auto), bouton pour replier.
 * - Le choix : ce que le jeu attend et ce que le cerveau (ou le pilote) choisit, en gros.
 * - Le duel : adversaires et équipe en une ligne chacun (nom, niveau, PV).
 * - Le reste replié : partie, fiches détaillées (IVs, nature, attaques…), carnet, cerveau.
 *
 * Habillé comme le jeu : sa police pixel (« emerald ») et son cadre de fenêtre (window_1.png),
 * pris sur la page elle-même (pokerogue.net ou la copie locale les servent déjà).
 *
 * Aucun élément du panneau ne prend jamais le focus clavier : sinon Espace et Entrée
 * « recliquent » le dernier bouton touché et les flèches font défiler le panneau au lieu
 * d'aller au jeu. Toutes les touches restent donc au jeu.
 *
 * Il vit dans un « Shadow DOM » : une bulle de page à part, pour que les styles du jeu
 * et ceux du panneau ne se mélangent pas.
 */
import { type Cerveau, lireCerveau, meilleureAction, penser, type Reponse } from "../../cerveau/cerveau";
import { decrireAction, NOMBRE_ACTIONS } from "../../observateur/actions";
import { encoder, TAILLES_ENCODAGE, VERSION_ENCODAGE } from "../../observateur/encodeur";
import { attaquesPossibles, connaissance, immunitesPossibles, nomTalent } from "../../observateur/especes";
import { chanceCapture } from "../../observateur/capture";
import { planifier } from "../../observateur/planificateur";
import { prevoir, prevoirChangement } from "../../observateur/prevision";
import { PokeballType, PokemonType } from "../../observateur/noms";
import {
  type Decision,
  type Libelle,
  type Objet,
  type Observation,
  type PokemonAdverse,
  type PokemonAllie,
} from "../../observateur/types";
import { type ContenuPanneau, cleDecision, estMessageCapteur, type MessageCapteur, SOURCE } from "./messages";

const LIBELLES_IVS = ["PV", "Att", "Déf", "AtS", "DéS", "Vit"];
const LIBELLES_MODIFS = ["Att", "Déf", "AtS", "DéS", "Vit", "Préc", "Esq"];
const COULEURS_TYPES: Readonly<Record<string, string>> = {
  NORMAL: "#A8A77A", FIRE: "#EE8130", WATER: "#6390F0", ELECTRIC: "#F7D02C", GRASS: "#7AC74C",
  ICE: "#96D9D6", FIGHTING: "#C22E28", POISON: "#A33EA1", GROUND: "#E2BF65", FLYING: "#A98FF3",
  PSYCHIC: "#F95587", BUG: "#A6B91A", ROCK: "#B6A136", GHOST: "#735797", DRAGON: "#6F35FC",
  DARK: "#705746", STEEL: "#B7B7CE", FAIRY: "#D685AD", STELLAR: "#40B5A5", UNKNOWN: "#68A090",
};

/**
 * Où la page sert les ressources du jeu. Vide sur le jeu lui-même ; la page d'aperçu le
 * change (attribut data-ressources-jeu) pour les prendre dans la copie locale.
 */
const RESSOURCES = document.documentElement.dataset.ressourcesJeu ?? "";

// Couleurs du cadre window_1 du jeu (bordeaux) et de son texte blanc à ombre violette.
const STYLE = `
  :host { all: initial; }
  .panneau {
    position: fixed; top: 8px; right: 8px; z-index: 2147483647; box-sizing: border-box;
    width: 320px; max-height: calc(100vh - 16px); overflow: hidden;
    border: 16px solid #c73625; background: #362d3e;
    border-image: url("${RESSOURCES}/images/ui/windows/window_1.png") 8 fill / 16px stretch;
    image-rendering: pixelated; padding: 0 2px;
    color: #f8f8f8; font: 16px/18px emerald, pkmnems, monospace; text-shadow: 1px 1px #6b5a73;
    -webkit-font-smoothing: none; user-select: none;
  }
  .entete {
    position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 6px;
    padding: 0 0 4px; background: #362d3e; cursor: move;
  }
  .titre { flex: 1; font-size: 32px; line-height: 28px; letter-spacing: 1px; }
  .etat { color: #c8c0d0; }
  .etat::before { content: ""; display: inline-block; width: 6px; height: 6px; margin: 0 4px 1px 0; background: #e3b341; box-shadow: 1px 1px #181818; }
  .etat.direct::before { background: #58d080; }
  .etat.erreur::before { background: #f85838; }
  .outils { display: flex; flex-wrap: wrap; gap: 4px 8px; padding-bottom: 6px; border-bottom: 2px solid #582e39; }
  .groupe { display: inline-flex; gap: 2px; }
  button {
    all: unset; cursor: pointer; padding: 1px 6px 2px; background: #472d3c; color: #f8f8f8;
    font: inherit; text-shadow: inherit; box-shadow: inset 0 0 0 2px #7a3033;
  }
  button:hover { background: #582e39; }
  button.actif { background: #c73625; box-shadow: inset 0 0 0 2px #f89878; }
  button.replier { width: 16px; padding: 1px 3px 2px; text-align: center; }
  .replie .outils, .replie .corps { display: none; }
  .replie .choix { border-bottom: 0; padding-bottom: 0; }

  .choix { padding: 6px 0 8px; border-bottom: 2px solid #582e39; }
  .quoi { color: #c8c0d0; }
  .gros { margin: 2px 0; font-size: 32px; line-height: 30px; color: #f8f8f8; overflow-wrap: anywhere; }
  .gros .note { font-size: 16px; color: #c8c0d0; }
  .jauge { position: relative; height: 16px; background: #181818; box-shadow: inset 0 0 0 2px #582e39; }
  .jauge > div { height: 100%; background: #c73625; }
  .jauge > span { position: absolute; right: 5px; top: -1px; }
  .autre { display: grid; grid-template-columns: 1fr 64px 36px; gap: 6px; align-items: center; color: #c8c0d0; }
  .autre .barre { margin: 0; }
  .num { text-align: right; }
  .pilote { margin-top: 4px; color: #c8c0d0; }
  .pour { color: #88e0a0; }
  .contre { color: #f8a878; }
  .alerte { color: #f89878; }

  .corps { padding-top: 4px; }
  .etiquette { margin: 6px 0 2px; color: #a898b0; letter-spacing: 1px; }
  .pk { padding: 1px 0; }
  .pk.ko { opacity: 0.45; }
  .pk .haut { display: flex; align-items: center; gap: 4px; }
  .pk.allie { display: grid; grid-template-columns: 1fr auto 72px 52px; gap: 6px; align-items: center; }
  .pk .nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pk.terrain .nom::before { content: "▶ "; color: #f89878; }
  .ligne-pv { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
  .barre { height: 6px; margin: 2px 0; background: #181818; box-shadow: 0 0 0 1px #582e39; }
  .barre > div { height: 100%; }
  .type { display: inline-block; padding: 0 3px; margin-left: 2px; color: #181818; text-shadow: none; box-shadow: inset 0 -2px rgba(0,0,0,.25); }
  .puce { display: inline-block; padding: 0 4px; margin: 1px 2px 0 0; background: #472d3c; }
  .discret { color: #a898b0; }

  details { margin-top: 4px; }
  summary { cursor: pointer; list-style: none; padding: 2px 0; color: #c8c0d0; letter-spacing: 1px; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▶ "; color: #f89878; }
  details[open] > summary::before { content: "▼ "; }
  summary:hover { color: #f8f8f8; }
  .fiche { padding: 4px 6px; margin: 2px 0 4px; background: #472d3c; }
  .fiche .nom { color: #f8f8f8; }
  .journal { margin: 0; padding-left: 22px; }
`;

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function puceType(type: Libelle): string {
  const couleur = COULEURS_TYPES[PokemonType[type.id]?.cle ?? "UNKNOWN"] ?? "#68A090";
  return `<span class="type" style="background:${couleur}">${echapper(type.nom)}</span>`;
}

function barrePv(pourcent: number): string {
  const couleur = pourcent > 50 ? "#58d080" : pourcent > 20 ? "#f8c028" : "#f85838";
  return `<div class="barre"><div style="width:${Math.max(0, Math.min(100, pourcent))}%;background:${couleur}"></div></div>`;
}

function modifsNonNulles(modifs: number[]): string {
  const textes = modifs
    .map((m, i) => (m === 0 ? "" : `${LIBELLES_MODIFS[i]} ${m > 0 ? "+" : "−"}${Math.abs(m)}`))
    .filter(Boolean);
  return textes.length ? `<div>Modifs : ${textes.map(echapper).join(" · ")}</div>` : "";
}

function statut(s: Libelle): string {
  return s.id === 0 ? "" : ` <span class="alerte">${echapper(s.nom)}</span>`;
}

function listeObjets(objets: Objet[]): string {
  return objets.length
    ? `<div>Objets : ${objets.map(o => echapper(`${o.nom}${o.quantite > 1 ? ` ×${o.quantite}` : ""}`)).join(", ")}</div>`
    : "";
}

// ─── Le duel : une ligne par Pokémon ─────────────────────────────────────────────────────────

/**
 * Ce que l'adversaire va sans doute faire (observateur/prevision.ts : la formule de l'IA du jeu,
 * avec ce qu'un joueur voit), et qui de l'équipe l'encaisserait le mieux : le jeu de prédiction.
 */
function prevision(a: PokemonAdverse, obs: Observation): string {
  const p = prevoir(obs, a);
  const coup = p?.coups[0];
  if (!p || !coup) {
    return "";
  }
  const efficace = p.superEfficace >= 0.5 ? " · super efficace" : "";
  // Le membre du banc qui encaisserait le mieux ce coup, s'il fait nettement mieux que l'actuel.
  const restant = (i: number) => (obs.equipe[i]!.pv / Math.max(obs.equipe[i]!.pvMax, 1)) || 1;
  const charge = (i: number) => (p.degatsSiEntre[i] ?? 0) / restant(i);
  const actuel = obs.equipe.findIndex(m => m.surTerrain && !m.ko);
  const remplacant = obs.equipe
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.ko && !m.surTerrain)
    .sort((x, y) => charge(x.i) - charge(y.i))[0];
  const mieux = remplacant && actuel >= 0 && charge(remplacant.i) < charge(actuel) / 2
    ? ` · ${echapper(remplacant.m.nom)} l'encaisserait mieux` : "";
  // Un dresseur dont le Pokémon est en mauvaise posture le remplace souvent (règle du jeu).
  const change = prevoirChangement(obs, a);
  const changement = change && change.probabilite >= 0.5
    ? `<div class="discret alerte">Va sans doute changer de Pokémon (${Math.round(change.probabilite * 100)} %)`
      + `${change.vers ? ` pour ${echapper(change.vers.nom)}` : " pour un Pokémon pas encore vu"}</div>`
    : "";
  const debut = changement ? "Sinon, va" : "Va";
  return `${changement}<div class="discret">${debut} sans doute utiliser : ${echapper(coup.attaque.nom)} (${Math.round(coup.probabilite * 100)} %)${efficace}${mieux}</div>`;
}

/** Pokémon sauvage : sa chance d'entrer dans la meilleure Ball en stock (formule du jeu). */
function capture(a: PokemonAdverse, obs: Observation): string {
  if (obs.partie.dresseur || a.boss || a.ko) {
    return "";
  }
  const meilleure = [...obs.partie.balls].filter(b => b.quantite > 0).sort((x, y) => y.id - x.id)[0];
  if (!meilleure) {
    return "";
  }
  return `<div class="discret">Capture : ${Math.round(chanceCapture(a, meilleure.id) * 100)} % avec une ${echapper(meilleure.nom)}</div>`;
}

function ligneAdversaire(a: PokemonAdverse, obs: Observation): string {
  const boss = a.boss ? ` <span class="alerte">boss ${a.boss.segmentsRestants}/${a.boss.segments}</span>` : "";
  return `
    <div class="pk${a.ko ? " ko" : ""}">
      <div class="haut"><span class="nom">${echapper(a.nom)}${a.shiny ? " ✨" : ""}${a.dejaCapture ? ` <span class="discret" title="Déjà capturé">◓</span>` : ""}</span>
        <span>N.${a.niveau}</span> ${a.types.map(puceType).join("")}</div>
      <div class="ligne-pv">${barrePv(a.pvPourcent)}<span>${a.pvPourcent} %${statut(a.statut)}${boss}</span></div>
      ${prevision(a, obs)}
      ${capture(a, obs)}
    </div>`;
}

function ligneAllie(p: PokemonAllie): string {
  return `
    <div class="pk allie${p.surTerrain ? " terrain" : ""}${p.ko ? " ko" : ""}">
      <span class="nom">${echapper(p.nom)}${p.shiny ? " ✨" : ""}</span><span>N.${p.niveau}</span>
      ${barrePv((p.pv / Math.max(p.pvMax, 1)) * 100)}<span class="num">${p.pv}/${p.pvMax}${statut(p.statut)}</span>
    </div>`;
}

// ─── Les fiches détaillées (repliées) ────────────────────────────────────────────────────────

function ficheAdversaire(a: PokemonAdverse): string {
  const c = connaissance(a.espece);
  const possibles = c ? [...new Set(c.talents.filter(t => t > 0))].map(nomTalent).join(" / ") : "";
  const talent = a.talentRevele
    ? echapper(a.talentRevele.nom)
    : `<span class="discret">? (pas encore affiché${possibles ? ` — possibles : ${echapper(possibles)}` : ""})</span>`;
  const immunites = immunitesPossibles(a.espece, a.talentRevele?.id ?? null);
  const annule = immunites.length
    ? `<div>Peut annuler : ${immunites.map(t => echapper(PokemonType[t]?.fr ?? String(t))).join(", ")}</div>`
    : "";
  const peutConnaitre = attaquesPossibles(a.espece, a.niveau)
    .sort((x, y) => y.puissance - x.puissance)
    .slice(0, 4)
    .map(x => `<span class="puce">${echapper(x.nom)} <span class="discret">${x.puissance}</span></span>`)
    .join("");
  const potentiel = c ? `<div class="discret">Potentiel : forme finale ${c.totalFinal} (actuelle ${c.total})</div>` : "";
  const attaques = a.attaquesVues.length
    ? a.attaquesVues.map(x => `<span class="puce">${echapper(x.nom)}</span>`).join("")
    : `<span class="discret">aucune pour l'instant</span>`;
  return `
    <div class="fiche">
      <div><span class="nom">${echapper(a.nom)}</span> <span class="discret">(adversaire)</span></div>
      <div>Talent : ${talent}</div>
      ${annule}
      <div>Attaques vues : ${attaques}</div>
      ${peutConnaitre ? `<div>Peut connaître (N.${a.niveau}) : ${peutConnaitre}</div>` : ""}
      ${potentiel}
      ${listeObjets(a.objets)}
      ${modifsNonNulles(a.modifStats)}
      <div class="discret">Caché au cerveau : IVs, nature, PV exacts, ses vraies attaques et son vrai talent tant qu'ils ne sont pas montrés (il connaît seulement le possible, comme un joueur).</div>
    </div>`;
}

function ficheAllie(p: PokemonAllie): string {
  const attaques = p.attaques
    .map(x => `<span class="puce">${echapper(x.nom)} <span class="discret">${x.pp}/${x.ppMax}</span></span>`)
    .join("");
  const talent = echapper(p.talent.nom) + (p.passif ? ` + ${echapper(p.passif.nom)}` : "");
  return `
    <div class="fiche">
      <div><span class="nom">${echapper(p.nom)}</span> ${p.types.map(puceType).join("")}</div>
      <div>Nature ${echapper(p.nature.nom)} · ${talent}</div>
      <div class="discret">IVs ${p.ivs.map((v, i) => `${LIBELLES_IVS[i]} ${v}`).join(" · ")}</div>
      <div>${attaques}</div>
      ${listeObjets(p.objets)}
      ${modifsNonNulles(p.modifStats)}
    </div>`;
}

function section(cle: string, titre: string, corps: string, ouverts: ReadonlySet<string>): string {
  return `<details data-cle="${cle}"${ouverts.has(cle) ? " open" : ""}><summary tabindex="-1">${echapper(titre)}</summary>${corps}</details>`;
}

function duelEtDetails(obs: Observation, ouverts: ReadonlySet<string>): string {
  const p = obs.partie;
  const dresseur = p.dresseur ? `<div>Dresseur ${echapper(p.dresseur.nom)} · ${p.dresseur.pokemonRestants} Pokémon restants</div>` : "";
  const balls = p.balls.filter(b => b.quantite > 0).map(b => `${echapper(b.nom)} ×${b.quantite}`).join(" · ") || "aucune";
  const journal = obs.journal
    .slice(-10)
    .reverse()
    .map(e => `<li><span class="discret">V${e.vague}</span> ${echapper(e.texte)}</li>`)
    .join("");
  const partie = `
    <div class="fiche">
      <div>Vague ${p.vague} · ${echapper(p.biome.nom)} · tour ${p.tour}${p.double ? " · double" : ""}</div>
      <div>Combat ${echapper(p.typeCombat.nom)}</div>
      ${dresseur}
      <div>Météo ${echapper(p.meteo.nom)} · Terrain ${echapper(p.terrain.nom)}</div>
      <div>${p.argent.toLocaleString("fr-FR")} ₽ · ${balls}</div>
    </div>`;
  return `
    <div class="etiquette">ADVERSAIRE${obs.adversaires.length > 1 ? "S" : ""}</div>
    ${obs.adversaires.map(a => ligneAdversaire(a, obs)).join("") || `<div class="discret">Personne sur le terrain.</div>`}
    <div class="etiquette">ÉQUIPE</div>
    ${obs.equipe.map(ligneAllie).join("")}
    ${section("partie", "PARTIE", partie, ouverts)}
    ${section("fiches", "FICHES (IVs, attaques…)", [...obs.adversaires.map(ficheAdversaire), ...obs.equipe.map(ficheAllie)].join(""), ouverts)}
    ${section("carnet", "CARNET", `<div class="fiche"><ol class="journal" reversed>${journal}</ol></div>`, ouverts)}`;
}

// ─── Ce que le jeu attend ────────────────────────────────────────────────────────────────────

function texteDecision(d: Decision, obs: Observation): string {
  const acteur = obs.equipe.find(p => p.uid === d.acteur)?.nom ?? "ton Pokémon";
  const textes: Record<Decision["type"], string> = {
    "equipe-depart": "Composer l'équipe de départ",
    combat: `Action de ${acteur}`,
    cible: "Choisir la cible",
    bonus: "Choisir une récompense",
    remplacement: "Pokémon à envoyer",
    "attaque-a-oublier": "Attaque à oublier",
    "equipe-pleine": "Équipe pleine : qui garder ?",
    biome: "Prochain biome",
    "rencontre-mystere": "Rencontre mystère",
    aucune: "Le jeu déroule le tour…",
  };
  return textes[d.type];
}

function enteteChoix(obs: Observation): string {
  // Le prochain combat important, comme un joueur le garde en tête (« le rival arrive »).
  const c = obs.partie.prochainCombat;
  const quand = c.dans === 0 ? "maintenant" : c.dans === 1 ? "à la prochaine vague" : `dans ${c.dans} vagues`;
  const prochain = c.dans <= 3 ? ` · <span class="discret">${echapper(c.nom)} ${quand}</span>` : "";
  return `<div class="quoi">V${obs.partie.vague} · ${echapper(texteDecision(obs.decision, obs))}${prochain}</div>`;
}

/** Décisions laissées au pilote (récompenses, équipe pleine…) : son option recommandée en gros. */
function choixDuPilote(obs: Observation): string {
  const options = obs.decision.options ?? [];
  if (!options.length) {
    return enteteChoix(obs);
  }
  if (!options.some(o => o.note !== undefined)) {
    const liste = options
      .map(o => `<span class="puce">${echapper(o.nom)}${o.cout ? ` <span class="discret">${o.cout} ₽</span>` : ""}</span>`)
      .join("");
    return `${enteteChoix(obs)}<div>${liste}</div>`;
  }
  const triees = [...options].sort((a, b) => (b.note ?? 0) - (a.note ?? 0));
  const meilleure = triees.find(o => o.recommandee) ?? triees[0]!;
  const raisons = [
    ...(meilleure.pour ?? []).slice(0, 2).map(p => `<div class="pour">+ ${echapper(p)}</div>`),
    ...(meilleure.contre ?? []).slice(0, 2).map(c => `<div class="contre">− ${echapper(c)}</div>`),
  ].join("");
  const autres = triees
    .filter(o => o !== meilleure)
    .slice(0, 3)
    .map(o => `<div class="autre"><span>${echapper(o.nom)}</span><span></span><span class="num">${o.note}</span></div>`)
    .join("");
  return `
    ${enteteChoix(obs)}
    <div class="gros">▶ ${echapper(meilleure.nom)} <span class="note">note ${meilleure.note}</span></div>
    ${raisons}${autres}`;
}

// ─── Mémoire de l'extension (cerveau importé, réglages, position du panneau) ───────────────

type StockageChrome = { get(cle: string): Promise<Record<string, unknown>>; set(v: Record<string, unknown>): Promise<void> };
const stockageChrome = (globalThis as { chrome?: { storage?: { local?: StockageChrome } } }).chrome?.storage?.local;
/** Version de l'extension réellement chargée par le navigateur (« aperçu » hors extension). */
const VERSION_EXTENSION =
  (globalThis as { chrome?: { runtime?: { getManifest?(): { version: string } } } }).chrome?.runtime?.getManifest?.().version ?? "aperçu";
const memoire: Record<string, unknown> = {};

/** chrome.storage dans l'extension ; simple mémoire vive ailleurs (page d'aperçu). */
const stockage = {
  async lire<T>(cle: string): Promise<T | undefined> {
    return (stockageChrome ? (await stockageChrome.get(cle))[cle] : memoire[cle]) as T | undefined;
  },
  async ecrire(cle: string, valeur: unknown): Promise<void> {
    stockageChrome ? await stockageChrome.set({ [cle]: valeur }) : (memoire[cle] = valeur);
  },
};

function versBase64(tampon: ArrayBuffer): string {
  const octets = new Uint8Array(tampon);
  let texte = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    texte += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(texte);
}

function depuisBase64(base64: string): ArrayBuffer {
  const texte = atob(base64);
  const octets = new Uint8Array(texte.length);
  for (let i = 0; i < texte.length; i++) {
    octets[i] = texte.charCodeAt(i);
  }
  return octets.buffer;
}

// ─── Réflexion du cerveau ────────────────────────────────────────────────────────────────────

const VITESSES: Record<string, number> = { lente: 1500, normale: 700, rapide: 250 };
const NOMS_VITESSES: Record<string, string> = { lente: "LENT", normale: "NORMAL", rapide: "RAPIDE" };

/** Pourquoi ce cerveau ne peut pas lire les observations de cette version de l'extension. */
function incompatibilite(cerveau: Cerveau): string | null {
  const e = cerveau.entete;
  // Les encodages ne font qu'ajouter des nombres à la fin : un cerveau plus ancien (ex. la v2,
  // encodage v2) lit simplement le début de l'observation, qui n'a pas changé de sens.
  const lisible = e.versionEncodage <= VERSION_ENCODAGE && TAILLES_ENCODAGE[e.versionEncodage] === e.tailleEntree;
  if (!lisible || e.nombreActions !== NOMBRE_ACTIONS) {
    return `Ce cerveau (encodage v${e.versionEncodage}) est plus récent que l'extension ${VERSION_EXTENSION} `
      + `(encodage v${VERSION_ENCODAGE} au plus). Recharge l'extension dans brave://extensions (bouton ↻), `
      + `puis réimporte le cerveau.`;
  }
  return null;
}

/** Les nombres que ce cerveau sait lire : toute l'observation, ou son début pour un cerveau plus ancien. */
function entreeDe(cerveau: Cerveau, obs: Observation): Float32Array {
  return encoder(obs).subarray(0, cerveau.entete.tailleEntree);
}

function libelleAction(index: number, obs: Observation): string {
  const action = decrireAction(index);
  if (action.type === "envoyer") {
    return `Envoyer ${obs.equipe[action.place]?.nom ?? `la place ${action.place + 1}`}`;
  }
  if (action.type === "ball") {
    return `Lancer une ${PokeballType[action.ball]?.fr ?? "Ball"}`;
  }
  const acteur = obs.equipe.find(p => p.uid === obs.decision.acteur);
  const attaque = acteur?.attaques[action.attaque]?.nom ?? `attaque ${action.attaque + 1}`;
  // En double, deux adversaires peuvent porter le même nom : on précise leur place.
  const cible = obs.partie.double ? obs.adversaires.find(a => a.position === action.cible) : undefined;
  return cible ? `${attaque} → ${cible.nom} (${cible.position + 1})` : attaque;
}

/** Le choix du cerveau en gros, puis ses autres options les plus probables. */
function afficherReflexion(obs: Observation, reponse: Reponse, choisie: number): string {
  const pourcent = (p: number) => Math.round(p * 100);
  const p = reponse.probabilites[choisie] ?? 0;
  const autres = reponse.probabilites
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => i !== choisie && obs.decision.masque?.[i] && q >= 0.01)
    .sort((a, b) => b.q - a.q)
    .slice(0, 3)
    .map(({ q, i }) => `
      <div class="autre">
        <span>${echapper(libelleAction(i, obs))}</span>
        <div class="barre"><div style="width:${(q * 100).toFixed(1)}%;background:#c73625"></div></div>
        <span class="num">${pourcent(q)} %</span>
      </div>`)
    .join("");
  return `
    ${enteteChoix(obs)}
    <div class="gros">▶ ${echapper(libelleAction(choisie, obs))}</div>
    <div class="jauge"><div style="width:${(p * 100).toFixed(1)}%"></div><span>${pourcent(p)} %</span></div>
    ${autres}`;
}

// ─── Construction du panneau ──────────────────────────────────────────────────────────────────

function creerPanneau() {
  const hote = document.createElement("div");
  hote.id = "pokerogue-cerveau";
  const ombre = hote.attachShadow({ mode: "open" });
  ombre.innerHTML = `
    <style>${STYLE}</style>
    <div class="panneau">
      <div class="entete" title="Glisser pour déplacer">
        <span class="titre">CERVEAU</span>
        <span class="etat">en attente du jeu</span>
        <button class="replier" data-action="replier" tabindex="-1" title="Replier / déplier">–</button>
      </div>
      <div class="outils"></div>
      <div class="choix"></div>
      <div class="corps"><div class="observation"></div><div class="cerveau"></div></div>
      <input class="fichier" type="file" accept=".cerveau" tabindex="-1" hidden>
    </div>`;
  document.documentElement.appendChild(hote);
  const $ = <T extends Element>(selecteur: string) => ombre.querySelector<T>(selecteur)!;
  return {
    ombre,
    panneau: $<HTMLDivElement>(".panneau"),
    entete: $<HTMLDivElement>(".entete"),
    etat: $<HTMLSpanElement>(".etat"),
    replier: $<HTMLButtonElement>(".replier"),
    outils: $<HTMLDivElement>(".outils"),
    choix: $<HTMLDivElement>(".choix"),
    observation: $<HTMLDivElement>(".observation"),
    cerveau: $<HTMLDivElement>(".cerveau"),
    fichier: $<HTMLInputElement>(".fichier"),
  };
}

/** Ne remplace le contenu que s'il a changé (4 observations par seconde, survol préservé). */
function remplir(element: HTMLElement, html: string): void {
  if (element.dataset.html !== html) {
    element.dataset.html = html;
    element.innerHTML = html;
  }
}

/**
 * Le panneau ne garde jamais le focus : un clic ne le lui donne pas, et si quelque chose le
 * prend quand même (sélecteur de fichier…), on le rend aussitôt à la page. Les touches vont
 * ainsi toujours au jeu, qui les écoute sur la fenêtre.
 *
 * Même sans focus, Chrome fait défiler aux flèches la dernière zone cliquée : le panneau est
 * donc en « overflow: hidden » (impossible à défiler au clavier) et ne défile qu'à la molette.
 */
function refuserFocus(ui: ReturnType<typeof creerPanneau>): void {
  ui.panneau.addEventListener("mousedown", e => e.preventDefault());
  ui.ombre.addEventListener("focusin", e => (e.target as HTMLElement).blur());
  ui.panneau.addEventListener(
    "wheel",
    e => {
      ui.panneau.scrollTop += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 18 : e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
}

/** Le panneau se déplace en glissant son en-tête ; sa position est retenue. */
function rendreDeplacable(ui: ReturnType<typeof creerPanneau>): void {
  const placer = (x: number, y: number) => {
    const largeur = ui.panneau.offsetWidth;
    ui.panneau.style.left = `${Math.max(0, Math.min(window.innerWidth - largeur, x))}px`;
    ui.panneau.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, y))}px`;
    ui.panneau.style.right = "auto";
  };
  stockage.lire<{ x: number; y: number }>("position").then(p => p && placer(p.x, p.y));

  ui.entete.addEventListener("mousedown", (debut: MouseEvent) => {
    if ((debut.target as Element).closest("button")) {
      return;
    }
    const cadre = ui.panneau.getBoundingClientRect();
    const decalage = { x: debut.clientX - cadre.left, y: debut.clientY - cadre.top };
    const bouger = (e: MouseEvent) => placer(e.clientX - decalage.x, e.clientY - decalage.y);
    const lacher = () => {
      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", lacher);
      const fin = ui.panneau.getBoundingClientRect();
      stockage.ecrire("position", { x: fin.left, y: fin.top });
    };
    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", lacher);
  });
}

function demarrer(): void {
  const ui = creerPanneau();
  refuserFocus(ui);
  rendreDeplacable(ui);

  let cerveau: Cerveau | null = null;
  let derniereObservation: Observation | null = null;
  let derniereReponse: Reponse | null = null;
  let messageCerveau = "";
  let messagePilote = "";
  let horsPartie = "Lance une partie pour voir ce que le cerveau pense.";
  const reglages = { auto: false, vitesse: "normale" };
  const affichage = { replie: false, ouverts: [] as string[] };
  // Mode auto : décision déjà confiée au capteur, et actions refusées par le jeu pour elle.
  let cleEnvoyee = "";
  let actionEnvoyee = -1;
  let envoiDate = 0;
  const refusees = new Map<string, Set<number>>();

  const envoyer = (message: ContenuPanneau) =>
    window.postMessage({ source: SOURCE, origine: "panneau", ...message }, window.location.origin);
  const transmettrePilotage = () =>
    envoyer({ type: "pilotage", auto: reglages.auto && !!cerveau, delaiMs: VITESSES[reglages.vitesse] ?? 700 });

  function chargerCerveau(tampon: ArrayBuffer): string | null {
    try {
      const nouveau = lireCerveau(tampon);
      const probleme = incompatibilite(nouveau);
      if (probleme) {
        return probleme;
      }
      cerveau = nouveau;
      return null;
    } catch (erreur) {
      return erreur instanceof Error ? erreur.message : String(erreur);
    }
  }

  function afficherOutils(): void {
    const bouton = (action: string, texte: string, actif: boolean) =>
      `<button data-action="${action}" tabindex="-1"${actif ? ` class="actif"` : ""}>${texte}</button>`;
    const vitesses = reglages.auto
      ? `<span class="groupe" title="Rythme du mode auto">${Object.keys(VITESSES)
          .map(v => bouton(`vitesse:${v}`, NOMS_VITESSES[v]!, reglages.vitesse === v))
          .join("")}</span>`
      : "";
    remplir(ui.outils, `
      <span class="groupe">${bouton("mode:conseil", "CONSEIL", !reglages.auto)}${bouton("mode:auto", "AUTO", reglages.auto)}</span>
      ${vitesses}`);
  }

  function afficherCerveau(): void {
    let texte: string;
    if (cerveau) {
      const e = cerveau.entete;
      const date = new Date(e.creeLe).toLocaleDateString("fr-FR");
      const eval_ = e.evaluation ? ` · vague ${e.evaluation.vagueMoyenne} en moyenne au simulateur` : "";
      const valeur = derniereReponse
        ? `<div>Situation jugée : ${derniereReponse.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2, signDisplay: "always" })}
             <span class="discret" title="Plus c'est haut, plus il juge la situation favorable.">(ⓘ)</span></div>`
        : "";
      texte = `<div><span class="nom">${echapper(e.nom)}</span></div>
        <div class="discret" title="${echapper(e.description)}">${date} · ${e.entrainement.parties} parties d'entraînement${eval_}</div>
        ${e.poidsPlan ? `<div class="discret">Guidé par le planificateur (poids ${e.poidsPlan}) : un coup d'avance sur l'IA adverse.</div>` : ""}
        ${valeur}
        <div class="discret">Explication en phrases : à venir.</div>`;
    } else {
      texte = `<div class="discret">Aucun cerveau chargé (fichiers .cerveau dans /Volumes/Lexar/pokerogue-bot/cerveaux).</div>`;
    }
    const message = messageCerveau ? `<div class="alerte">${echapper(messageCerveau)}</div>` : "";
    const corps = `<div class="fiche">${texte}${message}<div style="margin-top:4px"><button data-action="importer" tabindex="-1">IMPORTER UN CERVEAU…</button></div>
      <div class="discret">Extension ${echapper(VERSION_EXTENSION)} · lit les cerveaux jusqu'à l'encodage v${VERSION_ENCODAGE}</div></div>`;
    remplir(ui.cerveau, section("cerveau", "CERVEAU", corps, new Set(affichage.ouverts)));
  }

  function afficherChoix(html: string): void {
    const pilote = reglages.auto && messagePilote ? `<div class="pilote">${echapper(messagePilote)}</div>` : "";
    remplir(ui.choix, html + pilote);
  }

  function mettreAJourReflexion(): void {
    const obs = derniereObservation;
    derniereReponse = null;
    if (!obs) {
      afficherChoix(`<div class="quoi">${echapper(horsPartie)}</div>`);
      afficherCerveau();
      return;
    }
    if (!obs.decision.masque) {
      afficherChoix(choixDuPilote(obs));
      afficherCerveau();
      return;
    }
    if (!cerveau) {
      afficherChoix(`${enteteChoix(obs)}
        <div class="gros">Aucun cerveau</div>
        ${messageCerveau ? `<div class="alerte">${echapper(messageCerveau)}</div>` : ""}
        <button data-action="importer" tabindex="-1">IMPORTER UN CERVEAU…</button>`);
      afficherCerveau();
      return;
    }
    const cle = cleDecision(obs);
    const interdites = refusees.get(cle) ?? new Set<number>();
    const masque = obs.decision.masque.map((permise, i) => permise && !interdites.has(i));
    const reponse = penser(cerveau, entreeDe(cerveau, obs), masque, planifier({ ...obs, decision: { ...obs.decision, masque } }));
    const choisie = meilleureAction(reponse);
    derniereReponse = reponse;
    afficherChoix(afficherReflexion({ ...obs, decision: { ...obs.decision, masque } }, reponse, choisie));
    afficherCerveau();

    const delai = VITESSES[reglages.vitesse] ?? 700;
    if (reglages.auto && cle === cleEnvoyee && Date.now() - envoiDate > delai + 3000) {
      // La même décision attend toujours bien après l'envoi : le jeu a refusé l'action sans le
      // dire. On l'interdit pour cette décision et le cerveau choisit autre chose.
      interdites.add(actionEnvoyee);
      refusees.set(cle, interdites);
      cleEnvoyee = "";
      mettreAJourReflexion();
      return;
    }
    if (reglages.auto && !obs.partie.quotidien && cle !== cleEnvoyee) {
      cleEnvoyee = cle;
      actionEnvoyee = choisie;
      envoiDate = Date.now();
      window.setTimeout(() => envoyer({ type: "action", cle, action: choisie }), delai);
    }
  }

  function afficherObservation(): void {
    if (derniereObservation) {
      remplir(ui.observation, duelEtDetails(derniereObservation, new Set(affichage.ouverts)));
    }
  }

  function appliquerReplie(): void {
    ui.panneau.classList.toggle("replie", affichage.replie);
    ui.replier.textContent = affichage.replie ? "+" : "–";
  }

  // Réglages et affichage retenus d'une fois sur l'autre.
  Promise.all([
    stockage.lire<string>("cerveau"),
    stockage.lire<typeof reglages>("reglages"),
    stockage.lire<typeof affichage>("affichage"),
  ]).then(([enregistre, r, a]) => {
    Object.assign(reglages, r);
    Object.assign(affichage, a);
    if (enregistre) {
      messageCerveau = chargerCerveau(depuisBase64(enregistre)) ?? "";
    }
    appliquerReplie();
    afficherOutils();
    afficherObservation();
    transmettrePilotage();
    mettreAJourReflexion();
  });
  afficherOutils();
  mettreAJourReflexion();

  // En mode auto, on revérifie chaque seconde même si l'écran ne change pas : c'est ainsi qu'on
  // repère une action refusée en silence (la même décision attend toujours).
  window.setInterval(() => {
    if (reglages.auto && cerveau && derniereObservation?.decision.masque) {
      mettreAJourReflexion();
    }
  }, 1000);

  const enregistrerReglages = () => {
    stockage.ecrire("reglages", reglages);
    afficherOutils();
    transmettrePilotage();
    mettreAJourReflexion();
  };

  // Tous les boutons du panneau, y compris ceux redessinés en continu.
  ui.ombre.addEventListener("click", (e: Event) => {
    const bouton = (e.target as Element).closest<HTMLElement>("[data-action]");
    const [action, valeur] = (bouton?.dataset.action ?? "").split(":");
    switch (action) {
      case "replier":
        affichage.replie = !affichage.replie;
        appliquerReplie();
        stockage.ecrire("affichage", affichage);
        return;
      case "importer":
        ui.fichier.click();
        return;
      case "mode":
        reglages.auto = valeur === "auto";
        messageCerveau = reglages.auto && !cerveau ? "Importe d'abord un cerveau : c'est lui qui joue les combats en mode auto." : "";
        cleEnvoyee = "";
        enregistrerReglages();
        return;
      case "vitesse":
        reglages.vitesse = valeur!;
        enregistrerReglages();
    }
  });

  // Sections repliables : on retient lesquelles sont ouvertes (« toggle » ne remonte pas,
  // d'où l'écoute en phase de capture).
  ui.ombre.addEventListener(
    "toggle",
    (e: Event) => {
      const details = e.target as HTMLDetailsElement;
      const cle = details.dataset.cle;
      if (!cle) {
        return;
      }
      const ouverts = new Set(affichage.ouverts);
      details.open ? ouverts.add(cle) : ouverts.delete(cle);
      affichage.ouverts = [...ouverts];
      stockage.ecrire("affichage", affichage);
    },
    true,
  );

  ui.fichier.addEventListener("change", async () => {
    const fichier = ui.fichier.files?.[0];
    if (!fichier) {
      return;
    }
    const tampon = await fichier.arrayBuffer();
    const probleme = chargerCerveau(tampon);
    messageCerveau = probleme ?? `« ${fichier.name} » importé.`;
    if (!probleme) {
      await stockage.ecrire("cerveau", versBase64(tampon));
    }
    ui.fichier.value = "";
    transmettrePilotage();
    mettreAJourReflexion();
  });

  window.addEventListener("message", (evenement: MessageEvent) => {
    if (evenement.source !== window || !estMessageCapteur(evenement.data)) {
      return;
    }
    const message: MessageCapteur = evenement.data;
    switch (message.type) {
      case "etat":
        ui.etat.className = "etat";
        ui.etat.textContent = message.etat === "attente-jeu" ? "attente du jeu" : "hors partie";
        if (!derniereObservation) {
          horsPartie = message.etat === "attente-jeu" ? "Le jeu se charge…" : "Lance une partie pour voir ce que le cerveau pense.";
          mettreAJourReflexion();
        }
        return;
      case "erreur":
        ui.etat.className = "etat erreur";
        ui.etat.textContent = "erreur";
        derniereObservation = null;
        horsPartie = `Le capteur n'arrive plus à lire le jeu (mise à jour ?) : ${message.message}`;
        remplir(ui.observation, "");
        mettreAJourReflexion();
        return;
      case "pilote":
        messagePilote = `Pilote : ${message.texte}`;
        if (message.texte === "Action refusée par le jeu" && derniereObservation) {
          // On retient le refus et on laisse le cerveau choisir autre chose.
          const cle = cleDecision(derniereObservation);
          const choisie = cleEnvoyee === cle ? derniereObservation : null;
          if (choisie) {
            const interdites = refusees.get(cle) ?? new Set<number>();
            const masqueChoisie = choisie.decision.masque!.map((p, i) => p && !interdites.has(i));
            const reponse = cerveau
              ? penser(cerveau, entreeDe(cerveau, choisie), masqueChoisie, planifier({ ...choisie, decision: { ...choisie.decision, masque: masqueChoisie } }))
              : null;
            if (reponse) {
              interdites.add(meilleureAction(reponse));
              refusees.set(cle, interdites);
            }
            cleEnvoyee = "";
          }
        }
        mettreAJourReflexion();
        return;
      case "observation": {
        ui.etat.className = "etat direct";
        ui.etat.textContent = reglages.auto && cerveau ? (message.observation.partie.quotidien ? "Daily : auto coupé" : "direct · auto") : "direct";
        const avant = derniereObservation ? JSON.stringify(derniereObservation) : "";
        derniereObservation = message.observation;
        // On ne recalcule que si quelque chose a changé (4 observations par seconde).
        if (JSON.stringify(message.observation) !== avant) {
          afficherObservation();
          mettreAJourReflexion();
        }
      }
    }
  });
}

demarrer();
