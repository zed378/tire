import {
  createVehicleSchema,
  derivePositions,
  GENERAL_PHOTO_SLOTS,
  INSPECTION_STATUS_LABELS,
  isNewVehiclePayload,
  type CreateInspectionInput,
  type InspectionDetail,
  type InspectionListItem,
  type InspectionListQuery,
  type Paginated,
  type PreviewPositionsInput,
  type PreviewPositionsResult,
  type SaveDraftInput,
} from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { inspectionScope, type Actor } from "../../kernel/authorization.ts";
import { computeAxleResult } from "../../kernel/axle/index.ts";
import { getPrisma, withTransaction, type Tx } from "../../kernel/db.ts";
import type { Prisma } from "../../generated/prisma/index.js";
import { AppError, duplicatePlate } from "../../kernel/envelope/index.ts";
import {
  createOrAttachVehicle,
  findBlockingInspection,
  updateVehicle,
} from "../vehicles/index.ts";
import { transitionInspection } from "./status-machine.ts";

/**
 * Inspections (PLAN/03, PLAN/11).
 *
 * The four things this module exists to fix, all from PLAN/00 §2.2:
 *   D-04 — the axle detail is now checked against the declared count
 *   D-05 — plates are normalised and validated before they reach storage keys
 *   D-06 — a vehicle already under inspection cannot be submitted again
 *   D-10 — a supplier can finally see what happened to their own submissions
 */

const LIST_INCLUDE = {
  vehicle: {
    include: {
      city: { include: { province: { select: { name: true } } } },
      vehicleBrand: { select: { name: true } },
      axleConfigs: true,
    },
  },
  submittedBy: { select: { displayName: true } },
  _count: { select: { photos: true } },
  qcReviews: {
    orderBy: { reviewedAt: "desc" as const },
    take: 1,
    select: { notes: true, decision: true },
  },
} as const;

type InspectionRow = Prisma.InspectionGetPayload<{ include: typeof LIST_INCLUDE }>;

function toListItem(row: InspectionRow): InspectionListItem {
  return {
    id: Number(row.id),
    serialNumber: row.serialNumber,
    status: row.status,
    plateDisplay: row.vehicle.plateDisplay,
    cityName: row.vehicle.city.name,
    provinceName: row.vehicle.city.province.name,
    category: row.vehicle.category,
    totalTires: row.vehicle.totalTires,
    photoCount: row._count.photos,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    submittedByName: row.submittedBy.displayName,
    // Carried on the row so the reason travels with the item in the list, not
    // only on a detail page the supplier might never open (D-10, D-11).
    latestQcNotes:
      row.qcReviews[0]?.decision === "pass" ? null : (row.qcReviews[0]?.notes ?? null),
  };
}

// ── Position preview (PLAN/05 §6) ───────────────────────────────────────────

/**
 * Runs the engine server-side and returns the positions.
 *
 * The client derives the same list locally — it has to, because PLAN/06 §2 needs
 * photo slots generated offline — but the server is what decides (V-06). Both
 * call the same function from `@c26/contracts`, so they cannot disagree.
 */
export function previewPositions(input: PreviewPositionsInput): PreviewPositionsResult {
  const axle = computeAxleResult({ axleCount: input.axleCount, configs: input.axleConfigs });
  return {
    totalTires: axle.totalTires,
    positions: derivePositions(input.axleConfigs),
  };
}

// ── Listing ─────────────────────────────────────────────────────────────────

/**
 * D-01: in the legacy system the filters were rendered but never reached the
 * data. A date range of 2020 still returned a 2026 record, and the three counts
 * above it never moved. Here the filter IS the query.
 */
