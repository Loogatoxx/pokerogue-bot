/**
 * Le panneau : tourne dans le monde isolé de l'extension et affiche, par-dessus le jeu,
 * ce que le cerveau voit (observation envoyée par le capteur) et ce qu'il en pense.
 *
 * - Bloc « Cerveau » (permanent) : import d'un fichier .cerveau, mode Conseil / Auto, vitesse,
 *   et sa réflexion en chiffres bruts (probabilité de chaque action permise).
 * - Bloc « observation » (redessiné quand la partie change) : partie, adversaires, équipe, carnet.
 *
 * Il vit dans un « Shadow DOM » : une bulle de page à part, pour que les styles du jeu
 * et ceux du panneau ne se mélangent pas.
 */
import { type Cerveau, lireCerveau, meilleureAction, penser, type Reponse } from "../../cerveau/cerveau";
import { decrireAction } from "../../observateur/actions";
import { encoder, TAILLE_OBSERVATION, VERSION_ENCODAGE } from "../../observateur/encodeur";
import { PokeballType, PokemonType } from "../../observateur/noms";
import {
  type Decision,
  type Libelle,
  type Observation,
  type PokemonAdverse,
  type PokemonAllie,
  VERSION_OBSERVATION,
} from "../../observateur/types";
import { type ContenuPanneau, cleDecision, estMessageCapteur, type MessageCapteur, SOURCE } from "./messages";

const LIBELLES_IVS = ["PV", "Att", "Déf", "AtS", "DéS", "Vit"];
const LIBELLES_MODIFS = ["Att", "Déf", "Att. Spé.", "Déf. Spé.", "Vit", "Préc.", "Esq."];
const COULEURS_TYPES: Readonly<Record<string, string>> = {
  NORMAL: "#A8A77A", FIRE: "#EE8130", WATER: "#6390F0", ELECTRIC: "#F7D02C", GRASS: "#7AC74C",
  ICE: "#96D9D6", FIGHTING: "#C22E28", POISON: "#A33EA1", GROUND: "#E2BF65", FLYING: "#A98FF3",
  PSYCHIC: "#F95587", BUG: "#A6B91A", ROCK: "#B6A136", GHOST: "#735797", DRAGON: "#6F35FC",
  DARK: "#705746", STEEL: "#B7B7CE", FAIRY: "#D685AD", STELLAR: "#40B5A5", UNKNOWN: "#68A090",
};

