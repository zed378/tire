import { randomUUID } from "node:crypto";
import {
  buildStorageKey,
  MAX_PHOTOS_PER_INSPECTION,
  MAX_PHOTOS_PER_SLOT,
  type ConfirmUploadInput,
  type PhotoRecord,
  type PresignInput,
  type PresignResult,
} from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { inspectionScope, type Actor } from "../../kernel/authorization.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import { JOB_NAMES, sendInTransaction } from "../../kernel/queue.ts";
import { headObject, presignDownload, presignUpload } from "../../kernel/storage.ts";

/**
 * Photo upload (PLAN/05 §7, PLAN/06).
 *
 * Photos never pass through this server. It decides whether an upload is
 * allowed, hands back a 10-minute presigned URL, and records what actually
 * landed. At 18,000 uploads a month, proxying the bytes would spend bandwidth
 * and memory for nothing.
 *
 * The checksum is what makes the offline queue safe. A retry after a dropped
 * connection re-presents the same SHA-256, and the row that already exists is
 * returned instead of a duplicate being written.
 */

async function loadEditableInspection(actor: Actor, serialNumber: string) {
  const inspection = await getPrisma().inspection.findFirst({
    where: { serialNumber, ...inspectionScope(actor) },
    select: { id: true, serialNumber: true, serialYear: true, status: true, submittedById: true },
  });

  if (inspection === null) throw new AppError("NOT_FOUND");
  if (actor.role === "supplier" && inspection.submittedById !== actor.id) {
    throw new AppError("NOT_FOUND");
  }
  if (inspection.status !== "draft" && inspection.status !== "needs_revision") {
    throw new AppError("INVALID_STATE_TRANSITION", {
      message: "Foto hanya dapat diunggah saat pengajuan berstatus Draf atau Perlu Revisi.",
    });
  }

  return inspection;
}

export async function presign(
  actor: Actor,
  serialNumber: string,
  input: PresignInput,
): Promise<PresignResult> {
  const prisma = getPrisma();
  const inspection = await loadEditableInspection(actor, serialNumber);

  // ck_slot_position in the database says the same thing; saying it here first
  // gives the user a field-level message instead of a translated constraint.
  if ((input.slot === "tire_position") !== (input.tirePositionId !== undefined)) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "tirePositionId",
          code: "NOT_ALLOWED",
          message: "Slot foto posisi ban wajib menyebut posisinya; slot umum tidak boleh.",
        },
      ],
    });
  }

  let positionCode: string | null = null;
  if (input.tirePositionId !== undefined) {
    const position = await prisma.tirePosition.findFirst({
      where: { id: BigInt(input.tirePositionId), inspectionId: inspection.id },
      select: { positionCode: true },
    });
    if (position === null) throw new AppError("NOT_FOUND");
    positionCode = position.positionCode;
  }

  // Deduplication before anything else: an offline queue retry must cost nothing
  // and must not produce a second row (PLAN/06 §4.1).
  const existing = await prisma.photo.findFirst({
    where: {
      inspectionId: inspection.id,
      checksumSha256: input.checksumSha256.toLowerCase(),
      deletedAt: null,
    },
    select: { id: true, storageKey: true },
  });

  if (existing !== null) {
    return {
      uploadUrl: "",
      storageKey: existing.storageKey,
      expiresAt: new Date().toISOString(),
      alreadyUploaded: true,
      existingPhotoId: Number(existing.id),
    };
  }

  await assertQuota(inspection.id, input);

  const storageKey = buildStorageKey({
    year: inspection.serialYear,
    serialNumber: inspection.serialNumber,
    slot: input.slot,
    // Built from the position CODE, never the Indonesian label. The legacy
    // system used the label as its Drive path, which made every wording fix in
    // the UI a risk to photo matching (PLAN/03 §2.3).
    positionCode,
    uuid: randomUUID(),
    mimeType: input.mimeType,
  });

  const signed = await presignUpload({
    storageKey,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    checksumSha256: input.checksumSha256,
  });

  await prisma.pendingUpload.create({
    data: {
      storageKey,
      inspectionId: inspection.id,
      tirePositionId: input.tirePositionId === undefined ? null : BigInt(input.tirePositionId),
      slot: input.slot,
      checksumSha256: input.checksumSha256.toLowerCase(),
      byteSize: input.byteSize,
      mimeType: input.mimeType,
      requestedById: actor.id,
      expiresAt: signed.expiresAt,
    },
  });

  return {
    uploadUrl: signed.url,
    storageKey,
    expiresAt: signed.expiresAt.toISOString(),
    alreadyUploaded: false,
    existingPhotoId: null,
  };
}

/**
 * The two photo caps (K-06 and PLAN/06 §6).
 *
 * `trg_photo_limit` enforces both in the database as well. Checking here first
 * is what turns a constraint violation into a message the user can act on.
 */
async function assertQuota(inspectionId: bigint, input: PresignInput): Promise<void> {
  const prisma = getPrisma();

  const [slotCount, totalCount] = await Promise.all([
    prisma.photo.count({
      where: {
        inspectionId,
        slot: input.slot,
        tirePositionId:
          input.tirePositionId === undefined ? null : BigInt(input.tirePositionId),
        deletedAt: null,
      },
    }),
    prisma.photo.count({ where: { inspectionId, deletedAt: null } }),
  ]);

  if (slotCount >= MAX_PHOTOS_PER_SLOT) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "photos",
          code: "PHOTO_LIMIT_EXCEEDED",
          message: `Maksimal ${MAX_PHOTOS_PER_SLOT} foto per slot.`,
        },
      ],
    });
  }

  // New in the rewrite. Ten per slot restrains nothing once a 6-axle vehicle has
  // 22 positions: that is the difference between 84 GB and 562 GB a year.
  if (totalCount >= MAX_PHOTOS_PER_INSPECTION) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "photos",
          code: "PHOTO_LIMIT_EXCEEDED",
          message: `Maksimal ${MAX_PHOTOS_PER_INSPECTION} foto per pengajuan.`,
        },
      ],
    });
  }
}