export async function listInspections(
  actor: Actor,
  query: InspectionListQuery,
): Promise<Paginated<InspectionListItem>> {
  const prisma = getPrisma();

  const where = {
    ...inspectionScope(actor),
    ...(query.status !== undefined ? { status: { in: query.status } } : {}),
    ...(query.submittedFrom !== undefined || query.submittedTo !== undefined
      ? {
          submittedAt: {
            ...(query.submittedFrom !== undefined ? { gte: new Date(query.submittedFrom) } : {}),
            ...(query.submittedTo !== undefined ? { lte: new Date(query.submittedTo) } : {}),
          },
        }
      : {}),
    ...(query.cityId !== undefined || query.provinceId !== undefined || query.q !== undefined
      ? {
          vehicle: {
            ...(query.cityId !== undefined ? { cityId: BigInt(query.cityId) } : {}),
            ...(query.provinceId !== undefined
              ? { city: { provinceId: BigInt(query.provinceId) } }
              : {}),
            ...(query.q !== undefined && query.q !== ""
              ? { plateKey: { contains: query.q.replace(/[^A-Za-z0-9]/g, "").toUpperCase() } }
              : {}),
          },
        }
      : {}),
  };

  const orderBy =
    query.sort === "created_asc"
      ? { createdAt: "asc" as const }
      : query.sort === "submitted_desc"
        ? { submittedAt: "desc" as const }
        : query.sort === "submitted_asc"
          ? { submittedAt: "asc" as const }
          : { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.inspection.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy,
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    prisma.inspection.count({ where }),
  ]);

  return {
    items: rows.map(toListItem),
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

export async function getInspectionDetail(
  actor: Actor,
  serialNumber: string,
): Promise<InspectionDetail> {
  const prisma = getPrisma();

  const row = await prisma.inspection.findFirst({
    where: { serialNumber, ...inspectionScope(actor) },
    include: {
      ...LIST_INCLUDE,
      tirePositions: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { photos: true } },
          tireSpec: { select: { pattern: true, size: true, tireBrandId: true, brandOther: true } },
        },
      },
      photos: {
        where: { deletedAt: null, slot: { in: [...GENERAL_PHOTO_SLOTS] } },
        select: { id: true, slot: true },
      },
    },
  });

  if (row === null) throw new AppError("NOT_FOUND");

  const positions = row.tirePositions.map((position) => ({
    id: Number(position.id),
    positionCode: position.positionCode,
    positionLabel: position.positionLabel,
    axleType: position.axleType,
    axleIndex: position.axleIndex,
    side: position.side,
    depth: position.depth,
    sortOrder: position.sortOrder,
    photoCount: position._count.photos,
    hasSpec:
      position.tireSpec !== null &&
      position.tireSpec.pattern !== null &&
      position.tireSpec.size !== null &&
      (position.tireSpec.tireBrandId !== null || position.tireSpec.brandOther !== null),
  }));

  const filled = positions.filter((p) => p.hasSpec).length;
  const blocked = await computeSubmitBlocker(row.id, row.vehicleId, row.status, positions);

  const generalPhotos = GENERAL_PHOTO_SLOTS.map((slot) => ({
    slot,
    photoIds: row.photos.filter((photo) => photo.slot === slot).map((photo) => Number(photo.id)),
  }));

  return {
    ...toListItem(row),
    vehicleId: Number(row.vehicleId),
    chassisNumber: row.vehicle.chassisNumber,
    segment: row.vehicle.segment,
    subSegment: row.vehicle.subSegment,
    vehicleBrandName: row.vehicle.vehicleBrand?.name ?? row.vehicle.vehicleBrandOther ?? null,
    cargoType: row.vehicle.cargoType,
    axleCount: row.vehicle.axleCount,
    axleConfigs: row.vehicle.axleConfigs.map((config) => ({
      axleType: config.axleType,
      axleCount: config.axleCount,
      mounting: config.mounting,
    })),
    tirePositions: positions,
    generalPhotos,
    specProgress: { filled, total: positions.length },
    canSubmit: blocked === null,
    submitBlockedReason: blocked,
  };
}

/**
 * Why the submit button is disabled, in Indonesian, ready to render.
 *
 * PLAN/06 §2 makes this a product decision worth stating: submission waits for
 * the photos to finish uploading. The alternative — submit now, photos follow —
 * puts half-finished inspections in the QC queue with no evidence attached, and
 * an admin cannot tell those apart from ones that genuinely have no photos.
 */
