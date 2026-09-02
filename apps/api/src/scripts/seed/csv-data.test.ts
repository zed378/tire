import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { seedCsvData } from "./csv-data.ts";
import { resolveRequirementsDir } from "./requirements-dir.ts";

/**
 * These tests exist because the CSV seed failed silently in production for
 * weeks, in three separate ways at once: it looked for the files in a directory
 * that only exists during local development, it required all four files before
 * it would seed any of them, and it parsed the tire patterns out of the CSVs
 * and then never wrote them to `tire_brand_patterns`.
 *
 * Prisma is faked rather than mocked: the seed's contract with it is small and
 * entirely about which rows it decides to create, which is exactly what these
 * assert.
 */

interface CreatedRow {
  table: string;
  data: Record<string, unknown>;
}

function fakePrisma(existing: { vehicleBrands?: string[]; tireBrands?: string[] } = {}): {
  client: PrismaClient;
  created: CreatedRow[];
} {
  const created: CreatedRow[] = [];
  const vehicleBrands = new Set(existing.vehicleBrands ?? []);
  const tireBrands = new Set(existing.tireBrands ?? []);
  const patterns = new Set<string>();

  const client = {
    vehicleBrand: {
      findUnique: ({ where }: { where: { name: string } }) =>
        Promise.resolve(vehicleBrands.has(where.name) ? { name: where.name } : null),
      create: ({ data }: { data: { name: string } }) => {
        vehicleBrands.add(data.name);
        created.push({ table: "vehicleBrand", data });
        return Promise.resolve(data);
      },
    },
    tireBrand: {
      findUnique: ({ where }: { where: { name: string } }) =>
        Promise.resolve(tireBrands.has(where.name) ? { name: where.name } : null),
      create: ({ data }: { data: { name: string } }) => {
        tireBrands.add(data.name);
        created.push({ table: "tireBrand", data });
        return Promise.resolve(data);
      },
    },
    tireBrandPattern: {
      findUnique: ({
        where,
      }: {
        where: { brand_pattern_type: { brand: string; pattern: string; type: string } };
      }) => {
        const key = JSON.stringify(where.brand_pattern_type);
        return Promise.resolve(patterns.has(key) ? { id: 1n } : null);
      },
      create: ({ data }: { data: { brand: string; pattern: string; type: string } }) => {
        patterns.add(JSON.stringify({ brand: data.brand, pattern: data.pattern, type: data.type }));
        created.push({ table: "tireBrandPattern", data });
        return Promise.resolve(data);
      },
    },
  } as unknown as PrismaClient;

  return { client, created };
}

describe("seedCsvData", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "c26-seed-"));
    process.env.SEED_REQUIREMENTS_DIR = directory;
  });

  afterEach(() => {
    delete process.env.SEED_REQUIREMENTS_DIR;
    rmSync(directory, { recursive: true, force: true });
  });

  function writeCsv(name: string, content: string): void {
    writeFileSync(join(directory, name), content, "utf-8");
  }

  it("writes a tire_brand_patterns row for every pattern under every brand", async () => {
    writeCsv(
      "req-TB Brand Pattern.csv",
      [",BRAND,PATTERN", ",Bridgestone,R150", ",,M840", ",Michelin,XZE"].join("\n"),
    );

    const { client, created } = fakePrisma();
    const result = await seedCsvData(client);

    expect(result.patternsCreated).toBe(3);
    expect(created.filter((row) => row.table === "tireBrandPattern").map((row) => row.data)).toEqual(
      [
        { brand: "Bridgestone", pattern: "R150", type: "TB" },
        { brand: "Bridgestone", pattern: "M840", type: "TB" },
        { brand: "Michelin", pattern: "XZE", type: "TB" },
      ],
    );
  });

  it("tags LT patterns as LT and TB patterns as TB", async () => {
    writeCsv("req-TB Brand Pattern.csv", [",BRAND,PATTERN", ",Bridgestone,R150"].join("\n"));
    writeCsv("req-LT Brand Pattern.csv", [",BRAND,PATTERN", ",Dunlop,SP175"].join("\n"));

    const { client, created } = fakePrisma();
    await seedCsvData(client);

    const byType = created
      .filter((row) => row.table === "tireBrandPattern")
      .map((row) => `${String(row.data.type)}:${String(row.data.pattern)}`);
    expect(byType).toEqual(["TB:R150", "LT:SP175"]);
  });

  it("keeps the last brand in the file even when it has no patterns", async () => {
    // The previous parser only flushed a brand that had accumulated patterns, so
    // a trailing brand with none was dropped without a word.
    writeCsv(
      "req-TB Brand Pattern.csv",
      [",BRAND,PATTERN", ",Bridgestone,R150", ",Gajah Tunggal,"].join("\n"),
    );

    const { client } = fakePrisma();
    const result = await seedCsvData(client);

    expect(result.tireBrandsCreated).toBe(2);
    expect(result.patternsCreated).toBe(1);
  });

  it("seeds the files that are present when others are missing", async () => {
    // All four used to be required, so one absent file left every tire brand
    // and every vehicle brand unseeded.
    writeCsv("req-Vehicle Brand.csv", ["BRAND", "Hino", "Mitsubishi"].join("\n"));

    const { client } = fakePrisma();
    const result = await seedCsvData(client);

    expect(result.vehicleBrandsCreated).toBe(2);
    expect(result.missingFiles).toHaveLength(3);
  });

  it("adds only what is missing, so a redeployment changes nothing", async () => {
    writeCsv(
      "req-TB Brand Pattern.csv",
      [",BRAND,PATTERN", ",Bridgestone,R150", ",,M840"].join("\n"),
    );

    const { client } = fakePrisma();
    const first = await seedCsvData(client);
    const second = await seedCsvData(client);

    expect(first.patternsCreated).toBe(2);
    expect(first.tireBrandsCreated).toBe(1);
    expect(second.patternsCreated).toBe(0);
    expect(second.tireBrandsCreated).toBe(0);
  });

  it("reports a missing directory instead of throwing", async () => {
    process.env.SEED_REQUIREMENTS_DIR = join(directory, "does-not-exist");

    const { client, created } = fakePrisma();
    const result = await seedCsvData(client);

    // A deployment that has not received the business CSVs yet still comes up.
    expect(result.directory).toBeNull();
    expect(created).toHaveLength(0);
  });

  it("does not store tire sizes, because no table holds them", async () => {
    writeCsv("req-Size.csv", ["Group,SIZE", "TB,10.00-20", ",11.00-20"].join("\n"));

    const { client, created } = fakePrisma();
    const result = await seedCsvData(client);

    expect(result.sizesParsed).toBe(2);
    expect(created).toHaveLength(0);
  });
});

describe("resolveRequirementsDir", () => {
  it("returns null rather than a path that does not exist", () => {
    process.env.SEED_REQUIREMENTS_DIR = join(tmpdir(), "c26-definitely-not-here");
    expect(resolveRequirementsDir()).toBeNull();
    delete process.env.SEED_REQUIREMENTS_DIR;
  });

  it("finds the repository's own requirements directory with no override", () => {
    delete process.env.SEED_REQUIREMENTS_DIR;
    // The search walks out from this file, so it works regardless of the
    // working directory the seed happens to be started from — which is the
    // whole reason this function exists.
    expect(resolveRequirementsDir()).not.toBeNull();
  });
});
