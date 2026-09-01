import { defineConfig } from "vitest/config";

/**
 * Gate G-05 (PLAN/09 §5) lives here, because the axle engine lives here — see
 * the note at the top of src/axle/derive.ts for why it is in the shared package
 * rather than in apps/api: PLAN/06 §2 needs photo slots generated on the device
 * while offline.
 *
 * 100% branch coverage is not a vanity number for this module. The engine has no
 * natural feedback loop: a wrong result on a rare 6-axle configuration surfaces
 * months later, as hundreds of inspections with mislabelled photographs.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,

        // G-05
        "src/axle/**": {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100,
        },
      },
    },
  },
});
