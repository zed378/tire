import { z } from "zod";
import {
  INSPECTION_STATUSES,
  MIN_QC_NOTES_LENGTH,
  QC_DECISIONS,
  type InspectionStatus,
  type QcDecision,
} from "./constants.ts";
import { paginationQuerySchema } from "./envelope.ts";

/**
 * Quality control (PLAN/02 §9, PLAN/03 §7).
 *
 * The legacy system stored `Nama Admin QC` as a column on the submission, which
 * means a second decision overwrote the first and nobody could tell there had
 * ever been one. With `needs_revision` an inspection can pass through QC several
 * times, so a history table is not a nicety — it is the only shape that works.
 */

/**
 * V-14: a written reason is mandatory for drop and revision.
 *
 * Without it D-11 is only half solved: the supplier learns they were rejected
 * but not what to fix, and the coordination moves back to WhatsApp.
 */
export const qcDecisionSchema = z
  .object({
    decision: z.enum(QC_DECISIONS, {
      errorMap: () => ({ message: "Keputusan QC wajib dipilih." }),
    }),
    notes: z.string().trim().max(2000).optional(),
    /**
     * Per-photo or per-position comments. A blurred photo on one position should
     * not require the supplier to guess which one.
     */
    comments: z
      .array(
        z.object({
          photoId: z.number().int().positive().optional(),
          tirePositionId: z.number().int().positive().optional(),
          body: z.string().trim().min(1, "Komentar tidak boleh kosong.").max(1000),
        }),
      )
      .max(100)
      .optional(),
    /** Guards against two admins deciding at once (PLAN/05 §3, CONCURRENT_MODIFICATION). */
    expectedStatus: z.enum(INSPECTION_STATUSES).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "pass") return;

    const notes = value.notes?.trim() ?? "";
    if (notes.length < MIN_QC_NOTES_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message:
          value.decision === "drop"
            ? `Alasan penolakan wajib diisi, minimal ${MIN_QC_NOTES_LENGTH} karakter.`
            : `Alasan revisi wajib diisi, minimal ${MIN_QC_NOTES_LENGTH} karakter, agar supplier tahu apa yang harus diperbaiki.`,
      });
    }
  });

export type QcDecisionInput = z.infer<typeof qcDecisionSchema>;

/** Reverting a decision. Only back to pending_qc, and only before specs exist. */
export const qcRevertSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(MIN_QC_NOTES_LENGTH, `Alasan pembatalan wajib diisi, minimal ${MIN_QC_NOTES_LENGTH} karakter.`)
    .max(2000),
});

export type QcRevertInput = z.infer<typeof qcRevertSchema>;

/**
 * D-02: the legacy card was titled "Riwayat" and contained no table at all —
 * just a filter and three numbers. This is the work queue that was missing.
 */
export const qcQueueQuerySchema = paginationQuerySchema.extend({
  status: z
    .union([z.enum(INSPECTION_STATUSES), z.array(z.enum(INSPECTION_STATUSES))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  submittedFrom: z.string().datetime({ offset: true }).optional(),
  submittedTo: z.string().datetime({ offset: true }).optional(),
  cityId: z.coerce.number().int().positive().optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(60).optional(),
});

export type QcQueueQuery = z.infer<typeof qcQueueQuerySchema>;

export interface QcStats {
  pending: number;
  passed: number;
  dropped: number;
  needsRevision: number;
  total: number;
}

export interface QcReviewRecord {
  id: number;
  decision: QcDecision;
  statusBefore: InspectionStatus;
  statusAfter: InspectionStatus;
  notes: string | null;
  reviewerName: string;
  reviewedAt: string;
  comments: {
    id: number;
    photoId: number | null;
    tirePositionId: number | null;
    tirePositionLabel: string | null;
    body: string;
  }[];
}
