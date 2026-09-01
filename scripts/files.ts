import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const ROOT = join(import.meta.dirname, "..");

const SKIPPED = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".stryker-tmp",
  "playwright-report",
  "test-results",
  "reports",
]);

/** Walks a directory recursively, returning file paths relative to the repo root. */
export function walk(directory: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (SKIPPED.has(entry)) continue;
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      found.push(...walk(fullPath, extensions));
    } else if (extensions.some((e) => entry.endsWith(e))) {
      found.push(relative(ROOT, fullPath).split(sep).join("/"));
    }
  }
  return found;
}

export function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/** Strips line and block comments so pattern searches do not match documentation. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function report(name: string, violations: readonly string[]): void {
  if (violations.length === 0) {
    process.stdout.write(`  OK   ${name}\n`);
    return;
  }
  process.stdout.write(`  FAIL ${name} — ${violations.length} violation(s)\n`);
  for (const line of violations) process.stdout.write(`         ${line}\n`);
}
