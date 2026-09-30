/**
 * Construit l'extension dans extension/dist/ : c'est ce dossier qu'on charge dans Brave
 * (brave://extensions → Mode développeur → Charger l'extension non empaquetée).
 *
 * esbuild regroupe chaque script et ses imports (observateur compris) en un seul fichier,
 * car une extension ne peut pas charger nos fichiers TypeScript directement.
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const dist = join(ici, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: { capteur: join(ici, "src/capteur.ts"), panneau: join(ici, "src/panneau.ts") },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  charset: "utf8",
  logLevel: "info",
});
copyFileSync(join(ici, "manifest.json"), join(dist, "manifest.json"));
console.log(`Extension prête dans ${dist}`);
