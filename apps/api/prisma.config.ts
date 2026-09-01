import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * The CLI is a separate process from the application, so it does not go through
 * `src/kernel/load-env.ts`. It looks for `.env` beside the schema or in the
 * working directory, and this is a monorepo where `.env` lives at the root —
 * which is why `pnpm db:migrate` could not find `DATABASE_URL`.
 *
 * The loading below is deliberately a duplicate of four lines from
 * `load-env.ts` rather than an import of it. A config file the Prisma CLI
 * evaluates through its own loader is a bad place to depend on the application's
 * module graph; keeping it self-contained means it cannot break because of an
 * unrelated change to how the app resolves modules.
 *
 * This file also replaces the `package.json#prisma` block, which Prisma 6
 * deprecates and Prisma 7 removes.
 */
for (const candidate of [resolve(import.meta.dirname, "../../.env"), resolve(process.cwd(), ".env")]) {
  if (!existsSync(candidate)) continue;
  try {
    process.loadEnvFile(candidate);
    break;
  } catch {
    // Unreadable or malformed: fall through. Prisma reports what is missing.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // `prisma db seed`. The repository's own entry point is `pnpm db:seed`.
    seed: "tsx prisma/seed.ts",
  },
});