const STYLE = `
  :host { all: initial; }
  .panneau {
    position: fixed; top: 8px; right: 8px; z-index: 2147483647;
    width: 340px; max-height: calc(100vh - 16px); overflow-y: auto;
    background: rgba(18, 18, 30, 0.94); color: #eceaf6; border: 1px solid #4a4766;
    border-radius: 10px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    font: 12px/1.45 system-ui, -apple-system, sans-serif;
  }
  .entete {
    position: sticky; top: 0; display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; background: #26243d; border-bottom: 1px solid #4a4766;
  }
  .entete h1 { flex: 1; margin: 0; font-size: 13px; font-weight: 650; }
  .etat { font-size: 11px; color: #b9b6d3; }
  .etat.direct::before { content: "●"; color: #5fd38d; margin-right: 4px; }
  .etat.attente::before { content: "●"; color: #e3b341; margin-right: 4px; }
  .etat.erreur::before { content: "●"; color: #f06a6a; margin-right: 4px; }
  button.replier {
    all: unset; cursor: pointer; width: 22px; height: 22px; text-align: center;
    border-radius: 5px; background: #3a3757; color: #eceaf6; font-weight: 700;
  }
  button.replier:hover { background: #4d4973; }
  .replie .corps { display: none; }
  .corps { padding: 4px 10px 10px; }
  h2 {
    margin: 12px 0 6px; font-size: 11px; font-weight: 650; letter-spacing: 0.04em;
    text-transform: uppercase; color: #9d99c4;
  }
  .ligne { margin: 2px 0; }
  .discret { color: #9d99c4; }
  .carte { padding: 7px 8px; margin: 6px 0; background: #22203a; border-radius: 7px; border: 1px solid #34314f; }
  .carte.terrain { border-color: #7a72d8; }
  .carte.ko { opacity: 0.5; }
  .nom { font-weight: 650; }
  .type {
    display: inline-block; padding: 0 6px; margin-right: 3px; border-radius: 4px;
    font-size: 10px; font-weight: 700; color: #111; vertical-align: 1px;
  }
  .barre { height: 6px; margin: 4px 0; background: #3a3757; border-radius: 3px; overflow: hidden; }
  .barre > div { height: 100%; border-radius: 3px; }
  .puce { display: inline-block; padding: 0 6px; margin: 2px 3px 0 0; border-radius: 4px; background: #34314f; }
  .cache { margin-top: 5px; font-size: 11px; color: #7f7ba6; font-style: italic; }
  .journal { margin: 0; padding-left: 16px; }
  .journal li { margin: 1px 0; }
  .erreur-texte { color: #f06a6a; }
  .entete { cursor: move; user-select: none; }
  .bloc-cerveau { padding: 8px; margin: 8px 0 4px; background: #1c1a30; border: 1px solid #4a4766; border-radius: 8px; }
  .reglages { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; }
  .reglages label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; }
  select, .bouton-texte {
    font: inherit; color: #eceaf6; background: #3a3757; border: 1px solid #4a4766;
    border-radius: 5px; padding: 1px 6px; cursor: pointer;
  }
  .bouton-texte:hover { background: #4d4973; }
  .action { display: grid; grid-template-columns: 1fr 70px 38px; gap: 6px; align-items: center; margin: 2px 0; }
  .action .barre { margin: 0; }
  .action.choisie { font-weight: 700; }
  .pourcent { text-align: right; font-variant-numeric: tabular-nums; }
  .pour { color: #5fd38d; }
  .contre { color: #f0a06a; }
`;

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function puceType(type: Libelle): string {
  const couleur = COULEURS_TYPES[PokemonType[type.id]?.cle ?? "UNKNOWN"] ?? "#68A090";
  return `<span class="type" style="background:${couleur}">${echapper(type.nom)}</span>`;
}

function barrePv(pourcent: number): string {
  const couleur = pourcent > 50 ? "#5fd38d" : pourcent > 20 ? "#e3b341" : "#f06a6a";
  return `<div class="barre"><div style="width:${Math.max(0, Math.min(100, pourcent))}%;background:${couleur}"></div></div>`;
}

function modifsNonNulles(modifs: number[]): string {
  const textes = modifs
    .map((m, i) => (m === 0 ? "" : `${LIBELLES_MODIFS[i]} ${m > 0 ? "+" : "−"}${Math.abs(m)}`))
    .filter(Boolean);
  return textes.length ? `<div class="ligne">Modifs : ${textes.map(echapper).join(" · ")}</div>` : "";
}

function statut(s: Libelle): string {
  return s.id === 0 ? "" : ` · <b>${echapper(s.nom)}</b>`;
}

function carteAdversaire(a: PokemonAdverse): string {
  const boss = a.boss ? ` · boss ${a.boss.segmentsRestants}/${a.boss.segments} barres` : "";
  const talent = a.talentRevele ? echapper(a.talentRevele.nom) : `<span class="discret">? (pas encore affiché)</span>`;
  const attaques = a.attaquesVues.length
    ? a.attaquesVues.map(x => `<span class="puce">${echapper(x.nom)}</span>`).join("")
    : `<span class="discret">aucune pour l'instant</span>`;
  const objets = a.objets.length
    ? `<div class="ligne">Objets : ${a.objets.map(o => echapper(`${o.nom}${o.quantite > 1 ? ` ×${o.quantite}` : ""}`)).join(", ")}</div>`
    : "";
  return `
    <div class="carte${a.ko ? " ko" : ""}">
      <div><span class="nom">${echapper(a.nom)}</span> niv. ${a.niveau}${a.shiny ? " ✨" : ""}${a.dejaCapture ? ` <span class="discret" title="Déjà capturé">◓</span>` : ""} ${a.types.map(puceType).join("")}</div>
      ${barrePv(a.pvPourcent)}
      <div class="ligne">${a.pvPourcent} % des PV${statut(a.statut)}${boss}</div>
      <div class="ligne">Talent : ${talent}</div>
      <div class="ligne">Attaques vues : ${attaques}</div>
      ${objets}
      ${modifsNonNulles(a.modifStats)}
      <div class="cache">Caché au cerveau : IVs, nature, PV exacts, attaques pas encore utilisées.</div>
    </div>`;
}

