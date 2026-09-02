import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../generated/prisma/index.js";
import { loadEnvFile } from "../kernel/load-env.ts";

loadEnvFile();

/**
 * Checks if the current process is running inside a Docker/Podman container.
 */
export function isInsideContainer(): boolean {
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
    return true;
  }
  try {
    const cgroup = readFileSync("/proc/1/cgroup", "utf8");
    if (
      cgroup.includes("docker") ||
      cgroup.includes("kubepods") ||
      cgroup.includes("containerd") ||
      cgroup.includes("podman") ||
      cgroup.includes("overlay")
    ) {
      return true;
    }
  } catch {
    // /proc/1/cgroup may not exist or be accessible on non-Linux systems
  }
  if (process.env.IS_CONTAINER === "true" || process.env.DOCKER_CONTAINER === "true") {
    return true;
  }
  return false;
}

/**
 * Checks if the current environment is production.
 */
export function isProductionEnv(): boolean {
  return process.env.APP_ENV === "production";
}

interface BrandPattern {
  brand: string;
  patterns: string[];
}

/**
 * Parse TB/LT Brand Pattern CSV files.
 * Format: empty, BRAND, PATTERN with repeating pattern rows under each brand
 */
function parseBrandPatternCsv(filePath: string): BrandPattern[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map((line) => line.trim());

  const brandPatterns: BrandPattern[] = [];
  let currentBrand = "";
  let currentPatterns: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    const parts = line.split(",").map((part) => part.trim());

    // Skip header row (empty, BRAND, PATTERN)
    if (parts[1] === "BRAND" && parts[2] === "PATTERN") continue;

    // New brand row (has brand name in second column)
    if (parts[1] && parts[1] !== "") {
      // Save previous brand if exists
      if (currentBrand && currentPatterns.length > 0) {
        brandPatterns.push({
          brand: currentBrand,
          patterns: [...currentPatterns],
        });
      }
      currentBrand = parts[1];
      currentPatterns = [];
    }

    // Pattern row (has pattern in third column)
    if (parts[2] && parts[2] !== "" && currentBrand) {
      currentPatterns.push(parts[2]);
    }
  }

  // Save last brand
  if (currentBrand && currentPatterns.length > 0) {
    brandPatterns.push({
      brand: currentBrand,
      patterns: currentPatterns,
    });
  }

  return brandPatterns;
}

/**
 * Parse Size CSV file.
 * Format: Group, SIZE with rows like TB,10.00-20 or LT,215/75R17.5
 */
function parseSizeCsv(filePath: string): { group: string; size: string }[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map((line) => line.trim());

  const sizes: { group: string; size: string }[] = [];
  let currentGroup = "";

  for (const line of lines) {
    if (!line) continue;

    const parts = line.split(",").map((part) => part.trim());

    // Skip header (Group, SIZE)
    if (parts[0] === "Group" && parts[1] === "SIZE") continue;

    // New group row (has group in first column)
    if (parts[0] && parts[0] !== "" && (parts[0] === "TB" || parts[0] === "LT")) {
      currentGroup = parts[0];
    }

    // Size row (has size in second column)
    if (parts[1] && parts[1] !== "" && currentGroup) {
      sizes.push({ group: currentGroup, size: parts[1] });
    }
  }

  return sizes;
}

export interface SeedCsvProdOptions {
  prisma?: PrismaClient;
  checkProductionEnv?: () => boolean;
  checkInsideContainer?: () => boolean;
  requirementsDir?: string;
}

/**
 * Seeds CSV data (tire brands and patterns) in production.
 *
 * Enforces two strict gates:
 * 1. Must run ONLY when APP_ENV=production.
 * 2. Must run ONLY inside a container.
 *
 * This is safe to run multiple times (uses UPSERT strategy).
 */
export async function seedCsvProd(options: SeedCsvProdOptions = {}): Promise<void> {
  const checkProd = options.checkProductionEnv ?? isProductionEnv;
  const checkContainer = options.checkInsideContainer ?? isInsideContainer;

  // Gate 1: Production Environment check
  if (!checkProd()) {
    throw new Error(
      "Gagal: script ini HANYA dapat dijalankan pada lingkungan produksi (APP_ENV=production).",
    );
  }

  // Gate 2: Container Environment check
  if (!checkContainer()) {
    throw new Error(
      "Gagal: script ini HANYA dapat ditrigger dengan menjalankannya dari dalam container Docker/Podman.",
    );
  }

  const prisma = options.prisma ?? new PrismaClient();
  const requirementsDir = options.requirementsDir ?? resolve(process.cwd(), "../../requirements");

  try {
    // Check if CSV files exist
    const tbFile = resolve(requirementsDir, "req-TB Brand Pattern.csv");
    const ltFile = resolve(requirementsDir, "req-LT Brand Pattern.csv");
    const sizeFile = resolve(requirementsDir, "req-Size.csv");

    if (!existsSync(tbFile)) {
      throw new Error(`File tidak ditemukan: ${tbFile}`);
    }
    if (!existsSync(ltFile)) {
      throw new Error(`File tidak ditemukan: ${ltFile}`);
    }
    if (!existsSync(sizeFile)) {
      throw new Error(`File tidak ditemukan: ${sizeFile}`);
    }

    process.stdout.write("Parsing CSV files...\n");

    // Parse CSV files
    const tbBrandPatterns = parseBrandPatternCsv(tbFile);
    const ltBrandPatterns = parseBrandPatternCsv(ltFile);
    const sizes = parseSizeCsv(sizeFile);

    process.stdout.write(
      `Parsed: ${tbBrandPatterns.length} TB brands, ${ltBrandPatterns.length} LT brands, ${sizes.length} sizes\n`,
    );

    // Seed TB Tire Brands
    process.stdout.write("Seeding TB tire brands...\n");
    for (const brandPattern of tbBrandPatterns) {
      await prisma.tireBrand.upsert({
        where: { name: brandPattern.brand },
        create: { name: brandPattern.brand },
        update: {},
      });
    }

    // Seed LT Tire Brands
    process.stdout.write("Seeding LT tire brands...\n");
    for (const brandPattern of ltBrandPatterns) {
      await prisma.tireBrand.upsert({
        where: { name: brandPattern.brand },
        create: { name: brandPattern.brand },
        update: {},
      });
    }

    process.stdout.write(
      `✓ Seeding berhasil: ${tbBrandPatterns.length + ltBrandPatterns.length} tire brands, ${sizes.length} tire sizes\n`,
    );
  } finally {
    if (!options.prisma) {
      await prisma.$disconnect();
    }
  }
}

// Auto-run if executed directly as entrypoint script
const scriptArg = process.argv[1];
if (
  scriptArg !== undefined &&
  (scriptArg.endsWith("seed-csv-prod.js") || scriptArg.endsWith("seed-csv-prod.ts"))
) {
  seedCsvProd().catch((err: unknown) => {
    process.stderr.write(`${String(err instanceof Error ? err.message : err)}\n`);
    process.exitCode = 1;
  });
}
