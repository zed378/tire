import { chromium } from "@playwright/test";
import { createServer } from "vite";

const server = await createServer({ root: process.cwd(), server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch();
const out = process.env.SHOT_DIR;

for (const [route, name, width, height] of [
  ["/login", "login", 1440, 900],
  ["/register", "register", 1440, 1000],
  ["/login", "login-mobile", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`http://localhost:5199${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  if (name === "register") {
    await page.fill("#password", "kata sandi yang panjang sekali");
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${name}: ${errs.length} page errors ${errs.join(" | ")}`);
  await page.close();
}
await browser.close();
await server.close();
