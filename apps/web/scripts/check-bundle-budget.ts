/**
 * CI gate G-12 (PLAN/09 §5, budget from PLAN/06 §7).
 *
 * The initial JavaScript must stay at or below 180 KB compressed. The reference
 * device is not a flagship: field workers carry mid-range phones two or three
 * years old, on 4G, and that is what the budget is measured against.
 *
 * WHAT "INITIAL" MEANS HERE: the scripts `dist/index.html` actually references —
 * the entry chunk and anything it preloads. Route chunks pulled in later by
 * `lazy()` are reported below the total but not counted, because nobody
 * downloads them on first paint and most users never download them at all.
 *
 * This used to sum every `.js` file in `dist/assets`, which had two
 * consequences. The headline figure was overstated, since the reporting chunk
 * has always been lazy. And splitting a route out of the entry bundle — the
 * single most effective way to come in under this budget — made the number go
 * UP, so the gate punished the fix for the problem it exists to detect.
 */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUDGET_BYTES = 180 * 1024;
const DIST = join(import.meta.dirname, "..", "dist");
const ASSETS = join(DIST, "assets");

function gzippedBytes(path: string): number {
  return gzipSync(readFileSync(path)).byteLength;
}

function allScripts(): string[] {
  try {
    return readdirSync(ASSETS)
      .map((entry) => join(ASSETS, entry))
      .filter((path) => statSync(path).isFile() && path.endsWith(".js"));
  } catch {
    return [];
  }
}

const scripts = allScripts();
if (scripts.length === 0) {
  process.stdout.write("No built assets found — run `pnpm build` first.\n");
  process.exit(0);
}

let html: string;
try {
  html = readFileSync(join(DIST, "index.html"), "utf8");
} catch {
  process.stdout.write("No dist/index.html found — run `pnpm build` first.\n");
  process.exit(0);
}

// Whatever the document itself pulls in: the entry `<script src>` plus any
// `<link rel="modulepreload">`. That is precisely the first-paint cost.
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="([^"]*\.js)"/g)].map(
    (match) => (match[1] ?? "").split("/").pop() ?? "",
  ),
);

const initial: { name: string; bytes: number }[] = [];
const deferred: { name: string; bytes: number }[] = [];

for (const path of scripts) {
  const name = path.split(/[\\/]+/).pop() ?? path;
  const entry = { name, bytes: gzippedBytes(path) };
  if (referenced.has(name)) initial.push(entry);
  else deferred.push(entry);
}

initial.sort((a, b) => b.bytes - a.bytes);
deferred.sort((a, b) => b.bytes - a.bytes);

const total = initial.reduce((sum, row) => sum + row.bytes, 0);

process.stdout.write("Initial JavaScript (gzipped)\n");
for (const row of initial) {
  process.stdout.write(`  ${(row.bytes / 1024).toFixed(1).padStart(7)} KB  ${row.name}\n`);
}

if (deferred.length > 0) {
  const deferredTotal = deferred.reduce((sum, row) => sum + row.bytes, 0);
  process.stdout.write(
    `\nLoaded on demand, not counted (${(deferredTotal / 1024).toFixed(1)} KB across ${String(
      deferred.length,
    )} chunks)\n`,
  );
  for (const row of deferred) {
    process.stdout.write(`  ${(row.bytes / 1024).toFixed(1).padStart(7)} KB  ${row.name}\n`);
  }
}

const kilobytes = (total / 1024).toFixed(1);
const budget = (BUDGET_BYTES / 1024).toFixed(0);

if (total > BUDGET_BYTES) {
  process.stdout.write(`\n  FAIL initial ${kilobytes} KB exceeds the ${budget} KB budget\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\n  OK   initial ${kilobytes} KB of the ${budget} KB budget\n`);
}