export async function confirmUpload(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  input: ConfirmUploadInput,
): Promise<{ photoId: number }> {
  const inspection = await loadEditableInspection(actor, serialNumber);

  const pending = await getPrisma().pendingUpload.findUnique({
    where: { storageKey: input.storageKey },
  });
  if (pending === null || pending.inspectionId !== inspection.id) throw new AppError("NOT_FOUND");

  // The object is verified to exist before a row claims it does. Without this,
  // a failed PUT would leave an inspection that looks complete and has no
  // evidence behind it.
  const object = await headObject(input.storageKey);
  if (object === null) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "photos",
          code: "NOT_ALLOWED",
          message: "Foto belum selesai terunggah. Coba unggah ulang.",
        },
      ],
    });
  }

  return withTransaction(async (tx) => {
    const photo = await tx.photo.create({
      data: {
        inspectionId: inspection.id,
        tirePositionId: pending.tirePositionId,
        slot: pending.slot,
        storageKey: input.storageKey,
        checksumSha256: input.checksumSha256.toLowerCase(),
        byteSize: object.byteSize,
        mimeType: pending.mimeType,
        width: input.width ?? null,
        height: input.height ?? null,
        // EXIF capture time only; GPS is discarded on the device (PLAN/06 §3.1).
        capturedAt: input.capturedAt === null || input.capturedAt === undefined
          ? null
          : new Date(input.capturedAt),
        uploadedById: actor.id,
      },
      select: { id: true },
    });

    await tx.pendingUpload.delete({ where: { storageKey: input.storageKey } });

    await recordAudit(tx, auditActor, {
      action: "photo.uploaded",
      entity: "photo",
      entityId: photo.id,
      after: { inspectionId: inspection.id.toString(), slot: pending.slot },
    });

    await sendInTransaction(tx, JOB_NAMES.photoThumbnail, { photoId: photo.id.toString() });

    return { photoId: Number(photo.id) };
  });
}

export async function listPhotos(
  actor: Actor,
  serialNumber: string,
): Promise<PhotoRecord[]> {
  const inspection = await getPrisma().inspection.findFirst({
    where: { serialNumber, ...inspectionScope(actor) },
    select: { id: true },
  });
  if (inspection === null) throw new AppError("NOT_FOUND");

  const photos = await getPrisma().photo.findMany({
    where: { inspectionId: inspection.id, deletedAt: null },
    include: {
      tirePosition: { select: { positionLabel: true, sortOrder: true } },
      uploadedBy: { select: { displayName: true } },
      _count: { select: { qcComments: true } },
    },
    orderBy: [{ tirePosition: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });

  return Promise.all(
    photos.map(async (photo) => ({
      id: Number(photo.id),
      slot: photo.slot,
      tirePositionId: photo.tirePositionId === null ? null : Number(photo.tirePositionId),
      tirePositionLabel: photo.tirePosition?.positionLabel ?? null,
      // Short-lived signed URLs. Photos are customer fleet data and are never
      // served from a permanently public link.
      url: await presignDownload(photo.storageKey),
      thumbnailUrl:
        photo.thumbnailKey === null ? null : await presignDownload(photo.thumbnailKey),
      byteSize: photo.byteSize,
      width: photo.width,
      height: photo.height,
      capturedAt: photo.capturedAt?.toISOString() ?? null,
      uploadedByName: photo.uploadedBy.displayName,
      createdAt: photo.createdAt.toISOString(),
      commentCount: photo._count.qcComments,
    })),
  );
}

/**
 * Deleting a photo sets `deleted_at`. The object stays in storage.
 *
 * PLAN/00 §3.3 rule 5 and PLAN/06 §6.1: a photo is evidence of work that may be
 * questioned months later. Only the retention job removes objects, and only
 * after 24 months, and only for finalised inspections.
 */
export async function deletePhoto(
  actor: Actor,
  auditActor: AuditActor,
  photoId: bigint,
): Promise<void> {
  await withTransaction(async (tx) => {
    const photo = await tx.photo.findFirst({
      where: { id: photoId, deletedAt: null },
      include: { inspection: { select: { status: true, submittedById: true } } },
    });
    if (photo === null) throw new AppError("NOT_FOUND");

    if (actor.role === "supplier") {
      if (photo.inspection.submittedById !== actor.id) throw new AppError("NOT_FOUND");
      if (photo.inspection.status !== "draft" && photo.inspection.status !== "needs_revision") {
        throw new AppError("INVALID_STATE_TRANSITION", {
          message: "Foto tidak dapat dihapus setelah pengajuan dikirim.",
        });
      }
    }

    await tx.photo.update({ where: { id: photoId }, data: { deletedAt: new Date() } });

    await recordAudit(tx, auditActor, {
      action: "photo.deleted",
      entity: "photo",
      entityId: photoId,
      before: { storageKey: photo.storageKey },
      after: { deleted: true },
    });
  });
}
