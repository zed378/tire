import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "../../src/generated/prisma/index.js";

/**
 * CSV Data Seeding
 *
 * Loads master data from CSV files in the requirements directory:
 * - req-TB Brand Pattern.csv (Truck/Bus tire brands and patterns)
 * - req-LT Brand Pattern.csv (Light Truck tire brands and patterns)
 * - req-Size.csv (Tire sizes for TB and LT)
 */

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
 * Parse Vehicle Brand CSV file.
 * Format: BRAND with one brand per row
 */
function parseVehicleBrandCsv(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map((line) => line.trim());

  const brands: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    // Skip header (BRAND)
    if (line === "BRAND") continue;

    // Add brand
    if (line) {
      brands.push(line);
    }
  }

  return brands;
}

export async function seedCsvData(prisma: PrismaClient): Promise<void> {
  const requirementsDir = resolve(process.cwd(), "../../requirements");

  // Parse CSV files
  const tbBrandPatterns = parseBrandPatternCsv(
    resolve(requirementsDir, "req-TB Brand Pattern.csv"),
  );

  const ltBrandPatterns = parseBrandPatternCsv(
    resolve(requirementsDir, "req-LT Brand Pattern.csv"),
  );

  const sizes = parseSizeCsv(resolve(requirementsDir, "req-Size.csv"));

  const vehicleBrands = parseVehicleBrandCsv(
    resolve(requirementsDir, "req-Vehicle Brand.csv"),
  );

  // Track created vs skipped for each type
  let vehicleBrandCreated = 0;
  let vehicleBrandSkipped = 0;
  let tbBrandCreated = 0;
  let tbBrandSkipped = 0;
  let ltBrandCreated = 0;
  let ltBrandSkipped = 0;

  // Seed Vehicle Brands - only import new ones
  for (const brand of vehicleBrands) {
    const existing = await prisma.vehicleBrand.findUnique({
      where: { name: brand },
    });

    if (existing === null) {
      await prisma.vehicleBrand.create({ data: { name: brand } });
      vehicleBrandCreated++;
    } else {
      vehicleBrandSkipped++;
    }
  }

  // Seed TB Tire Brands - only import new ones
  for (const brandPattern of tbBrandPatterns) {
    const existing = await prisma.tireBrand.findUnique({
      where: { name: brandPattern.brand },
    });

    if (existing === null) {
      await prisma.tireBrand.create({ data: { name: brandPattern.brand } });
      tbBrandCreated++;
    } else {
      tbBrandSkipped++;
    }
  }

  // Seed LT Tire Brands - only import new ones
  for (const brandPattern of ltBrandPatterns) {
    const existing = await prisma.tireBrand.findUnique({
      where: { name: brandPattern.brand },
    });

    if (existing === null) {
      await prisma.tireBrand.create({ data: { name: brandPattern.brand } });
      ltBrandCreated++;
    } else {
      ltBrandSkipped++;
    }
  }

  // Output summary with created vs skipped breakdown
  const totalCreated = vehicleBrandCreated + tbBrandCreated + ltBrandCreated;
  const totalSkipped = vehicleBrandSkipped + tbBrandSkipped + ltBrandSkipped;

  process.stdout.write(
    `  CSV data: ` +
      `${vehicleBrandCreated} vehicle brands created (${vehicleBrandSkipped} skipped), ` +
      `${tbBrandCreated} TB brands created (${tbBrandSkipped} skipped), ` +
      `${ltBrandCreated} LT brands created (${ltBrandSkipped} skipped), ` +
      `${sizes.length} tire sizes\n`,
  );

  if (totalSkipped > 0) {
    process.stdout.write(
      `  (${totalSkipped} existing brands were not re-imported to avoid duplicates)\n`,
    );
  }

  if (totalCreated === 0 && totalSkipped > 0) {
    process.stdout.write(`  (All CSV data already exists in database - no new records imported)\n`);
  }
}
