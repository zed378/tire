import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests — CI gate G-11 (PLAN/09 §5).
 *
 * The QC flow is the one that crosses every module: a supplier submits, an admin
 * returns it for revision, the supplier sees the reason and resubmits, and the
 * admin passes it. A regression anywhere along that path is a regression in the
 * product, and no unit test spans it.
 *
 * The mobile viewport is not decoration. The application is used on phones in
 * garages, so that is the default profile.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer:
    process.env.E2E_BASE_URL === undefined
      ? { command: "pnpm dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 }
      : undefined,
});
