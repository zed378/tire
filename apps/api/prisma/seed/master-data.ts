import type { PrismaClient } from "../../src/generated/prisma/index.js";

/**
 * Master data (PLAN/02 §5) — closes Q-07.
 *
 * These were constants in the legacy code, covering Java only. The moment the
 * business reaches Sumatra, a constant becomes a deployment; managed rows make
 * it an admin task. Seeding them is a starting point, not a definition.
 */

/** The five provinces and seventeen cities observed in the legacy UI (PLAN/00 §1.4). */
export const REGIONS: { code: string; name: string; cities: { code: string; name: string }[] }[] = [
  {
    code: "31",
    name: "DKI Jakarta",
    cities: [
      { code: "3172", name: "Jakarta Timur" },
      { code: "3175", name: "Jakarta Utara" },
      { code: "3173", name: "Jakarta Barat" },
      { code: "3171", name: "Jakarta Selatan" },
    ],
  },
  {
    code: "32",
    name: "Jawa Barat",
    cities: [
      { code: "3273", name: "Bandung" },
      { code: "3275", name: "Bekasi" },
      { code: "3271", name: "Bogor" },
      { code: "3215", name: "Karawang" },
    ],
  },
  {
    code: "33",
    name: "Jawa Tengah",
    cities: [
      { code: "3374", name: "Semarang" },
      { code: "3372", name: "Solo" },
      { code: "3319", name: "Kudus" },
    ],
  },
  {
    code: "35",
    name: "Jawa Timur",
    cities: [
      { code: "3578", name: "Surabaya" },
      { code: "3515", name: "Sidoarjo" },
      { code: "3573", name: "Malang" },
    ],
  },
  {
    code: "36",
    name: "Banten",
    cities: [
      { code: "3671", name: "Tangerang" },
      { code: "3672", name: "Cilegon" },
      { code: "3673", name: "Serang" },
    ],
  },
];

/**
 * Only `Hino` was confirmed in the legacy datalist; the rest are the common
 * commercial marques here. All of it is editable master data now, so a wrong
 * guess costs an admin one edit rather than a deployment.
 */
const VEHICLE_BRANDS = [
  "Hino",
  "Mitsubishi Fuso",
  "Isuzu",
  "UD Trucks",
  "Mercedes-Benz",
  "Scania",
  "Volvo",
  "Toyota",
  "Tata Motors",
];

/**
 * The legacy system stored tire brand as free text with no list at all, which
 * made `Bridgestone`, `bridgestone`, and `Bridgstone` three different brands in
 * every report (PLAN/02 §5).
 */
const TIRE_BRANDS = [
  "Bridgestone",
  "GT Radial",
  "Dunlop",
  "Michelin",
  "Goodyear",
  "Yokohama",
  "Hankook",
  "Continental",
  "Zeta",
  "Aspira",
];

export async function seedMasterData(prisma: PrismaClient): Promise<void> {
  for (const region of REGIONS) {
    const province = await prisma.province.upsert({
      where: { code: region.code },
      create: { code: region.code, name: region.name },
      update: { name: region.name },
    });

    for (const city of region.cities) {
      await prisma.city.upsert({
        where: { code: city.code },
        create: { code: city.code, name: city.name, provinceId: province.id },
        update: { name: city.name, provinceId: province.id },
      });
    }
  }

  for (const name of VEHICLE_BRANDS) {
    await prisma.vehicleBrand.upsert({ where: { name }, create: { name }, update: {} });
  }
  for (const name of TIRE_BRANDS) {
    await prisma.tireBrand.upsert({ where: { name }, create: { name }, update: {} });
  }

  process.stdout.write(
    `  master data: ${REGIONS.length} provinces, ` +
      `${REGIONS.reduce((n, r) => n + r.cities.length, 0)} cities, ` +
      `${VEHICLE_BRANDS.length} vehicle brands, ${TIRE_BRANDS.length} tire brands\n`,
  );
}
