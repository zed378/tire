/**
 * Largest Contentful Paint on the reference device (brief PART IX).
 *
 * `PLAN/00` §4 names the audience: field workers on mid-range phones, two or
 * three years old, on 4G, often in a garage with one bar. `check-bundle-budget`
 * guards how much they have to download; this guards how long they wait to see
 * something. The budget is 2.5 seconds, the "good" threshold for LCP.
 *
 * This is a measurement, not a CI gate. Network emulation on a shared runner is
 * noisy enough that a hard threshold would fail for reasons that have nothing
 * to do with the page, and a flaky gate is one people learn to re-run rather
 * than read. It is run when the answer matters and its number is written into
 * `docs/redesign-report.md`.
 *
 * It measures the PRODUCTION build served by `vite preview`. Measuring the dev
 * server would report the cost of unbundled ES modules over HTTP, which nobody
 * ever pays.
 *
 *     pnpm --filter @c26/web build
 *     pnpm --filter @c26/web preview &
 *     pnpm --filter @c26/web measure:lcp
 */
import { chromium, devices } from "@playwright/test";

/**
 * Lighthouse's mobile throttling profile, so the number is comparable to the
 * one a Lighthouse report would give: 1.6 Mbit/s down, 750 Kbit/s up, 150ms
 * round trip, and the CPU slowed fourfold.
 */
const THROTTLE = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const CPU_SLOWDOWN = 4;

const ROUTES = ["/", "/login", "/register"];

const baseUrl = process.env.LCP_BASE_URL ?? "http://127.0.0.1:4173";

interface Measurement {
  /** Milliseconds from navigation to the largest contentful paint. */
  lcpMs: number;
  /** What actually painted last, so a slow page names its own bottleneck. */
  element: string;
}

async function measure(path: string): Promise<Measurement> {
  const browser = await chromium.launch();
  // The reference device, not a desktop with the window made narrow.
  const context = await browser.newContext(devices["Pixel 5"]);
  const page = await context.newPage();

  const session = await context.newCDPSession(page);
  await session.send("Network.emulateNetworkConditions", THROTTLE);
  await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

  // The session bootstrap has no server here. Answering it the way a signed-out
  // visitor is answered keeps the measurement about the page rather than about
  // a request that hangs until it times out.
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "SESSION_EXPIRED",
        message: "Sesi Anda telah berakhir. Silakan masuk kembali.",
        requestId: "req_lcp_probe",
      }),
    });
  });

  await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });

  const measurement = await page.evaluate(
    () =>
      new Promise<{ lcpMs: number; element: string }>((resolve) => {
        let lcpMs = 0;
        let element = "unknown";

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            lcpMs = entry.startTime;
            const node = (entry as LargestContentfulPaint).element;
            element =
              node === null
                ? "text node"
                : `${node.tagName.toLowerCase()}${node.className === "" ? "" : `.${String(node.className).split(" ")[0]}`}`;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });

        // LCP is only final once the page stops changing. Two seconds of quiet
        // after load is enough for a page whose whole entrance is 300ms.
        setTimeout(() => {
          resolve({ lcpMs, element });
        }, 2000);
      }),
  );

  await browser.close();
  return measurement;
}

const BUDGET_MS = 2500;

/**
 * Three runs per route, and the middle one is reported.
 *
 * Emulated throttling on a machine that is also doing other things is noisy —
 * the same page measured twice in a row has come back at 3.6s and at 9.5s. A
 * single sample would make this tool a random number generator with a budget
 * attached. The median of three is not a benchmark either, but it is stable
 * enough to tell a regression from a busy laptop.
 */
const RUNS = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

let worst = 0;
for (const route of ROUTES) {
  const samples: number[] = [];
  let element = "unknown";

  for (let run = 0; run < RUNS; run += 1) {
    const measurement = await measure(route);
    samples.push(measurement.lcpMs);
    element = measurement.element;
  }

  const lcpMs = median(samples);
  worst = Math.max(worst, lcpMs);
  const verdict = lcpMs <= BUDGET_MS ? "OK  " : "OVER";
  const spread = samples.map((value) => (value / 1000).toFixed(2)).join(" ");
  console.log(
    `  ${verdict}  ${(lcpMs / 1000).toFixed(2)}s  ${route.padEnd(10)} ${element.padEnd(14)} [${spread}]`,
  );
}

console.log(
  `\n${worst <= BUDGET_MS ? "OK" : "OVER"}   worst LCP ${(worst / 1000).toFixed(2)}s of the ${String(
    BUDGET_MS / 1000,
  )}s budget, Lighthouse mobile throttling`,
);
