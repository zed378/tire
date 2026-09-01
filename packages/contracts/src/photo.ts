import { z } from "zod";
import {
  ACCEPTED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_INSPECTION,
  MAX_PHOTOS_PER_SLOT,
  PHOTO_SLOTS,
  type PhotoSlot,
} from "./constants.ts";

/**
 * Photo upload protocol (PLAN/05 §7).
 *
 * Photos never pass through the application server. At 18,000 uploads a month,
 * proxying them burns bandwidth and memory and buys nothing. The server's job is
 * to decide whether an upload is allowed, hand back a short-lived presigned URL,
 * and then record what actually landed.
 */

export const presignSchema = z.object({
  slot: z.enum(PHOTO_SLOTS),
  /** Required exactly when slot is `tire_position`; ck_slot_position mirrors this. */
  tirePositionId: z.number().int().positive().optional(),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES, "Ukuran foto melebihi batas 5 MB."),
  mimeType: z.enum(ACCEPTED_PHOTO_MIME_TYPES, {
    errorMap: () => ({ message: "Format berkas tidak didukung. Gunakan WebP atau JPEG." }),
  }),
  /**
   * Computed on the device before upload. This is what makes a retry from the
   * offline queue idempotent: the same photo never produces two rows
   * (PLAN/02 §8.3, PLAN/06 §4.1).
   */
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "Checksum foto tidak valid."),
});

export type PresignInput = z.infer<typeof presignSchema>;

export interface PresignResult {
  /** Valid for 10 minutes (PLAN/05 §7). */
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
  /**
   * Set when this checksum already has a confirmed row: the client skips the
   * upload entirely and treats the queue item as done.
   */
  alreadyUploaded: boolean;
  existingPhotoId: number | null;
}

export const confirmUploadSchema = z.object({
  storageKey: z.string().trim().min(1),
  checksumSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /**
   * From EXIF where present. PLAN/06 §3.1 recommendation: keep the time, drop
   * GPS. The value of a photo is proving the condition of a tire, not the
   * whereabouts of the person holding the camera — and recording every field
   * worker's coordinates all day is personal-data collection that needs a legal
   * basis nobody has asked for.
   *
   * It comes from the device clock, which a user can change. Weak evidence, not
   * strong; never the sole basis of a dispute.
   */
  capturedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export interface PhotoRecord {
  id: number;
  slot: PhotoSlot;
  tirePositionId: number | null;
  tirePositionLabel: string | null;
  url: string;
  thumbnailUrl: string | null;
  byteSize: number;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  uploadedByName: string;
  createdAt: string;
  /** QC comments attached to this specific photo. */
  commentCount: number;
}

export interface PhotoQuota {
  perSlot: number;
  perInspection: number;
  usedInInspection: number;
  remainingInInspection: number;
}

export const PHOTO_LIMITS = {
  perSlot: MAX_PHOTOS_PER_SLOT,
  perInspection: MAX_PHOTOS_PER_INSPECTION,
  maxBytes: MAX_PHOTO_BYTES,
} as const;

/**
 * Storage key layout: `inspections/{year}/{serialNumber}/{positionCode|slot}/{uuid}.{ext}`.
 *
 * Built from the position CODE, never the Indonesian label. The legacy system
 * used the label as its Drive path, which meant any wording fix in the UI risked
 * breaking photo matching (PLAN/03 §2.3).
 */
export function buildStorageKey(params: {
  year: number;
  serialNumber: string;
  slot: PhotoSlot;
  positionCode: string | null;
  uuid: string;
  mimeType: string;
}): string {
  const extension = params.mimeType === "image/webp" ? "webp" : "jpg";
  const bucket = params.slot === "tire_position" ? (params.positionCode ?? "UNKNOWN") : params.slot;
  return `inspections/${params.year}/${params.serialNumber}/${bucket}/${params.uuid}.${extension}`;
}

/**
 * V-13: the two photo caps, as pure logic.
 *
 * `trg_photo_limit` enforces both in the database as well — the constraint is
 * the enforcement, this is what turns a violation into a message the user can
 * act on before they waste an upload on it.
 */
export function checkPhotoQuota(counts: {
  slotCount: number;
  inspectionCount: number;
}): { field: string; code: "PHOTO_LIMIT_EXCEEDED"; message: string } | null {
  if (counts.slotCount >= MAX_PHOTOS_PER_SLOT) {
    return {
      field: "photos",
      code: "PHOTO_LIMIT_EXCEEDED",
      message: `Maksimal ${MAX_PHOTOS_PER_SLOT} foto per slot.`,
    };
  }
  if (counts.inspectionCount >= MAX_PHOTOS_PER_INSPECTION) {
    return {
      field: "photos",
      code: "PHOTO_LIMIT_EXCEEDED",
      message: `Maksimal ${MAX_PHOTOS_PER_INSPECTION} foto per pengajuan.`,
    };
  }
  return null;
}
