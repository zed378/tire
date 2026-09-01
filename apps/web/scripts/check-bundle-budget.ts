/**
 * CI gate G-12 (PLAN/09 §5, budget from PLAN/06 §7).
 *
 * The initial JavaScript must stay at or below 180 KB compressed. The reference
 * device is not a flagship: field workers carry mid-range phones two or three
 * years old, on 4G, and that is what the budget is measured against.
 *
 * A warning rather than a blocker. A slow PWA on 4G is a real cost, but it does
 * not justify blocking a correctness fix.
 */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUDGET_BYTES = 180 * 1024;
const DIST = join(import.meta.dirname, "..", "dist", "assets");

function collect(directory: string, extension: string): string[] {
  try {
    return readdirSync(directory)
      .map((entry) => join(directory, entry))
      .filter((path) => statSync(path).isFile() && path.endsWith(extension));
  } catch {
    return [];
  }
}

const scripts = collect(DIST, ".js");
if (scripts.length === 0) {
  process.stdout.write("No built assets found — run `pnpm build` first.\n");
  process.exit(0);
}

let total = 0;
const rows: { name: string; bytes: number }[] = [];

for (const path of scripts) {
  const bytes = gzipSync(readFileSync(path)).byteLength;
  total += bytes;
  rows.push({ name: path.split(/[\\/]+/).pop() ?? path, bytes });
}

rows.sort((a, b) => b.bytes - a.bytes);

process.stdout.write("Client bundle budget (gzipped)\n");
for (const row of rows) {
  process.stdout.write(`  ${(row.bytes / 1024).toFixed(1).padStart(7)} KB  ${row.name}\n`);
}

const kilobytes = (total / 1024).toFixed(1);
const budget = (BUDGET_BYTES / 1024).toFixed(0);

if (total > BUDGET_BYTES) {
  process.stdout.write(`\n  WARN total ${kilobytes} KB exceeds the ${budget} KB budget\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\n  OK   total ${kilobytes} KB of the ${budget} KB budget\n`);
}
