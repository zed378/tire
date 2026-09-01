import { z } from "zod";

/**
 * Tire specifications (PLAN/02 §8.2).
 *
 * Every column is nullable because the legacy system allowed partial, staged
 * entry and that habit is real work practice, not sloppiness — an admin fills in
 * what they can read from the photographs and returns later. Completeness is
 * therefore derived (`v_inspection_spec_progress`), never stored as a status.
 */

/**
 * Tire size, e.g. `1000-20`, `295/80R22.5`, `750R16`.
 * Deliberately permissive: the goal is to reject garbage, not to enumerate every
 * sizing convention on the market.
 */
export const TIRE_SIZE_PATTERN = /^[0-9]{1,4}(\.[0-9])?[/A-Z0-9.-]{2,14}$/;

export const tireSpecSchema = z.object({
  tirePositionId: z.number().int().positive(),
  tireBrandId: z.number().int().positive().nullable().optional(),
  brandOther: z.string().trim().max(80).nullable().optional(),
  pattern: z.string().trim().max(80).nullable().optional(),
  size: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
    .refine((v) => v === "" || TIRE_SIZE_PATTERN.test(v), {
      message: "Format ukuran ban tidak valid. Contoh: 1000-20 atau 295/80R22.5.",
    })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  plyRating: z.string().trim().max(20).nullable().optional(),
  isRetread: z.boolean().default(false),
});

export type TireSpecInput = z.infer<typeof tireSpecSchema>;

/** Saving several positions at once — the normal case, since one vehicle has many. */
export const saveTireSpecsSchema = z.object({
  specs: z.array(tireSpecSchema).min(1, "Tidak ada spesifikasi untuk disimpan.").max(30),
});

export type SaveTireSpecsInput = z.infer<typeof saveTireSpecsSchema>;

/**
 * "Copy to other positions" — new in the rewrite. On a 22-position vehicle where
 * every tire is the same model, retyping five fields twenty-two times is the
 * kind of friction that makes people stop filling the form properly.
 */
export const copyTireSpecSchema = z.object({
  fromTirePositionId: z.number().int().positive(),
  toTirePositionIds: z.array(z.number().int().positive()).min(1).max(30),
  /** Which fields to copy; unchecked fields are left alone at the destination. */
  fields: z
    .array(z.enum(["tireBrandId", "brandOther", "pattern", "size", "plyRating", "isRetread"]))
    .min(1),
});

export type CopyTireSpecInput = z.infer<typeof copyTireSpecSchema>;

export interface TireSpecRecord {
  tirePositionId: number;
  positionCode: string;
  positionLabel: string;
  sortOrder: number;
  tireBrandId: number | null;
  tireBrandName: string | null;
  brandOther: string | null;
  pattern: string | null;
  size: string | null;
  plyRating: string | null;
  isRetread: boolean;
  filledByName: string | null;
  filledAt: string | null;
  /** A position counts as complete with brand + pattern + size (PLAN/02 §8.2). */
  isComplete: boolean;
}

export interface TireSpecSheet {
  serialNumber: string;
  plateDisplay: string;
  status: string;
  /**
   * The server refuses any write unless the inspection is `passed_qc`
   * (PLAN/03 §7.3). The legacy system only filtered the dropdown, which is a
   * display filter, not enforcement — a direct request went straight through.
   */
  editable: boolean;
  specs: TireSpecRecord[];
  progress: { filled: number; total: number };
}
