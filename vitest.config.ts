import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure lib/ logic only (parsing, normalization, prompt building,
// output verification). UI flows are verified manually in the browser.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
