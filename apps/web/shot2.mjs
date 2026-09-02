import { chromium } from "@playwright/test";
import { createServer } from "vite";
const server = await createServer({ root: process.cwd(), server: { port: 5198 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5198/login", { waitUntil: "networkidle" });
await page.click("#password");
await page.waitForTimeout(500);
const card = await page.locator("form").boundingBox();
await page.screenshot({
  path: `${process.env.SHOT_DIR}/login-focus.png`,
  clip: { x: card.x - 20, y: card.y - 20, width: card.width + 40, height: card.height + 40 },
});
await browser.close();
await server.close();
