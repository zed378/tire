import {
  INSPECTION_STATUS_LABELS,
  LOCKING_STATUSES,
  plateKeyOf,
  type CreateVehicleOutput,
  type VehicleSearchInput,
  type VehicleSummary,
} from "@c26/contracts";
import { changedFields, recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { assertCityInScope, vehicleScope, type Actor } from "../../kernel/authorization.ts";
import { computeAxleResult } from "../../kernel/axle/index.ts";
import { getPrisma, type Tx } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import { publishEvent } from "../../kernel/outbox.ts";

/**
 * Vehicle identity (PLAN/11).
 *
 * The separation of vehicle from inspection is what makes "every vehicle is
 * unique" expressible at all. It also pays for itself in field time: a supplier
 * doing a repeat inspection no longer retypes the segmentation and axle
 * configuration, which shrinks D-04's attack surface to first registration only.
 */

const VEHICLE_INCLUDE = {
  city: { include: { province: { select: { id: true, name: true } } } },
  vehicleBrand: { select: { name: true } },
  axleConfigs: true,
} as const;

type VehicleWithRelations = {
  id: bigint;
  plateDisplay: string;
  plateKey: string;
  chassisNumber: string | null;
  category: VehicleSummary["category"];
  segment: VehicleSummary["segment"];
  subSegment: string;
  cargoType: string;
  cityId: bigint;
  axleCount: number;
  totalTires: number;
  needsReview: boolean;
  city: { name: string; province: { name: string } };
  vehicleBrand: { name: string } | null;
};

async function toSummary(vehicle: VehicleWithRelations): Promise<VehicleSummary> {
  const prisma = getPrisma();

  const [latest, count] = await Promise.all([
    prisma.inspection.findFirst({
      where: { vehicleId: vehicle.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { serialNumber: true, status: true, submittedAt: true, createdAt: true },
    }),
    prisma.inspection.count({ where: { vehicleId: vehicle.id, deletedAt: null } }),
  ]);

  return {
    id: Number(vehicle.id),
    plateDisplay: vehicle.plateDisplay,
    plateKey: vehicle.plateKey,
    chassisNumber: vehicle.chassisNumber,
    category: vehicle.category,
    segment: vehicle.segment,
    subSegment: vehicle.subSegment,
    vehicleBrandName: vehicle.vehicleBrand?.name ?? null,
    cargoType: vehicle.cargoType,
    cityId: Number(vehicle.cityId),
    cityName: vehicle.city.name,
    provinceName: vehicle.city.province.name,
    axleCount: vehicle.axleCount,
    totalTires: vehicle.totalTires,
    lastInspectedAt: (latest?.submittedAt ?? latest?.createdAt)?.toISOString() ?? null,
    lastInspectionStatus: latest === null ? null : INSPECTION_STATUS_LABELS[latest.status],
    lastInspectionSerialNumber: latest?.serialNumber ?? null,
    inspectionCount: count,
    needsReview: vehicle.needsReview,
  };
}

/**
 * Search, scoped and rate-limited.
 *
 * Matching happens on `plate_key`, so whether the supplier types spaces makes no
 * difference. A supplier only sees vehicles they have inspected (PLAN/11 §6
 * rule 3): if every supplier could browse the whole fleet by plate, the system
 * would become a directory of the customer's vehicles. PLAN/13 §6 rate-limits
 * this endpoint for the same reason.
 */
export async function searchVehicles(
  actor: Actor,
  input: VehicleSearchInput,
): Promise<VehicleSummary[]> {
  const scope = vehicleScope(actor);

  const where =
    input.chassisNumber !== undefined && input.chassisNumber !== ""
      ? // Chassis lookup is exact and deliberately not scoped: it is the stable
        // identity, and an exact 5+ character match is not a browsing tool.
        { deletedAt: null, chassisNumber: input.chassisNumber.toUpperCase() }
      : { ...scope, plateKey: { contains: plateKeyOf(input.plate ?? "") } };

  const vehicles = await getPrisma().vehicle.findMany({
    where,
    include: VEHICLE_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return Promise.all(vehicles.map(toSummary));
}

export async function getVehicle(actor: Actor, vehicleId: bigint): Promise<VehicleSummary> {
  const vehicle = await getPrisma().vehicle.findFirst({
    where: { id: vehicleId, ...vehicleScope(actor) },
    include: VEHICLE_INCLUDE,
  });
  if (vehicle === null) throw new AppError("NOT_FOUND");
  return toSummary(vehicle);
}

/**
 * Reports whether a vehicle currently blocks a new inspection (V-08).
 *
 * Returns the blocking Serial Number so the caller can say which one, rather
 * than telling the supplier "duplicate" and leaving them nothing to act on.
 */
export async function findBlockingInspection(
  tx: Tx,
  vehicleId: bigint,
): Promise<{ serialNumber: string; statusLabel: string } | null> {
  const blocking = await tx.inspection.findFirst({
    where: {
      vehicleId,
      deletedAt: null,
      status: { in: [...LOCKING_STATUSES] },
    },
    select: { serialNumber: true, status: true },
  });

  if (blocking === null) return null;
  return {
    serialNumber: blocking.serialNumber,
    statusLabel: INSPECTION_STATUS_LABELS[blocking.status],
  };
}

/**
 * Creates a vehicle, or attaches to the existing one with the same plate.
 *
 * Q-12 answered with option (c): if the plate already belongs to a vehicle
 * another supplier registered, the inspection is allowed and the vehicle is
 * flagged for an admin to look at. Rejecting outright would block any fleet
 * served by more than one supplier; silently merging would hide a genuine
 * data-quality signal.
 */
export async function createOrAttachVehicle(
  tx: Tx,
  actor: Actor,
  auditActor: AuditActor,
  input: CreateVehicleOutput,
): Promise<{ vehicleId: bigint; attachedToExisting: boolean }> {
  const city = await tx.city.findFirst({
    where: { id: BigInt(input.cityId), isActive: true },
    select: { id: true, provinceId: true },
  });
  if (city === null) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [{ field: "cityId", code: "NOT_ALLOWED", message: "Kota tidak ditemukan." }],
    });
  }

  // V-12
  assertCityInScope(actor, { id: city.id, provinceId: city.provinceId });

  // V-06: the server derives the tire count and the positions. Whatever the
  // client computed for its preview is never trusted.
  const axle = computeAxleResult({ axleCount: input.axleCount, configs: input.axleConfigs });

  const plateKey = plateKeyOf(input.plateDisplay);
  const existing = await tx.vehicle.findFirst({
    where: { plateKey, deletedAt: null },
    select: { id: true, createdById: true, plateDisplay: true },
  });

  if (existing !== null) {
    const otherSupplier = existing.createdById !== actor.id && actor.role === "supplier";

    if (otherSupplier) {
      await tx.vehicle.update({
        where: { id: existing.id },
        data: {
          needsReview: true,
          reviewNote: `Diperiksa oleh supplier lain (${actor.username}) pada ${new Date().toISOString()}.`,
        },
      });

      await recordAudit(tx, auditActor, {
        action: "vehicle.flagged_for_review",
        entity: "vehicle",
        entityId: existing.id,
        after: { reason: "inspected_by_other_supplier", supplier: actor.username },
      });

      await publishEvent(tx, { id: actor.id, requestId: auditActor.requestId }, {
        type: "vehicle.duplicate_suspected",
        aggregateId: existing.id,
        payload: {
          vehicleId: existing.id.toString(),
          plateDisplay: existing.plateDisplay,
          supplierName: actor.displayName,
        },
      });
    }

    return { vehicleId: existing.id, attachedToExisting: true };
  }

  const vehicle = await tx.vehicle.create({
    data: {
      plateDisplay: input.plateDisplay,
      chassisNumber: input.chassisNumber ?? null,
      category: input.category,
      segment: input.segment,
      subSegment: input.subSegment,
      vehicleBrandId: input.vehicleBrandId === null || input.vehicleBrandId === undefined
        ? null
        : BigInt(input.vehicleBrandId),
      vehicleBrandOther: input.vehicleBrandOther ?? null,
      cargoType: input.cargoType,
      cityId: city.id,
      axleCount: input.axleCount,
      totalTires: axle.totalTires,
      createdById: actor.id,
      axleConfigs: {
        create: input.axleConfigs
          .filter((config) => config.axleCount > 0)
          .map((config) => ({
            axleType: config.axleType,
            axleCount: config.axleCount,
            mounting: config.mounting,
          })),
      },
    },
    select: { id: true, plateDisplay: true },
  });

  await recordAudit(tx, auditActor, {
    action: "vehicle.created",
    entity: "vehicle",
    entityId: vehicle.id,
    after: {
      plateDisplay: vehicle.plateDisplay,
      category: input.category,
      axleCount: input.axleCount,
      totalTires: axle.totalTires,
    },
  });

  return { vehicleId: vehicle.id, attachedToExisting: false };
}

/**
 * Applies a correction to an existing vehicle.
 *
 * A plate change is recorded by a database trigger into
 * `vehicle_plate_history`, so a transfer between regions explains itself rather
 * than splitting the vehicle's history in two.
 */
export async function updateVehicle(
  tx: Tx,
  actor: Actor,
  auditActor: AuditActor,
  vehicleId: bigint,
  input: Partial<CreateVehicleOutput>,
): Promise<void> {
  const before = await tx.vehicle.findFirst({
    where: { id: vehicleId, deletedAt: null },
    include: { axleConfigs: true },
  });
  if (before === null) throw new AppError("NOT_FOUND");

  let totalTires = before.totalTires;

  if (input.axleConfigs !== undefined && input.axleCount !== undefined) {
    const axle = computeAxleResult({ axleCount: input.axleCount, configs: input.axleConfigs });
    totalTires = axle.totalTires;

    await tx.axleConfig.deleteMany({ where: { vehicleId } });
    await tx.axleConfig.createMany({
      data: input.axleConfigs
        .filter((config) => config.axleCount > 0)
        .map((config) => ({
          vehicleId,
          axleType: config.axleType,
          axleCount: config.axleCount,
          mounting: config.mounting,
        })),
    });
  }

  if (input.cityId !== undefined) {
    const city = await tx.city.findFirstOrThrow({
      where: { id: BigInt(input.cityId) },
      select: { id: true, provinceId: true },
    });
    assertCityInScope(actor, city);
  }

  const updated = await tx.vehicle.update({
    where: { id: vehicleId },
    data: {
      plateDisplay: input.plateDisplay,
      chassisNumber: input.chassisNumber,
      category: input.category,
      segment: input.segment,
      subSegment: input.subSegment,
      vehicleBrandId:
        input.vehicleBrandId === undefined
          ? undefined
          : input.vehicleBrandId === null
            ? null
            : BigInt(input.vehicleBrandId),
      vehicleBrandOther: input.vehicleBrandOther,
      cargoType: input.cargoType,
      cityId: input.cityId === undefined ? undefined : BigInt(input.cityId),
      axleCount: input.axleCount,
      totalTires,
    },
  });

  const diff = changedFields(
    {
      plateDisplay: before.plateDisplay,
      chassisNumber: before.chassisNumber,
      category: before.category,
      segment: before.segment,
      subSegment: before.subSegment,
      cargoType: before.cargoType,
      axleCount: before.axleCount,
      totalTires: before.totalTires,
    },
    {
      plateDisplay: updated.plateDisplay,
      chassisNumber: updated.chassisNumber,
      category: updated.category,
      segment: updated.segment,
      subSegment: updated.subSegment,
      cargoType: updated.cargoType,
      axleCount: updated.axleCount,
      totalTires: updated.totalTires,
    },
  );

  if (Object.keys(diff.after).length === 0) return;

  await recordAudit(tx, auditActor, {
    action: before.plateDisplay !== updated.plateDisplay ? "vehicle.plate_changed" : "vehicle.updated",
    entity: "vehicle",
    entityId: vehicleId,
    before: diff.before,
    after: diff.after,
  });
}
