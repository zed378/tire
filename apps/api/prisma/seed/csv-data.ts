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

  // Parse TB Brand Pattern
  const tbBrandPatterns = parseBrandPatternCsv(
    resolve(requirementsDir, "req-TB Brand Pattern.csv"),
  );

  // Parse LT Brand Pattern
  const ltBrandPatterns = parseBrandPatternCsv(
    resolve(requirementsDir, "req-LT Brand Pattern.csv"),
  );

  // Parse Sizes
  const sizes = parseSizeCsv(resolve(requirementsDir, "req-Size.csv"));

  // Parse Vehicle Brands
  const vehicleBrands = parseVehicleBrandCsv(
    resolve(requirementsDir, "req-Vehicle Brand.csv"),
  );

  // Seed Vehicle Brands
  let vehicleBrandCount = 0;
  for (const brand of vehicleBrands) {
    await prisma.vehicleBrand.upsert({
      where: { name: brand },
      create: { name: brand },
      update: {},
    });
    vehicleBrandCount++;
  }

  // Seed TB Tire Brands with Patterns
  let tbBrandCount = 0;
  for (const brandPattern of tbBrandPatterns) {
    const brand = await prisma.tireBrand.upsert({
      where: { name: brandPattern.brand },
      create: { name: brandPattern.brand },
      update: {},
    });
    tbBrandCount++;
  }

  // Seed LT Tire Brands with Patterns
  let ltBrandCount = 0;
  for (const brandPattern of ltBrandPatterns) {
    const brand = await prisma.tireBrand.upsert({
      where: { name: brandPattern.brand },
      create: { name: brandPattern.brand },
      update: {},
    });
    ltBrandCount++;
  }

  process.stdout.write(
    `  CSV data: ${vehicleBrandCount} vehicle brands, ${tbBrandCount} TB brands, ${ltBrandCount} LT brands, ${sizes.length} tire sizes\n`,
  );
}
