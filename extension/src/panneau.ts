/**
 * Le panneau : tourne dans le monde isolé de l'extension et affiche, par-dessus le jeu,
 * ce que le cerveau voit (observation envoyée par le capteur).
 *
 * Il vit dans un « Shadow DOM » : une bulle de page à part, pour que les styles du jeu
 * et ceux du panneau ne se mélangent pas.
 */
import { PokemonType } from "../../observateur/noms";
import type { Decision, Libelle, Observation, PokemonAdverse, PokemonAllie } from "../../observateur/types";
import { estMessageCapteur, type MessageCapteur } from "./messages";

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
  button {
    all: unset; cursor: pointer; width: 22px; height: 22px; text-align: center;
    border-radius: 5px; background: #3a3757; color: #eceaf6; font-weight: 700;
  }
  button:hover { background: #4d4973; }
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
      <div><span class="nom">${echapper(a.nom)}</span> niv. ${a.niveau}${a.shiny ? " ✨" : ""} ${a.types.map(puceType).join("")}</div>
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
  const options = d.options?.length
    ? `<div class="ligne">${d.options
        .map(o => `<span class="puce">${echapper(o.nom)}${o.cout ? ` <span class="discret">${o.cout} ₽</span>` : ""}</span>`)
        .join("")}</div>`
    : "";
  return `<div class="ligne"><b>${echapper(textes[d.type])}</b> <span class="discret">(${echapper(d.phase)})</span></div>${options}`;
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
    <ol class="journal" reversed>${journal}</ol>
    <h2>Cerveau</h2>
    <div class="discret">Aucun cerveau chargé : l'import arrive à l'étape 2.</div>`;
}

function creerPanneau() {
  const hote = document.createElement("div");
  hote.id = "pokerogue-cerveau";
  const ombre = hote.attachShadow({ mode: "open" });
  ombre.innerHTML = `
    <style>${STYLE}</style>
    <div class="panneau">
      <div class="entete">
        <h1>🧠 Ce que le cerveau voit</h1>
        <span class="etat attente">en attente du jeu</span>
        <button title="Replier / déplier">–</button>
      </div>
      <div class="corps"><div class="discret">Lance une partie pour voir apparaître l'observation.</div></div>
    </div>`;
  document.documentElement.appendChild(hote);

  const panneau = ombre.querySelector<HTMLDivElement>(".panneau")!;
  const etat = ombre.querySelector<HTMLSpanElement>(".etat")!;
  const corps = ombre.querySelector<HTMLDivElement>(".corps")!;
  const bouton = ombre.querySelector<HTMLButtonElement>("button")!;
  bouton.addEventListener("click", () => {
    panneau.classList.toggle("replie");
    bouton.textContent = panneau.classList.contains("replie") ? "+" : "–";
  });

  return {
    etat(classe: "direct" | "attente" | "erreur", texte: string) {
      etat.className = `etat ${classe}`;
      etat.textContent = texte;
    },
    corps(html: string) {
      corps.innerHTML = html;
    },
  };
}

function demarrer(): void {
  const panneau = creerPanneau();
  let dernier = "";

  window.addEventListener("message", (evenement: MessageEvent) => {
    if (evenement.source !== window || !estMessageCapteur(evenement.data)) {
      return;
    }
    const message: MessageCapteur = evenement.data;
    switch (message.type) {
      case "etat":
        panneau.etat("attente", message.etat === "attente-jeu" ? "en attente du jeu" : "hors partie");
        return;
      case "erreur":
        panneau.etat("erreur", "erreur de lecture");
        panneau.corps(`<div class="erreur-texte">Le capteur n'arrive plus à lire le jeu (mise à jour ?) :<br>${echapper(message.message)}</div>`);
        return;
      case "observation": {
        panneau.etat("direct", "en direct");
        // On ne redessine que si quelque chose a changé (4 observations par seconde).
        const html = contenu(message.observation);
        if (html !== dernier) {
          dernier = html;
          panneau.corps(html);
        }
      }
    }
  });
}

demarrer();