async function computeSubmitBlocker(
  inspectionId: bigint,
  vehicleId: bigint,
  status: string,
  positions: { photoCount: number }[],
): Promise<string | null> {
  if (status !== "draft" && status !== "needs_revision") {
    return `Pengajuan berstatus ${INSPECTION_STATUS_LABELS[status as keyof typeof INSPECTION_STATUS_LABELS]} tidak dapat dikirim.`;
  }

  const withoutPhotos = positions.filter((position) => position.photoCount === 0).length;
  if (withoutPhotos > 0) {
    const done = positions.length - withoutPhotos;
    return `${done} dari ${positions.length} posisi ban sudah ada fotonya. Lengkapi sisanya sebelum mengirim.`;
  }

  const pending = await getPrisma().pendingUpload.count({ where: { inspectionId } });
  if (pending > 0) return `${pending} foto masih menunggu selesai diunggah.`;

  // V-08 is checked on the submit transition, not when the draft is saved
  // (PLAN/11 §5.6): a locking draft would hold a plate hostage forever, and
  // abandoned drafts are constant in field work.
  const blocking = await findBlockingInspection(getPrisma(), vehicleId);
  if (blocking !== null && blocking.serialNumber !== undefined) {
    const own = await getPrisma().inspection.findFirst({
      where: { id: inspectionId, serialNumber: blocking.serialNumber },
    });
    if (own === null) {
      return `Kendaraan ini sedang dalam pemeriksaan ${blocking.serialNumber} (${blocking.statusLabel}).`;
    }
  }

  return null;
}

// ── Creating ────────────────────────────────────────────────────────────────

