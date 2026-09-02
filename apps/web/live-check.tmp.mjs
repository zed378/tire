import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const BASE = "https://tire.zedth.my.id";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
page.on("requestfailed", (r) => { problems.push(`FAILED ${r.url()} — ${r.failure()?.errorText ?? "?"}`); });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("User ID").fill(process.env.CHECK_USER);
await page.getByLabel("Password").fill(process.env.CHECK_PASS);
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForTimeout(2500);

const code = page.getByLabel(/kode autentikasi/i).first();
if (await code.isVisible().catch(() => false)) {
  await code.fill(process.env.CHECK_TOTP);
  await page.getByRole("button", { name: /verifikasi/i }).first().click();
  await page.waitForTimeout(4000);
}
console.log("url after login =", page.url());
const alert = await page.getByRole("alert").first().textContent().catch(() => null);
if (alert) console.log("alert:", alert.trim().slice(0, 200));
await context.storageState({ path: `${OUT}/state.json` });

const ROUTES = [["welcome","/welcome"],["inspections","/inspections"],["qc","/qc"],["users","/users"],
  ["master-data","/master-data"],["patterns","/master-data/tire-brand-patterns"],["audit","/audit"],["reports","/reports"]];
for (const [name, path] of ROUTES) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  console.log(`${name.padEnd(14)} ${page.url().replace(BASE,"").padEnd(32)} h1="${(h1??"").trim().slice(0,40)}"`);
}
if (problems.length) { console.log("\nproblems:"); for (const p of [...new Set(problems)].slice(0,10)) console.log("  "+p); }
await browser.close();
