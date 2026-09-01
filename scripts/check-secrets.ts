/**
 * Local counterpart of CI gate G-08 (PLAN/09 §5, risk R-15).
 * gitleaks is the authority in CI; this is the fast pre-commit filter.
 */
import { join } from "node:path";
import { read, report, ROOT, walk } from "./files.ts";

const PATTERNS = [
  { name: "Postgres connection string", regex: /postgres(ql)?:\/\/[^\s"'`<]*:[^\s"'`<@]+@/i },
  { name: "AWS/R2 access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "private key", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "long token literal", regex: /["'`][A-Za-z0-9_-]{48,}["'`]/ },
] as const;

const PLACEHOLDER = /change-me|changeme|example|placeholder|xxxx|<[a-z-]+>/i;

/**
 * A line may opt out, but only with a stated reason.
 *
 * `// not-a-secret: <why>` — the reason is mandatory, and the count of
 * suppressions is printed on every run so they cannot quietly accumulate. A bare
 * suppression is the pattern PLAN/09 §7 warns about; one that has to say why is
 * a decision somebody made on purpose.
 */
const SUPPRESSION = /\/\/\s*not-a-secret:\s*\S+/;

const files = [join(ROOT, "apps"), join(ROOT, "packages"), join(ROOT, "scripts")].flatMap((dir) =>
  walk(dir, [".ts", ".tsx", ".json", ".yml", ".yaml", ".sql"]),
);

const violations: string[] = [];
let suppressed = 0;

for (const file of files) {
  read(file)
    .split("\n")
    .forEach((line, index) => {
      if (PLACEHOLDER.test(line)) return;

      const matched = PATTERNS.find((pattern) => pattern.regex.test(line));
      if (matched === undefined) return;

      if (SUPPRESSION.test(line)) {
        suppressed++;
        return;
      }

      violations.push(`${file}:${index + 1} — ${matched.name}`);
    });
}

process.stdout.write(
  `Secret gate — ${files.length} files scanned` +
    (suppressed > 0 ? `, ${suppressed} line(s) suppressed with a stated reason` : "") +
    "\n",
);
report("G-08 no credentials in the repo", violations);
if (violations.length > 0) process.exit(1);
