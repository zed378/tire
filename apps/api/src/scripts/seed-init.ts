import { PrismaClient } from "../generated/prisma/index.js";
import { loadEnvFile } from "../kernel/load-env.ts";
import { seedCsvData } from "./seed/csv-data.ts";
import { seedMasterData } from "./seed/master-data.ts";

loadEnvFile();

/**
 * The seed that runs automatically at deployment, in the `db-init` container,
 * immediately after `prisma migrate deploy`.
 *
 * It seeds reference data only — provinces, cities, vehicle brands, tire brands
 * and tire brand patterns. It creates no accounts, which is what makes it safe
 * to run unattended in production: the first admin is created by an operator
 * running `seed-prod-admin.js`, so no password ever passes through a
 * deployment step (PLAN/13 §8).
 *
 * Idempotent, and re-run on every deployment. Existing rows are never modified.
 *
 * WHY THIS FILE EXISTS AT ALL: the seeding was previously written into
 * `docker-entrypoint.sh`, which was never `COPY`d into the image and never set
 * as an `ENTRYPOINT` — it was referenced only by a comment. `db-init` ran
 * migrations and nothing else, so every deployment came up with empty master
 * data tables and no indication that anything had been skipped. Everything that
 * must happen at deployment now happens in the container's `command`, where it
 * can be read, and fails loudly when it fails.
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const appEnv = process.env.APP_ENV ?? "local";
  process.stdout.write(`seed-init: reference data (APP_ENV=${appEnv})\n`);

  await seedMasterData(prisma);

  const csv = await seedCsvData(prisma);

  if (csv.directory === null) {
    // Not fatal: the CSV files are business input, and a deployment that has
    // not received them yet should still come up with the built-in master data
    // rather than crash-looping. It must say so unmistakably, though — silence
    // here is what let an empty brand list reach production twice.
    process.stdout.write(
      "  CSV master data SKIPPED: no requirements/ directory found.\n" +
        "  Tire brands and patterns will be empty. Mount the CSV files or set\n" +
        "  SEED_REQUIREMENTS_DIR, then re-run: pnpm db:seed:init\n",
    );
  } else {
    process.stdout.write(`  CSV master data read from ${csv.directory}\n`);
    if (csv.missingFiles.length > 0) {
      process.stdout.write(`  WARNING: missing CSV files: ${csv.missingFiles.join(", ")}\n`);
    }
    process.stdout.write(
      `  CSV data: ${String(csv.vehicleBrandsCreated)} vehicle brands, ` +
        `${String(csv.tireBrandsCreated)} tire brands, ` +
        `${String(csv.patternsCreated)} tire brand patterns created, ` +
        `${String(csv.sizesCreated)} tire sizes created (${String(csv.sizesTotal)} parsed)\n`,
    );
  }

  process.stdout.write("seed-init: done\n");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`seed-init failed: ${String(error)}\n`);
    // Non-zero stops the deployment: `db-init` is a `service_completed_successfully`
    // dependency of api and worker, so a failed seed holds them back rather than
    // letting a half-populated system start serving.
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
