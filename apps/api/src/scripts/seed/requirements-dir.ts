import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Locates the directory holding the master-data CSV files.
 *
 * This exists because the path was previously hard-coded relative to the
 * working directory, and the working directory is not the same in the three
 * places the seed runs from:
 *
 *   pnpm db:seed          cwd = apps/api        -> ../../requirements
 *   node dist/scripts/... cwd = /app            -> ./requirements
 *   docker compose run    cwd = /app            -> ./requirements
 *
 * The old code resolved `../../requirements` unconditionally, so in the
 * container it looked for `/requirements` and found nothing. Worse, the caller
 * checked a *different* path (`cwd/requirements`) before calling it, so the
 * check passed while the read failed.
 *
 * `SEED_REQUIREMENTS_DIR` overrides everything, for the case where the files
 * are mounted somewhere else entirely.
 */
export function resolveRequirementsDir(): string | null {
  const override = process.env.SEED_REQUIREMENTS_DIR;
  if (override !== undefined && override !== "") {
    return existsSync(override) ? resolve(override) : null;
  }

  const candidates = [
    resolve(process.cwd(), "requirements"),
    resolve(process.cwd(), "../../requirements"),
    resolve(import.meta.dirname, "../../../../../requirements"),
    "/app/requirements",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
