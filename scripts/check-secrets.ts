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
  { name: "long token literal", regex: /["'`][A-Za-z0-9_\-]{48,}["'`]/ },
] as const;

const PLACEHOLDER = /change-me|changeme|example|placeholder|xxxx|<[a-z-]+>/i;

const files = [join(ROOT, "apps"), join(ROOT, "packages"), join(ROOT, "scripts")].flatMap((dir) =>
  walk(dir, [".ts", ".tsx", ".json", ".yml", ".yaml", ".sql"]),
);

const violations: string[] = [];
for (const file of files) {
  read(file)
    .split("\n")
    .forEach((line, index) => {
      if (PLACEHOLDER.test(line)) return;
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(line)) violations.push(`${file}:${index + 1} — ${pattern.name}`);
      }
    });
}

process.stdout.write(`Secret gate — ${files.length} files scanned\n`);
report("G-08 no credentials in the repo", violations);
if (violations.length > 0) process.exit(1);
