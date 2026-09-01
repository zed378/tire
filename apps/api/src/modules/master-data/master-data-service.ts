import {
  SUB_SEGMENTS_BY_SEGMENT,
  type Brand,
  type City,
  type CreateBrandInput,
  type CreateCityInput,
  type CreateProvinceInput,
  type MasterDataBundle,
  type PendingBrandReview,
  type Province,
  type UpdateMasterInput,
} from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";

/**
 * Master data (PLAN/02 §5) — closes Q-07.
 *
 * Provinces, cities, and brands were constants in the legacy code, covering Java
 * only. The moment the business reaches Sumatra, a constant becomes a
 * deployment. Managed rows make that an admin task instead.
 *
 * Nothing here is ever hard-deleted: a city that stops being served still has
 * inspections pointing at it. Deactivation removes it from the dropdown and
 * leaves history intact.
 */

export type MasterTable = "provinces" | "cities" | "vehicle-brands" | "tire-brands";

/** One request that fills every dropdown; the service worker caches it for 24h. */
export async function getBundle(): Promise<MasterDataBundle> {
  const prisma = getPrisma();

  const [provinces, cities, vehicleBrands, tireBrands] = await Promise.all([
    prisma.province.findMany({
      where: { isActive: true },
      include: { _count: { select: { cities: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      include: { province: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.vehicleBrand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.tireBrand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    provinces: provinces.map((province) => ({
      id: Number(province.id),
      code: province.code,
      name: province.name,
      isActive: province.isActive,
      cityCount: province._count.cities,
    })),
    cities: cities.map((city) => ({
      id: Number(city.id),
      provinceId: Number(city.provinceId),
      provinceName: city.province.name,
      code: city.code,
      name: city.name,
      isActive: city.isActive,
    })),
    vehicleBrands: vehicleBrands.map(toBrand),
    tireBrands: tireBrands.map(toBrand),
    subSegments: Object.entries(SUB_SEGMENTS_BY_SEGMENT).map(([segment, values]) => ({
      segment,
      values: [...values],
    })),
  };
}

function toBrand(brand: { id: bigint; name: string; isActive: boolean }): Brand {
  return { id: Number(brand.id), name: brand.name, isActive: brand.isActive };
}

export async function createProvince(
  actor: AuditActor,
  input: CreateProvinceInput,
): Promise<Province> {
  return withTransaction(async (tx) => {
    const province = await tx.province.create({ data: input });
    await recordAudit(tx, actor, {
      action: "masterdata.created",
      entity: "province",
      entityId: province.id,
      after: { code: province.code, name: province.name },
    });
    return {
      id: Number(province.id),
      code: province.code,
      name: province.name,
      isActive: province.isActive,
      cityCount: 0,
    };
  });
}

export async function createCity(actor: AuditActor, input: CreateCityInput): Promise<City> {
  return withTransaction(async (tx) => {
    const province = await tx.province.findUnique({ where: { id: BigInt(input.provinceId) } });
    if (province === null) {
      throw new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          { field: "provinceId", code: "NOT_ALLOWED", message: "Provinsi tidak ditemukan." },
        ],
      });
    }

    const city = await tx.city.create({
      data: { provinceId: BigInt(input.provinceId), code: input.code, name: input.name },
    });

    await recordAudit(tx, actor, {
      action: "masterdata.created",
      entity: "city",
      entityId: city.id,
      after: { code: city.code, name: city.name, provinceId: input.provinceId },
    });

    return {
      id: Number(city.id),
      provinceId: Number(city.provinceId),
      provinceName: province.name,
      code: city.code,
      name: city.name,
      isActive: city.isActive,
    };
  });
}

export async function createBrand(
  actor: AuditActor,
  table: "vehicle-brands" | "tire-brands",
  input: CreateBrandInput,
): Promise<Brand> {
  return withTransaction(async (tx) => {
    const brand =
      table === "vehicle-brands"
        ? await tx.vehicleBrand.create({ data: input })
        : await tx.tireBrand.create({ data: input });

    await recordAudit(tx, actor, {
      action: "masterdata.created",
      entity: table === "vehicle-brands" ? "vehicle_brand" : "tire_brand",
      entityId: brand.id,
      after: { name: brand.name },
    });

    return toBrand(brand);
  });
}

export async function updateMaster(
  actor: AuditActor,
  table: MasterTable,
  id: bigint,
  input: UpdateMasterInput,
): Promise<void> {
  await withTransaction(async (tx) => {
    const entity =
      table === "provinces"
        ? "province"
        : table === "cities"
          ? "city"
          : table === "vehicle-brands"
            ? "vehicle_brand"
            : "tire_brand";

    const data = { name: input.name, isActive: input.isActive };
    switch (table) {
      case "provinces":
        await tx.province.update({ where: { id }, data });
        break;
      case "cities":
        await tx.city.update({ where: { id }, data });
        break;
      case "vehicle-brands":
        await tx.vehicleBrand.update({ where: { id }, data });
        break;
      case "tire-brands":
        await tx.tireBrand.update({ where: { id }, data });
        break;
    }

    await recordAudit(tx, actor, {
      action: input.isActive === false ? "masterdata.deactivated" : "masterdata.updated",
      entity,
      entityId: id,
      after: { name: input.name, isActive: input.isActive },
    });
  });
}

/**
 * Free-text brands awaiting promotion into the managed list.
 *
 * PLAN/02 §5 keeps the escape hatch on purpose: a managed list with no way in
 * would simply push people to pick the nearest wrong option, which is worse than
 * the spelling variants it was meant to fix.
 */
export async function listPendingBrandReviews(): Promise<PendingBrandReview[]> {
  const prisma = getPrisma();

  const [tireRows, vehicleRows] = await Promise.all([
    prisma.tireSpec.groupBy({
      by: ["brandOther"],
      where: { brandOther: { not: null } },
      _count: { brandOther: true },
      _min: { createdAt: true },
    }),
    prisma.vehicle.groupBy({
      by: ["vehicleBrandOther"],
      where: { vehicleBrandOther: { not: null }, deletedAt: null },
      _count: { vehicleBrandOther: true },
      _min: { createdAt: true },
    }),
  ]);

  const reviews: PendingBrandReview[] = [
    ...tireRows.map((row) => ({
      value: row.brandOther ?? "",
      occurrences: row._count.brandOther,
      firstSeenAt: row._min.createdAt?.toISOString() ?? "",
      source: "tire" as const,
    })),
    ...vehicleRows.map((row) => ({
      value: row.vehicleBrandOther ?? "",
      occurrences: row._count.vehicleBrandOther,
      firstSeenAt: row._min.createdAt?.toISOString() ?? "",
      source: "vehicle" as const,
    })),
  ];

  return reviews.sort((a, b) => b.occurrences - a.occurrences);
}
