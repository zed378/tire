import { defineConfig } from "vitest/config";

// No React plugin here: the tests in this package cover pure client logic, and
// wiring the plugin in would couple the test config to the Vite major version
// for no benefit. Component tests, when they arrive, add it back.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});
