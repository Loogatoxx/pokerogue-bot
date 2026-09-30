// Nos tests à nous (dossier tests/) ; ceux du jeu tournent dans jeu/ avec sa propre configuration.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["jeu/**", "node_modules/**"],
  },
});
