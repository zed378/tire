/**
 * CI gates G-03 and G-10 (PLAN/09 §5).
 *
 * G-03 — `alert(`, `confirm(`, `prompt(` must return zero hits across the source
 *        tree. Closes D-08: the defect this rewrite exists to fix must not
 *        re-enter the new system.
 * G-10 — demo login panels and hardcoded credentials must return zero hits.
 *        Closes D-16: three buttons that logged in without any credentials.
 * G-13 — no inline `style` attributes, and no assets loaded from another
 *        origin, in the client. The CSP is `style-src
 *        'self'` with no `unsafe-inline` (PLAN/13 §7), so an inline style is
 *        silently dropped by the browser. It works perfectly in `vite dev`,
 *        where no CSP header is set, and fails only in production — which is
 *        the worst shape a defect can take. A progress bar reached the
 *        dashboard this way and would have rendered at zero width.
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

// ── G-13 ──────────────────────────────────────────────────────────────────────────
// Only the client is scanned: the CSP governs what the browser renders.
const g13: string[] = [];
for (const file of sourceFiles) {
  if (!file.includes("apps/web/")) continue;
  stripComments(read(file))
    .split("\n")
    .forEach((line, index) => {
      // `img-src 'self' …` — an asset on another origin is refused by the
      // browser, and again only where the CSP header is set. Four landing-page
      // photographs were hot-linked to images.unsplash.com and had been broken
      // in production the whole time.
      const external = /(?:src|srcSet|href)=["'{`]{1,2}https?:\/\//.exec(line);
      if (external !== null && !/rel=["']?(?:license|noopener|noreferrer)/.test(line)) {
        g13.push(
          `${file}:${index + 1} — asset loaded from another origin; the CSP refuses it ` +
            `(PLAN/13 §7). Download it into apps/web/public/ and reference it by path.`,
        );
      }
      if (/\bstyle=\{/.test(line)) {
        g13.push(
          `${file}:${index + 1} — inline style attribute; the CSP drops it (PLAN/13 §7). ` +
            `Use a Tailwind class, quantising the value if it is computed.`,
        );
      }
    });
}

process.stdout.write(`Forbidden-pattern gates — ${sourceFiles.length} files scanned\n`);
report("G-03 alert/confirm/prompt", g03);
report("G-10 demo panel & hardcoded credentials", g10);
report("G-13 CSP: inline styles & cross-origin assets", g13);

if (g03.length > 0 || g10.length > 0 || g13.length > 0) process.exit(1);
