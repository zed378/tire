import { loadEnvFile } from "../src/kernel/load-env.ts";

// Must run before anything reads process.env.
loadEnvFile();

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { loadConfig } from "../src/kernel/config.ts";
import { hashPassword } from "../src/kernel/security/password.ts";
import { seedMasterData } from "../src/scripts/seed/master-data.ts";
import { seedCsvData } from "../src/scripts/seed/csv-data.ts";
import { seedDemoData } from "./seed/demo-data.ts";

/**
 * Database seed.
 *
 * Three things, in order: master data, the first admin account, and — outside
 * production — demo data with real sample photographs.
 *
 * PLAN/04 §4.4 is explicit that demo data exists only in `local` and `staging`,
 * and D-16 is why the line matters: the legacy login page carried three buttons
 * that authenticated as Supplier, Admin, or PM/SPV with no credentials at all.
 * Demo ACCOUNTS in a development database are fine. A demo LOGIN PATH is not,
 * and there is none — every account here has a real Argon2id hash and signs in
 * through the same route as anybody else.
 *
 * No password is written in this repository. Both come from the environment,
 * and gate G-10 greps for the alternative.
 */

const prisma = new PrismaClient();

/**
 * Creates the upload directory before anything tries to write a photo into it.
 *
 * While `STORAGE_DRIVER=local` this directory holds the evidence the whole
 * system exists to collect, so it is created deliberately rather than as a side
 * effect of the first write succeeding.
 */
async function ensureUploadDirectory(): Promise<void> {
  const config = loadConfig();
  if (config.STORAGE_DRIVER !== "local") return;

  const directory = resolve(config.UPLOAD_DIR);
  await mkdir(directory, { recursive: true });
  process.stdout.write(`  upload directory ready: ${directory}\n`);
}

async function seedFirstAdmin(): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (password === undefined || password.length < 10) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set and at least 10 characters. " +
        "No password is ever hardcoded in this repository (PLAN/13 §8).",
    );
  }

  const existing = await prisma.user.findFirst({ where: { username, deletedAt: null } });
  if (existing !== null) {
    process.stdout.write(`  admin '${username}' already exists — left untouched\n`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      displayName: "Administrator",
      role: "admin",
      passwordHash: await hashPassword(password),
      // Even the first account changes its password on first login, and — being
      // an admin — must enrol MFA before it can do anything (PLAN/13 §3.1).
      mustChangePassword: true,
    },
  });

  process.stdout.write(`  admin '${username}' created; must change its password on first login\n`);
}

async function main(): Promise<void> {
  const appEnv = process.env.APP_ENV ?? "local";

  if (appEnv === "production") {
    // Master data alone would be safe here, but this script also creates
    // accounts. Refusing outright is simpler than being clever about which half
    // may run where, and a seed script is a bad place to be clever.
    throw new Error(
      "Refusing to seed a production database. Create the first admin through a " +
        "reviewed migration or an operator action instead.",
    );
  }

  process.stdout.write(`seeding (APP_ENV=${appEnv})\n`);

  await ensureUploadDirectory();
  await seedMasterData(prisma);

  const csv = await seedCsvData(prisma);
  if (csv.directory === null) {
    process.stdout.write("  CSV master data skipped: no requirements/ directory found
");
  } else {
    process.stdout.write(
      `  CSV data: ${String(csv.vehicleBrandsCreated)} vehicle brands, ` +
        `${String(csv.tireBrandsCreated)} tire brands, ` +
        `${String(csv.patternsCreated)} tire brand patterns created
`,
    );
  }

  await seedFirstAdmin();

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoPassword === undefined || demoPassword.length < 10) {
    process.stdout.write(
      "  demo data skipped: set SEED_DEMO_PASSWORD (10+ characters) to create the\n" +
        "  supplier/admin/manager/operator accounts and their sample inspections\n",
    );
    return;
  }

  await seedDemoData(prisma, demoPassword);

  process.stdout.write(
    "\nDemo accounts: supplier1, supplier2, admin1, manager1, operator1\n" +
      "All of them use SEED_DEMO_PASSWORD. admin1 and operator1 will be asked to\n" +
      "enrol MFA on first login, because their roles require it (PLAN/13 §3.1).\n",
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`seed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
