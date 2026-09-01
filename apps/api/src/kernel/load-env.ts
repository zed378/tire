import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads `.env` from the repository root for local development.
 *
 * Imported first by `server.ts`, `worker.ts`, and the seed script. In staging
 * and production the environment comes from the container (`env_file` in
 * docker-compose), so this does nothing there — and it must not, because a
 * stray `.env` on a production host silently overriding real configuration is
 * exactly the kind of surprise that costs an afternoon.
 *
 * Uses Node's own `process.loadEnvFile` rather than a dependency: one less
 * package to audit, and it is a single call.
 */
export function loadEnvFile(): void {
  if (process.env.APP_ENV === "production") return;

  // apps/api/src/kernel -> repository root
  const candidates = [
    resolve(import.meta.dirname, "../../../../.env"),
    resolve(process.cwd(), ".env"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // An unreadable or malformed file falls through to the next candidate;
      // config validation will report what is actually missing.
    }
  }
}
