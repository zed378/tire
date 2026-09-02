import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { resolveRequirementsDir } from "./requirements-dir.ts";

/**
 * CSV master data (PLAN/02 §5).
 *
 * Four files, supplied by the business rather than invented here:
 *   req-Vehicle Brand.csv      vehicle manufacturers
 *   req-TB Brand Pattern.csv   truck and bus tire brands, and their patterns
 *   req-LT Brand Pattern.csv   light truck tire brands, and their patterns
 *   req-Size.csv               tire sizes, by group
 *
 * Idempotent throughout: every deployment re-runs this, and it must add only
 * what is missing. Existing rows are left exactly as they are — an operator who
 * renames or deactivates a brand through the admin screens must not have that
 * undone by the next deploy.
 */

const TB_FILE = "req-TB Brand Pattern.csv";
const LT_FILE = "req-LT Brand Pattern.csv";
const SIZE_FILE = "req-Size.csv";
const VEHICLE_FILE = "req-Vehicle Brand.csv";

interface BrandPattern {
  brand: string;
  patterns: string[];
}

/**
 * Parses the TB/LT files: `,BRAND,PATTERN`, where the brand column is filled in
 * once and the pattern rows beneath it carry only a pattern.
 */
function parseBrandPatternCsv(filePath: string): BrandPattern[] {
  const lines = readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim());

  const brandPatterns: BrandPattern[] = [];
  let currentBrand = "";
  let currentPatterns: string[] = [];

  for (const line of lines) {
    if (line === "") continue;

    const parts = line.split(",").map((part) => part.trim());
    const brandColumn = parts[1] ?? "";
    const patternColumn = parts[2] ?? "";

    if (brandColumn === "BRAND" && patternColumn === "PATTERN") continue;

    if (brandColumn !== "") {
      if (currentBrand !== "") {
        brandPatterns.push({ brand: currentBrand, patterns: [...currentPatterns] });
      }
      currentBrand = brandColumn;
      currentPatterns = [];
    }

    if (patternColumn !== "" && currentBrand !== "") {
      currentPatterns.push(patternColumn);
    }
  }

  // A brand with no patterns is still a brand, so this is not guarded on
  // `currentPatterns.length` the way the earlier version was — that dropped the
  // last brand in the file whenever it happened to have none.
  if (currentBrand !== "") {
    brandPatterns.push({ brand: currentBrand, patterns: currentPatterns });
  }

  return brandPatterns;
}

/** Parses `req-Vehicle Brand.csv`: one brand per line under a `BRAND` header. */
function parseVehicleBrandCsv(filePath: string): string[] {
  return readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && line !== "BRAND");
}

/** Parses `req-Size.csv`: `Group,SIZE`, the group repeating down its block. */
function parseSizeCsv(filePath: string): { group: string; size: string }[] {
  const lines = readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim());

  const sizes: { group: string; size: string }[] = [];
  let currentGroup = "";

  for (const line of lines) {
    if (line === "") continue;

    const parts = line.split(",").map((part) => part.trim());
    const groupColumn = parts[0] ?? "";
    const sizeColumn = parts[1] ?? "";

    if (groupColumn === "Group" && sizeColumn === "SIZE") continue;
    if (groupColumn === "TB" || groupColumn === "LT") currentGroup = groupColumn;
    if (sizeColumn !== "" && currentGroup !== "") {
      sizes.push({ group: currentGroup, size: sizeColumn });
    }
  }

  return sizes;
}

export interface CsvSeedResult {
  /** Absolute directory the files were read from, or null when none was found. */
  directory: string | null;
  missingFiles: string[];
  vehicleBrandsCreated: number;
  tireBrandsCreated: number;
  patternsCreated: number;
  sizesCreated: number;
  sizesTotal: number;
}

export async function seedCsvData(prisma: PrismaClient): Promise<CsvSeedResult> {
  const directory = resolveRequirementsDir();
  if (directory === null) {
    return {
      directory: null,
      missingFiles: [VEHICLE_FILE, TB_FILE, LT_FILE, SIZE_FILE],
      vehicleBrandsCreated: 0,
      tireBrandsCreated: 0,
      patternsCreated: 0,
      sizesCreated: 0,
      sizesTotal: 0,
    };
  }

  const paths = {
    vehicle: resolve(directory, VEHICLE_FILE),
    tb: resolve(directory, TB_FILE),
    lt: resolve(directory, LT_FILE),
    size: resolve(directory, SIZE_FILE),
  };

  const missingFiles = Object.entries(paths)
    .filter(([, path]) => !existsSync(path))
    .map(([, path]) => path.slice(directory.length + 1));

  // Each file is seeded on its own. The earlier version required all four to be
  // present and skipped every one of them otherwise, so a single missing file
  // left the whole tire brand list empty with only a warning to show for it.
  const vehicleBrands = existsSync(paths.vehicle) ? parseVehicleBrandCsv(paths.vehicle) : [];
  const tbBrandPatterns = existsSync(paths.tb) ? parseBrandPatternCsv(paths.tb) : [];
  const ltBrandPatterns = existsSync(paths.lt) ? parseBrandPatternCsv(paths.lt) : [];
  const sizes = existsSync(paths.size) ? parseSizeCsv(paths.size) : [];

  let vehicleBrandsCreated = 0;
  for (const name of vehicleBrands) {
    const existing = await prisma.vehicleBrand.findUnique({ where: { name } });
    if (existing !== null) continue;
    await prisma.vehicleBrand.create({ data: { name } });
    vehicleBrandsCreated++;
  }

  let tireBrandsCreated = 0;
  let patternsCreated = 0;

  for (const [type, brandPatterns] of [
    ["TB", tbBrandPatterns],
    ["LT", ltBrandPatterns],
  ] as const) {
    for (const { brand, patterns } of brandPatterns) {
      const existing = await prisma.tireBrand.findUnique({ where: { name: brand } });
      if (existing === null) {
        await prisma.tireBrand.create({ data: { name: brand } });
        tireBrandsCreated++;
      }

      // The patterns were parsed and then thrown away by every previous version
      // of this seed, which is why `tire_brand_patterns` was empty in every
      // environment while the master-brand screens listed nothing.
      for (const pattern of patterns) {
        const existingPattern = await prisma.tireBrandPattern.findUnique({
          where: { brand_pattern_type: { brand, pattern, type } },
        });
        if (existingPattern !== null) continue;
        await prisma.tireBrandPattern.create({ data: { brand, pattern, type } });
        patternsCreated++;
      }
    }
  }

  let sizesCreated = 0;
  for (const { group, size } of sizes) {
    const existing = await prisma.tireSize.findUnique({
      where: { size_type: { size, type: group } },
    });
    if (existing !== null) continue;
    await prisma.tireSize.create({ data: { size, type: group } });
    sizesCreated++;
  }

  return {
    directory,
    missingFiles,
    vehicleBrandsCreated,
    tireBrandsCreated,
    patternsCreated,
    sizesCreated,
    sizesTotal: sizes.length,
  };
}
