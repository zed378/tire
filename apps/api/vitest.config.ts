import { defineConfig } from "vitest/config";

/**
 * Coverage thresholds ARE gates G-05 and G-06 (PLAN/09 §5). They live here so
 * `pnpm test:coverage` fails locally for the same reason CI fails, rather than
 * only being discovered after a push.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/generated/**",
        "src/**/*.test.ts",
        "src/server.ts",
        "src/worker.ts",
        "src/**/routes.ts",
      ],
      thresholds: {
        // G-06: overall lines across the API.
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,

        // G-05 (100% branch coverage on the axle engine) is asserted in
        // packages/contracts, where the engine lives — see the note at the top
        // of packages/contracts/src/axle/derive.ts for why it sits there.
        // `src/kernel/axle` here is the server's entry point onto it and holds
        // no branching logic of its own.
        "src/kernel/axle/**": {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 90,
        },
      },
    },
  },
});