function carteAllie(p: PokemonAllie): string {
  const attaques = p.attaques
    .map(x => `<span class="puce">${echapper(x.nom)} <span class="discret">${x.pp}/${x.ppMax}</span></span>`)
    .join("");
  const ivs = p.ivs.map((v, i) => `${LIBELLES_IVS[i]} ${v}`).join(" · ");
  const talent = echapper(p.talent.nom) + (p.passif ? ` + passif ${echapper(p.passif.nom)}` : "");
  const objets = p.objets.length
    ? `<div class="ligne">Objets : ${p.objets.map(o => echapper(`${o.nom}${o.quantite > 1 ? ` ×${o.quantite}` : ""}`)).join(", ")}</div>`
    : "";
  return `
    <div class="carte${p.surTerrain ? " terrain" : ""}${p.ko ? " ko" : ""}">
      <div>${p.surTerrain ? "▶ " : ""}<span class="nom">${echapper(p.nom)}</span> niv. ${p.niveau}${p.shiny ? " ✨" : ""} ${p.types.map(puceType).join("")}</div>
      ${barrePv((p.pv / Math.max(p.pvMax, 1)) * 100)}
      <div class="ligne">${p.pv}/${p.pvMax} PV${statut(p.statut)} · nature ${echapper(p.nature.nom)}</div>
      <div class="ligne discret">IVs : ${ivs}</div>
      <div class="ligne">Talent : ${talent}</div>
      <div class="ligne">${attaques}</div>
      ${objets}
      ${modifsNonNulles(p.modifStats)}
    </div>`;
}

function texteDecision(d: Decision, obs: Observation): string {
  const acteur = obs.equipe.find(p => p.uid === d.acteur)?.nom ?? "ton Pokémon";
  const textes: Record<Decision["type"], string> = {
    "equipe-depart": "Composer l'équipe de départ",
    combat: `Choisir l'action de ${acteur}`,
    cible: "Choisir la cible de l'attaque",
    bonus: "Choisir une récompense",
    remplacement: "Choisir le Pokémon à envoyer",
    "attaque-a-oublier": "Choisir l'attaque à oublier",
    biome: "Choisir le prochain biome",
    "rencontre-mystere": "Rencontre mystère : choisir une option",
    aucune: "Rien à décider pour l'instant (le jeu déroule le tour)",
  };
  const notees = d.options?.some(o => o.note !== undefined);
  const options = !d.options?.length
    ? ""
    : notees
      ? optionsNotees(d.options)
      : `<div class="ligne">${d.options
          .map(o => `<span class="puce">${echapper(o.nom)}${o.cout ? ` <span class="discret">${o.cout} ₽</span>` : ""}</span>`)
          .join("")}</div>`;
  return `<div class="ligne"><b>${echapper(textes[d.type])}</b> <span class="discret">(${echapper(d.phase)})</span></div>${options}`;
}

/** Options notées (attaque à oublier) : note de synergie, pour et contre, recommandation. */
function optionsNotees(options: NonNullable<Decision["options"]>): string {
  const lignes = [...options]
    .sort((a, b) => (b.note ?? 0) - (a.note ?? 0))
    .map(o => {
      const details = [
        ...(o.pour ?? []).map(p => `<div class="pour">+ ${echapper(p)}</div>`),
        ...(o.contre ?? []).map(c => `<div class="contre">− ${echapper(c)}</div>`),
      ].join("");
      return `
        <div class="carte${o.recommandee ? " terrain" : ""}">
          <div>${o.recommandee ? "▶ " : ""}<b>${echapper(o.nom)}</b> <span class="discret">· note ${o.note}</span></div>
          ${details}
        </div>`;
    })
    .join("");
  return `<div class="ligne discret">Note de synergie du jeu d'attaques complet (couverture des types,
    bonus de type, stats, précision, équipe, variété) :</div>${lignes}`;
}

