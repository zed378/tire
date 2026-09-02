import { loadEnvFile } from "../kernel/load-env.ts";

// Must run before anything reads process.env.
loadEnvFile();

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "../generated/prisma/index.js";
import { loadConfig } from "../kernel/config.ts";
import { seedMasterData } from "../../prisma/seed/master-data.ts";
import { seedCsvData } from "../../prisma/seed/csv-data.ts";

/**
 * Database Initialization with Seeding
 *
 * This script runs automatically during db-init phase in deployment.
 * It seeds master data and CSV data only - admin password setup is excluded
 * and must be done manually via seed-prod-admin.ts.
 *
 * Safe to run multiple times (uses idempotent seed functions).
 */

const prisma = new PrismaClient();

async function ensureUploadDirectory(): Promise<void> {
  const config = loadConfig();
  if (config.STORAGE_DRIVER !== "local") return;

  const directory = resolve(config.UPLOAD_DIR);
  await mkdir(directory, { recursive: true });
  process.stdout.write(`  upload directory ready: ${directory}\n`);
}

async function checkCsvFiles(): Promise<{ exists: boolean; files: string[] }> {
  const requirementsDir = resolve(process.cwd(), "requirements");

  const expectedFiles = [
    "req-TB Brand Pattern.csv",
    "req-LT Brand Pattern.csv",
    "req-Size.csv",
    "req-Vehicle Brand.csv",
  ];

  const foundFiles: string[] = [];
  let allExist = true;

  for (const file of expectedFiles) {
    const filePath = resolve(requirementsDir, file);
    if (existsSync(filePath)) {
      foundFiles.push(file);
    } else {
      allExist = false;
      process.stdout.write(
        `  warning: CSV file not found: ${file}\n`,
      );
    }
  }

  return { exists: allExist, files: foundFiles };
}

async function main(): Promise<void> {
  const appEnv = process.env.APP_ENV ?? "local";

  process.stdout.write(`\ndb-init-seed: Starting seeding phase (APP_ENV=${appEnv})\n`);

  try {
    await ensureUploadDirectory();
    await seedMasterData(prisma);

    // Check for CSV files and seed if available
    const csvStatus = await checkCsvFiles();
    if (csvStatus.exists) {
      await seedCsvData(prisma);
    } else if (csvStatus.files.length > 0) {
      process.stdout.write(
        `  CSV data seeding: partial CSV files found (${csvStatus.files.length}/${4} files)\n` +
        `  Only ${csvStatus.files.join(", ")} are available - skipping CSV seeding\n`,
      );
    } else {
      process.stdout.write(`  CSV data seeding skipped: no CSV files found in requirements/\n`);
    }

    process.stdout.write(`db-init-seed: Seeding phase completed successfully\n\n`);
  } catch (error: unknown) {
    process.stderr.write(`db-init-seed failed: ${String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
