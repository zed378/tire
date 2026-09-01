/**
 * CI gates G-03 and G-10 (PLAN/09 §5).
 *
 * G-03 — `alert(`, `confirm(`, `prompt(` must return zero hits across the source
 *        tree. Closes D-08: the defect this rewrite exists to fix must not
 *        re-enter the new system.
 * G-10 — demo login panels and hardcoded credentials must return zero hits.
 *        Closes D-16: three buttons that logged in without any credentials.
 */
import { join } from "node:path";
import { read, report, ROOT, stripComments, walk } from "./files.ts";

const SOURCE_ROOTS = [join(ROOT, "apps"), join(ROOT, "packages")];
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".html"] as const;

const sourceFiles = SOURCE_ROOTS.flatMap((dir) => walk(dir, EXTENSIONS)).filter(
  (file) => !file.includes("/__tests__/") && !/\.test\.tsx?$/.test(file),
);

// ── G-03 ─────────────────────────────────────────────────────────────────────
const DIALOG_PATTERNS = [
  { name: "alert(", regex: /(^|[^.\w$])alert\s*\(/ },
  { name: "confirm(", regex: /(^|[^.\w$])confirm\s*\(/ },
  { name: "prompt(", regex: /(^|[^.\w$])prompt\s*\(/ },
] as const;

const g03: string[] = [];
for (const file of sourceFiles) {
  stripComments(read(file))
    .split("\n")
    .forEach((line, index) => {
      for (const pattern of DIALOG_PATTERNS) {
        if (pattern.regex.test(line)) g03.push(`${file}:${index + 1} — '${pattern.name}' (D-08)`);
      }
    });
}

// ── G-10 ─────────────────────────────────────────────────────────────────────
const DEMO_PATTERNS = [
  { name: "demo login panel", regex: /demoLogin|loginAsDemo|quickLogin|loginWithoutPassword/i },
  { name: "hardcoded credential", regex: /\b(password|passwordHash|secret)\s*[:=]\s*["'`][^"'`$]{3,}["'`]/i },
  { name: "auth bypass", regex: /skipAuth|bypassAuth|disableAuth|NO_AUTH\s*=\s*true/i },
] as const;

// The contract package names credential fields in schemas; it never holds values.
const CREDENTIAL_ALLOWLIST = ["packages/contracts/"];

const g10: string[] = [];
for (const file of sourceFiles) {
  if (CREDENTIAL_ALLOWLIST.some((prefix) => file.startsWith(prefix))) continue;
  stripComments(read(file))
    .split("\n")
    .forEach((line, index) => {
      for (const pattern of DEMO_PATTERNS) {
        if (pattern.regex.test(line)) g10.push(`${file}:${index + 1} — ${pattern.name} (D-16)`);
      }
    });
}

process.stdout.write(`Forbidden-pattern gates — ${sourceFiles.length} files scanned\n`);
report("G-03 alert/confirm/prompt", g03);
report("G-10 demo panel & hardcoded credentials", g10);

if (g03.length > 0 || g10.length > 0) process.exit(1);
