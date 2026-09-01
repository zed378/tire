import type {
  CopyTireSpecInput,
  SaveTireSpecsInput,
  TireSpecRecord,
  TireSpecSheet,
} from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { inspectionScope, type Actor } from "../../kernel/authorization.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";

/**
 * Tire specifications (PLAN/02 §8.2, PLAN/03 §7.3).
 *
 * The gate here is the one the legacy system only pretended to have. It filtered
 * its dropdown to Serial Numbers marked Pass QC, which is a display filter, not
 * enforcement — a request made directly to the server went straight through.
 * Every write below verifies `status = 'passed_qc'` and refuses otherwise.
 */

function isComplete(spec: {
  pattern: string | null;
  size: string | null;
  tireBrandId: bigint | null;
  brandOther: string | null;
}): boolean {
  return (
    spec.pattern !== null &&
    spec.size !== null &&
    (spec.tireBrandId !== null || spec.brandOther !== null)
  );
}

async function loadInspection(actor: Actor, serialNumber: string) {
  const inspection = await getPrisma().inspection.findFirst({
    where: { serialNumber, ...inspectionScope(actor) },
    select: { id: true, status: true, serialNumber: true, vehicle: { select: { plateDisplay: true } } },
  });
  if (inspection === null) throw new AppError("NOT_FOUND");
  return inspection;
}

export async function getSheet(actor: Actor, serialNumber: string): Promise<TireSpecSheet> {
  const inspection = await loadInspection(actor, serialNumber);

  const positions = await getPrisma().tirePosition.findMany({
    where: { inspectionId: inspection.id },
    orderBy: { sortOrder: "asc" },
    include: {
      tireSpec: {
        include: {
          tireBrand: { select: { name: true } },
          filledBy: { select: { displayName: true } },
        },
      },
    },
  });

  const specs: TireSpecRecord[] = positions.map((position) => {
    const spec = position.tireSpec;
    return {
      tirePositionId: Number(position.id),
      positionCode: position.positionCode,
      positionLabel: position.positionLabel,
      sortOrder: position.sortOrder,
      tireBrandId: spec?.tireBrandId === undefined || spec.tireBrandId === null ? null : Number(spec.tireBrandId),
      tireBrandName: spec?.tireBrand?.name ?? null,
      brandOther: spec?.brandOther ?? null,
      pattern: spec?.pattern ?? null,
      size: spec?.size ?? null,
      plyRating: spec?.plyRating ?? null,
      isRetread: spec?.isRetread ?? false,
      filledByName: spec?.filledBy?.displayName ?? null,
      filledAt: spec?.filledAt?.toISOString() ?? null,
      isComplete:
        spec === null || spec === undefined
          ? false
          : isComplete({
              pattern: spec.pattern,
              size: spec.size,
              tireBrandId: spec.tireBrandId,
              brandOther: spec.brandOther,
            }),
    };
  });

  return {
    serialNumber: inspection.serialNumber,
    plateDisplay: inspection.vehicle.plateDisplay,
    status: inspection.status,
    editable: inspection.status === "passed_qc",
    specs,
    // Completeness is derived, never stored (PLAN/02 §8.2). Partial, staged
    // entry is real practice: an admin fills what the photographs show and
    // returns later.
    progress: { filled: specs.filter((s) => s.isComplete).length, total: specs.length },
  };
}

function assertEditable(status: string): void {
  if (status !== "passed_qc") {
    throw new AppError("INVALID_STATE_TRANSITION", {
      message: "Spesifikasi ban hanya dapat diisi untuk pengajuan berstatus Pass QC.",
      context: { status },
    });
  }
}

export async function saveSpecs(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  input: SaveTireSpecsInput,
): Promise<{ saved: number; progress: { filled: number; total: number } }> {
  const inspection = await loadInspection(actor, serialNumber);
  assertEditable(inspection.status);

  await withTransaction(async (tx) => {
    const positionIds = input.specs.map((spec) => BigInt(spec.tirePositionId));
    const owned = await tx.tirePosition.findMany({
      where: { id: { in: positionIds }, inspectionId: inspection.id },
      select: { id: true },
    });

    // A position id from another inspection is not a permission problem to
    // explain, it is simply not there.
    if (owned.length !== positionIds.length) throw new AppError("NOT_FOUND");

    for (const spec of input.specs) {
      const data = {
        tireBrandId:
          spec.tireBrandId === null || spec.tireBrandId === undefined
            ? null
            : BigInt(spec.tireBrandId),
        brandOther: spec.brandOther ?? null,
        pattern: spec.pattern ?? null,
        size: spec.size ?? null,
        plyRating: spec.plyRating ?? null,
        isRetread: spec.isRetread,
        filledById: actor.id,
        filledAt: new Date(),
      };

      await tx.tireSpec.upsert({
        where: { tirePositionId: BigInt(spec.tirePositionId) },
        create: { tirePositionId: BigInt(spec.tirePositionId), ...data },
        update: data,
      });
    }

    await recordAudit(tx, auditActor, {
      action: "tirespec.updated",
      entity: "inspection",
      entityId: inspection.id,
      after: { positionsUpdated: input.specs.length },
    });
  });

  const sheet = await getSheet(actor, serialNumber);
  return { saved: input.specs.length, progress: sheet.progress };
}

/**
 * Copy one position's specification onto others — new in the rewrite.
 *
 * On a 22-position vehicle whose tires are all the same model, retyping five
 * fields twenty-two times is the kind of friction that stops people filling the
 * form properly at all. Only the named fields are copied, so a destination's
 * other values are left alone.
 */
export async function copySpec(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  input: CopyTireSpecInput,
): Promise<{ copiedTo: number }> {
  const inspection = await loadInspection(actor, serialNumber);
  assertEditable(inspection.status);

  return withTransaction(async (tx) => {
    const source = await tx.tireSpec.findFirst({
      where: {
        tirePositionId: BigInt(input.fromTirePositionId),
        tirePosition: { inspectionId: inspection.id },
      },
    });
    if (source === null) throw new AppError("NOT_FOUND");

    const targets = await tx.tirePosition.findMany({
      where: {
        id: { in: input.toTirePositionIds.map((id) => BigInt(id)) },
        inspectionId: inspection.id,
      },
      select: { id: true },
    });

    const copied: Record<string, unknown> = {};
    for (const field of input.fields) copied[field] = source[field];

    for (const target of targets) {
      await tx.tireSpec.upsert({
        where: { tirePositionId: target.id },
        create: {
          tirePositionId: target.id,
          ...copied,
          filledById: actor.id,
          filledAt: new Date(),
        },
        update: { ...copied, filledById: actor.id, filledAt: new Date() },
      });
    }

    await recordAudit(tx, auditActor, {
      action: "tirespec.updated",
      entity: "inspection",
      entityId: inspection.id,
      after: {
        copiedFrom: input.fromTirePositionId,
        copiedTo: targets.length,
        fields: input.fields,
      },
    });

    return { copiedTo: targets.length };
  });
}