async function nextSerialNumber(tx: Tx): Promise<{ serialNumber: string; year: number; seq: number }> {
  const year = new Date().getFullYear();
  // Atomic. B-03: in Sheets, two suppliers submitting at once could receive the
  // same number. ON CONFLICT DO UPDATE ... RETURNING locks the year row, so the
  // database guarantees two different numbers rather than the application hoping.
  //
  // The `::int` cast is required, not cosmetic: Prisma binds a JS number as
  // int8, the function takes int4, and PostgreSQL then reports that
  // next_serial_number(bigint) does not exist.
  const rows = await tx.$queryRaw<{ serial_number: string; serial_year: number; serial_seq: number }[]>`
    SELECT * FROM next_serial_number(${year}::int)
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("next_serial_number returned no row");
  return { serialNumber: row.serial_number, year: row.serial_year, seq: row.serial_seq };
}

export async function createInspection(
  actor: Actor,
  auditActor: AuditActor,
  input: CreateInspectionInput,
): Promise<{ serialNumber: string; id: number; attachedToExistingVehicle: boolean }> {
  return withTransaction(async (tx) => {
    let vehicleId: bigint;
    let attachedToExisting = false;

    if (isNewVehiclePayload(input)) {
      const parsed = createVehicleSchema.parse(input.newVehicle);
      const result = await createOrAttachVehicle(tx, actor, auditActor, parsed);
      vehicleId = result.vehicleId;
      attachedToExisting = result.attachedToExisting;
    } else {
      vehicleId = BigInt(input.vehicleId);
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, deletedAt: null },
        select: { id: true },
      });
      if (vehicle === null) throw new AppError("NOT_FOUND");

      if (input.vehicleUpdate !== undefined) {
        await updateVehicle(tx, actor, auditActor, vehicleId, input.vehicleUpdate);
      }
      attachedToExisting = true;
    }

    const serial = await nextSerialNumber(tx);

    const inspection = await tx.inspection.create({
      data: {
        vehicleId,
        serialNumber: serial.serialNumber,
        serialYear: serial.year,
        serialSeq: serial.seq,
        submittedById: actor.id,
        // Starts as a draft, always. The tire positions exist immediately so the
        // photo slots can be filled offline before anything is sent.
        status: "draft",
      },
      select: { id: true },
    });

    await materialiseTirePositions(tx, inspection.id, vehicleId);

    await recordAudit(tx, auditActor, {
      action: "inspection.created",
      entity: "inspection",
      entityId: inspection.id,
      after: { serialNumber: serial.serialNumber, vehicleId: vehicleId.toString() },
    });

    return {
      id: Number(inspection.id),
      serialNumber: serial.serialNumber,
      attachedToExistingVehicle: attachedToExisting,
    };
  });
}

/**
 * Snapshots the vehicle's axle configuration into `tire_positions`.
 *
 * Positions belong to the inspection, not the vehicle, so correcting a vehicle's
 * configuration later never relabels photographs already taken against the old
 * one. These rows are never typed by a human: they come from the engine, and
 * PLAN/03 §1 forbids any other code from building a position name.
 */
export async function materialiseTirePositions(
  tx: Tx,
  inspectionId: bigint,
  vehicleId: bigint,
): Promise<number> {
  const vehicle = await tx.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    include: { axleConfigs: true },
  });

  const axle = computeAxleResult({
    axleCount: vehicle.axleCount,
    configs: vehicle.axleConfigs.map((config) => ({
      axleType: config.axleType,
      axleCount: config.axleCount,
      mounting: config.mounting,
    })),
  });

  await tx.tirePosition.deleteMany({ where: { inspectionId } });
  await tx.tirePosition.createMany({
    data: axle.positions.map((position) => ({ inspectionId, ...position })),
  });

  return axle.positions.length;
}

export async function saveDraft(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  input: SaveDraftInput,
): Promise<void> {
  await withTransaction(async (tx) => {
    const inspection = await tx.inspection.findFirst({
      where: { serialNumber, deletedAt: null },
      select: { id: true, status: true, submittedById: true, vehicleId: true },
    });
    if (inspection === null) throw new AppError("NOT_FOUND");
    if (inspection.submittedById !== actor.id) throw new AppError("NOT_FOUND");

    if (inspection.status !== "draft" && inspection.status !== "needs_revision") {
      throw new AppError("INVALID_STATE_TRANSITION", {
        message: "Pengajuan ini tidak dapat diubah lagi.",
      });
    }

    if (input.vehicleUpdate !== undefined) {
      await updateVehicle(tx, actor, auditActor, inspection.vehicleId, input.vehicleUpdate);
      // The configuration may have changed, so the positions are rebuilt. Photos
      // already attached to a position that no longer exists are removed by the
      // ON DELETE CASCADE, which is why the UI warns before an axle edit.
      await materialiseTirePositions(tx, inspection.id, inspection.vehicleId);
    }

    if (input.notes !== undefined) {
      await tx.inspection.update({ where: { id: inspection.id }, data: { notes: input.notes } });
    }
  });
}

/** Submitting, or resubmitting after a revision. */
export async function submitInspection(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
): Promise<{ status: string }> {
  return withTransaction(async (tx) => {
    const inspection = await tx.inspection.findFirst({
      where: { serialNumber, deletedAt: null },
      select: { id: true, vehicleId: true, status: true, submittedById: true },
    });
    if (inspection === null) throw new AppError("NOT_FOUND");
    if (inspection.submittedById !== actor.id) throw new AppError("NOT_FOUND");

    // V-08, checked here rather than at draft save (PLAN/11 §5.6). Reported with
    // the blocking Serial Number, because "duplicate" on its own gives the
    // supplier nothing to act on.
    const blocking = await findBlockingInspection(tx, inspection.vehicleId);
    if (blocking !== null) {
      const isSelf = await tx.inspection.findFirst({
        where: { id: inspection.id, serialNumber: blocking.serialNumber },
        select: { id: true },
      });
      if (isSelf === null) {
        const vehicle = await tx.vehicle.findUniqueOrThrow({
          where: { id: inspection.vehicleId },
          select: { plateDisplay: true },
        });
        throw duplicatePlate({
          plateDisplay: vehicle.plateDisplay,
          serialNumber: blocking.serialNumber,
          statusLabel: blocking.statusLabel,
        });
      }
    }

    const positions = await tx.tirePosition.findMany({
      where: { inspectionId: inspection.id },
      select: { id: true, positionLabel: true, _count: { select: { photos: true } } },
    });

    const missing = positions.filter((position) => position._count.photos === 0);
    if (missing.length > 0) {
      throw new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "photos",
            code: "REQUIRED",
            message: `${positions.length - missing.length} dari ${positions.length} posisi ban sudah ada fotonya. Lengkapi: ${missing
              .slice(0, 3)
              .map((m) => m.positionLabel)
              .join(", ")}${missing.length > 3 ? `, dan ${missing.length - 3} lainnya` : ""}.`,
          },
        ],
      });
    }

    const result = await transitionInspection(tx, actor, auditActor, {
      inspectionId: inspection.id,
      to: "pending_qc",
    });

    return { status: result.to };
  });
}
