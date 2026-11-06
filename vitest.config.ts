import { defineConfig } from "vitest/config";
import path from "node:path";

// Vaste tijdzone, zodat UTC → lokale-tijd-tests overal hetzelfde uitkomen
process.env.TZ = "Europe/Amsterdam";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["tests/**/*.test.ts"] },
});
