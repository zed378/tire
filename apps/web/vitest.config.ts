import { defineConfig } from "vitest/config";

// No React plugin here: the tests in this package cover pure client logic, and
// wiring the plugin in would couple the test config to the Vite major version
// for no benefit. Component tests, when they arrive, add it back.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      /*
       * ── WHY THERE IS NO GLOBAL THRESHOLD ────────────────────────────────
       * Most of this package is React screens, and their behaviour is observed
       * by the accessibility and flow sweeps in `e2e/` — twenty-four screens in
       * both themes, their empty states, their dialogs, and their error
       * channels. A global line threshold here would either be a number so low
       * it gates nothing, or it would push somebody to write shallow render
       * tests for coverage rather than for correctness, which is the shape of
       * test `PLAN/09` §7 warns about.
       *
       * `src/lib/**` is different: it is the client's pure logic — the API
       * envelope, the three error channels, the session's "nobody" versus
       * "could not ask", the upload queue's quota arithmetic. All of it is unit
       * testable and none of it is observable from a screenshot, so it gets a
       * real gate.
       *
       * A ratchet, like the API's. Raise it, never lower it, and never by
       * narrowing what it measures.
       */
      thresholds: {
        /*
         * The direct children only. `src/lib/photo/**` is deliberately outside
         * it: compressing an image needs a canvas and the queue needs
         * IndexedDB, neither of which jsdom provides, so those two are covered
         * by the browser sweep instead. The part of the queue that is pure —
         * the quota arithmetic in `upload-queue.ts` — is unit tested regardless.
         */
        "src/lib/*.{ts,tsx}": {
          lines: 74,
          statements: 74,
          functions: 80,
          branches: 90,
        },
      },
    },
  },
});