function contenu(obs: Observation): string {
  const p = obs.partie;
  const dresseur = p.dresseur ? ` : ${echapper(p.dresseur.nom)} (${p.dresseur.pokemonRestants} Pokémon restants)` : "";
  const balls = p.balls.filter(b => b.quantite > 0).map(b => `${echapper(b.nom)} ×${b.quantite}`).join(" · ") || "aucune";
  const journal = obs.journal
    .slice(-10)
    .reverse()
    .map(e => `<li><span class="discret">V${e.vague}</span> ${echapper(e.texte)}</li>`)
    .join("");
  return `
    <h2>Partie</h2>
    <div class="ligne"><b>Vague ${p.vague}</b> · ${echapper(p.biome.nom)} · tour ${p.tour}${p.double ? " · combat double" : ""}</div>
    <div class="ligne">Combat ${echapper(p.typeCombat.nom)}${dresseur}</div>
    <div class="ligne">Météo : ${echapper(p.meteo.nom)} · Terrain : ${echapper(p.terrain.nom)} · ${p.argent.toLocaleString("fr-FR")} ₽</div>
    <div class="ligne">Balls : ${balls}</div>
    <h2>Décision attendue</h2>
    ${texteDecision(obs.decision, obs)}
    <h2>Adversaire${obs.adversaires.length > 1 ? "s" : ""}</h2>
    ${obs.adversaires.map(carteAdversaire).join("") || `<div class="discret">Personne sur le terrain.</div>`}
    <h2>Mon équipe</h2>
    ${obs.equipe.map(carteAllie).join("")}
    <h2>Carnet (mémoire de la partie)</h2>
    <ol class="journal" reversed>${journal}</ol>`;
}

// ─── Mémoire de l'extension (cerveau importé, réglages, position du panneau) ───────────────

type StockageChrome = { get(cle: string): Promise<Record<string, unknown>>; set(v: Record<string, unknown>): Promise<void> };
const stockageChrome = (globalThis as { chrome?: { storage?: { local?: StockageChrome } } }).chrome?.storage?.local;
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

