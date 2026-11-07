import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // Decision 3 in docs/architecture.md: every line and branch of the training rules is tested.
      include: ["src/engine/**/*.ts"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
      reporter: ["text", "text-summary"],
    },
  },
});
