import { chromium } from "@playwright/test";
import { createServer } from "vite";

const server = await createServer({ root: process.cwd(), server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch();
const out = process.env.SHOT_DIR;

for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/landing-${name}.png`, fullPage: true });
  console.log(`${name}: ${errors.length} console errors`);
  for (const e of errors.slice(0, 5)) console.log("   " + e);
  await page.close();
}

await browser.close();
await server.close();