/** Pourquoi ce cerveau ne peut pas lire les observations de cette version de l'extension. */
function incompatibilite(cerveau: Cerveau): string | null {
  const e = cerveau.entete;
  if (e.versionObservation !== VERSION_OBSERVATION || e.versionEncodage !== VERSION_ENCODAGE || e.tailleEntree !== TAILLE_OBSERVATION) {
    return `Ce cerveau a appris avec une autre version des observations (obs. v${e.versionObservation}, `
      + `encodage v${e.versionEncodage}) que l'extension (obs. v${VERSION_OBSERVATION}, encodage v${VERSION_ENCODAGE}).`;
  }
  return null;
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

function afficherReflexion(obs: Observation, reponse: Reponse, choisie: number): string {
  const lignes = reponse.probabilites
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => obs.decision.masque?.[i])
    .sort((a, b) => b.p - a.p)
    .map(({ p, i }) => `
      <div class="action${i === choisie ? " choisie" : ""}">
        <span>${i === choisie ? "▶ " : ""}${echapper(libelleAction(i, obs))}</span>
        <div class="barre"><div style="width:${(p * 100).toFixed(1)}%;background:#8b7cf6"></div></div>
        <span class="pourcent">${Math.round(p * 100)} %</span>
      </div>`)
    .join("");
  const valeur = reponse.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2, signDisplay: "always" });
  return `
    <div class="ligne discret">Ce qu'il pense (chiffres bruts) :</div>
    ${lignes}
    <div class="ligne discret">Valeur estimée de la situation : ${valeur}
      <span title="Plus c'est haut, plus il juge la situation favorable. Un cerveau non entraîné donne des valeurs sans signification.">ⓘ</span></div>
    <div class="ligne discret">Explication en phrases : à venir (étape 6).</div>`;
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
        <h1>🧠 Ce que le cerveau voit</h1>
        <span class="etat attente">en attente du jeu</span>
        <button class="replier" title="Replier / déplier">–</button>
      </div>
      <div class="corps">
        <div class="bloc-cerveau">
          <div class="ligne"><b>Cerveau :</b> <span class="nom-cerveau discret">aucun chargé</span></div>
          <div class="reglages">
            <button class="bouton-texte importer">Importer un cerveau…</button>
            <input class="fichier" type="file" accept=".cerveau" hidden>
            <label><input type="radio" name="mode" value="conseil" checked> Conseil</label>
            <label><input type="radio" name="mode" value="auto"> Auto</label>
            <select class="vitesse" title="Rythme du mode auto">
              <option value="lente">Lente</option>
              <option value="normale" selected>Normale</option>
              <option value="rapide">Rapide</option>
            </select>
          </div>
          <div class="message-cerveau ligne discret"></div>
          <div class="reflexion"></div>
          <div class="pilote ligne discret"></div>
        </div>
        <div class="observation"><div class="discret">Lance une partie pour voir apparaître l'observation.</div></div>
      </div>
    </div>`;
  document.documentElement.appendChild(hote);
  const $ = <T extends Element>(selecteur: string) => ombre.querySelector<T>(selecteur)!;
  return {
    ombre,
    panneau: $<HTMLDivElement>(".panneau"),
    entete: $<HTMLDivElement>(".entete"),
    etat: $<HTMLSpanElement>(".etat"),
    replier: $<HTMLButtonElement>(".replier"),
    observation: $<HTMLDivElement>(".observation"),
    nomCerveau: $<HTMLSpanElement>(".nom-cerveau"),
    importer: $<HTMLButtonElement>(".importer"),
    fichier: $<HTMLInputElement>(".fichier"),
    modes: [...ombre.querySelectorAll<HTMLInputElement>('input[name="mode"]')],
    vitesse: $<HTMLSelectElement>(".vitesse"),
    messageCerveau: $<HTMLDivElement>(".message-cerveau"),
    reflexion: $<HTMLDivElement>(".reflexion"),
    pilote: $<HTMLDivElement>(".pilote"),
  };
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
    debut.preventDefault();
  });
}

function demarrer(): void {
  const ui = creerPanneau();
  rendreDeplacable(ui);

  let cerveau: Cerveau | null = null;
  let derniereObservation: Observation | null = null;
  let dernierHtml = "";
  const reglages = { auto: false, vitesse: "normale" };
  // Mode auto : décision déjà confiée au capteur, et actions refusées par le jeu pour elle.
  let cleEnvoyee = "";
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
      const e = nouveau.entete;
      const date = new Date(e.creeLe).toLocaleDateString("fr-FR");
      const eval_ = e.evaluation ? ` · vague ${e.evaluation.vagueMoyenne} en moyenne au simulateur` : "";
      ui.nomCerveau.textContent = `${e.nom} (${date}, ${e.entrainement.parties} parties d'entraînement${eval_})`;
      ui.nomCerveau.classList.remove("discret");
      ui.nomCerveau.title = e.description;
      return null;
    } catch (erreur) {
      return erreur instanceof Error ? erreur.message : String(erreur);
    }
  }

  function mettreAJourReflexion(): void {
    const obs = derniereObservation;
    if (!cerveau) {
      ui.reflexion.innerHTML = `<div class="ligne discret">Importe un fichier .cerveau (dans /Volumes/Lexar/pokerogue-bot/cerveaux) pour voir ce qu'il pense.</div>`;
      return;
    }
    if (!obs?.decision.masque) {
      ui.reflexion.innerHTML = `<div class="ligne discret">Rien à décider pour lui en ce moment : ${
        reglages.auto ? "le pilote gère le reste (messages, récompenses…) par des règles simples." : "il attend un combat."
      }</div>`;
      return;
    }
    const cle = cleDecision(obs);
    const interdites = refusees.get(cle) ?? new Set<number>();
    const masque = obs.decision.masque.map((permise, i) => permise && !interdites.has(i));
    const reponse = penser(cerveau, encoder(obs), masque);
    const choisie = meilleureAction(reponse);
    ui.reflexion.innerHTML = afficherReflexion({ ...obs, decision: { ...obs.decision, masque } }, reponse, choisie);

    if (reglages.auto && !obs.partie.quotidien && cle !== cleEnvoyee) {
      cleEnvoyee = cle;
      const delai = VITESSES[reglages.vitesse] ?? 700;
      window.setTimeout(() => envoyer({ type: "action", cle, action: choisie }), delai);
    }
  }

  // Réglages retenus d'une fois sur l'autre.
  Promise.all([stockage.lire<string>("cerveau"), stockage.lire<typeof reglages>("reglages")]).then(([enregistre, r]) => {
    if (r) {
      Object.assign(reglages, r);
      ui.modes.forEach(m => (m.checked = m.value === (reglages.auto ? "auto" : "conseil")));
      ui.vitesse.value = reglages.vitesse;
    }
    if (enregistre) {
      const probleme = chargerCerveau(depuisBase64(enregistre));
      ui.messageCerveau.textContent = probleme ?? "";
    }
    transmettrePilotage();
    mettreAJourReflexion();
  });

  ui.replier.addEventListener("click", () => {
    ui.panneau.classList.toggle("replie");
    ui.replier.textContent = ui.panneau.classList.contains("replie") ? "+" : "–";
  });
  ui.importer.addEventListener("click", () => ui.fichier.click());
  ui.fichier.addEventListener("change", async () => {
    const fichier = ui.fichier.files?.[0];
    if (!fichier) {
      return;
    }
    const tampon = await fichier.arrayBuffer();
    const probleme = chargerCerveau(tampon);
    ui.messageCerveau.textContent = probleme ?? `« ${fichier.name} » importé.`;
    if (!probleme) {
      await stockage.ecrire("cerveau", versBase64(tampon));
    }
    ui.fichier.value = "";
    transmettrePilotage();
    mettreAJourReflexion();
  });
  const enregistrerReglages = () => {
    stockage.ecrire("reglages", reglages);
    transmettrePilotage();
    mettreAJourReflexion();
  };
  ui.modes.forEach(m =>
    m.addEventListener("change", () => {
      reglages.auto = m.value === "auto" && m.checked;
      if (reglages.auto && !cerveau) {
        ui.messageCerveau.textContent = "Importe d'abord un cerveau : c'est lui qui joue les combats en mode auto.";
      }
      cleEnvoyee = "";
      enregistrerReglages();
    }),
  );
  ui.vitesse.addEventListener("change", () => {
    reglages.vitesse = ui.vitesse.value;
    enregistrerReglages();
  });

  window.addEventListener("message", (evenement: MessageEvent) => {
    if (evenement.source !== window || !estMessageCapteur(evenement.data)) {
      return;
    }
    const message: MessageCapteur = evenement.data;
    switch (message.type) {
      case "etat":
        ui.etat.className = "etat attente";
        ui.etat.textContent = message.etat === "attente-jeu" ? "en attente du jeu" : "hors partie";
        return;
      case "erreur":
        ui.etat.className = "etat erreur";
        ui.etat.textContent = "erreur de lecture";
        ui.observation.innerHTML = `<div class="erreur-texte">Le capteur n'arrive plus à lire le jeu (mise à jour ?) :<br>${echapper(message.message)}</div>`;
        return;
      case "pilote":
        ui.pilote.textContent = `Pilote : ${message.texte}`;
        if (message.texte === "Action refusée par le jeu" && derniereObservation) {
          // On retient le refus et on laisse le cerveau choisir autre chose.
          const cle = cleDecision(derniereObservation);
          const choisie = cleEnvoyee === cle ? derniereObservation : null;
          if (choisie) {
            const interdites = refusees.get(cle) ?? new Set<number>();
            const reponse = cerveau ? penser(cerveau, encoder(choisie), choisie.decision.masque!.map((p, i) => p && !interdites.has(i))) : null;
            if (reponse) {
              interdites.add(meilleureAction(reponse));
              refusees.set(cle, interdites);
            }
            cleEnvoyee = "";
          }
        }
        return;
      case "observation": {
        ui.etat.className = "etat direct";
        ui.etat.textContent = reglages.auto && cerveau ? (message.observation.partie.quotidien ? "Daily Run : auto coupé" : "en direct · auto") : "en direct";
        derniereObservation = message.observation;
        // On ne redessine que si quelque chose a changé (4 observations par seconde).
        const html = contenu(message.observation);
        if (html !== dernierHtml) {
          dernierHtml = html;
          ui.observation.innerHTML = html;
          mettreAJourReflexion();
        }
      }
    }
  });
}

demarrer();
