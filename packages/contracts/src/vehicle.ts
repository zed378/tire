import { z } from "zod";
import {
  MAX_AXLES_PER_TYPE,
  SEGMENTS_BY_CATEGORY,
  SUB_SEGMENTS_BY_SEGMENT,
  SUPPORTED_AXLE_COUNTS,
  TIRE_MOUNTINGS,
  VEHICLE_CATEGORIES,
  VEHICLE_SEGMENTS,
  AXLE_TYPES,
  type VehicleCategory,
  type VehicleSegment,
} from "./constants.ts";
import { validateAxleConfiguration } from "./axle/index.ts";

/**
 * Vehicle identity (PLAN/11).
 *
 * The single most important idea in this file: a vehicle and an inspection are
 * different things. The legacy system had no concept of a vehicle at all — a
 * plate number was just a column on a submission — which is why "every vehicle
 * is unique" could not be expressed, why axle configuration had to be retyped on
 * every inspection (widening D-04's blast radius), and why a plate change broke
 * history in two.
 */

// ── Plate number ────────────────────────────────────────────────────────────

/**
 * THE ONLY PLACE THIS REGEX EXISTS. PLAN/09 §4.3 forbids duplicating it, and
 * PLAN/09 §7 lists "the plate regex appears in two places" as a recurring
 * failure to grep for.
 *
 * PLAN/11 §4.1 tightens PLAN/02's original `^[A-Z0-9]{4,11}$`, which accepted
 * `AAAA` and `1234` — neither of which is an Indonesian plate. The tighter form
 * follows the civil plate pattern.
 *
 * OPEN: PLAN/11 §4.1 flags that government, embassy, and special-purpose plates
 * follow different patterns. If the customer fleet includes them this must be
 * loosened — a business question to settle before F2 ships, not a code decision.
 */
export const PLATE_DISPLAY_PATTERN = /^[A-Z]{1,2} ?[0-9]{1,4} ?[A-Z]{0,3}$/;

export const MIN_PLATE_KEY_LENGTH = 3;
export const MAX_PLATE_KEY_LENGTH = 9;

/**
 * Normalises before validating (PLAN/03 §4.1): strip surrounding whitespace,
 * collapse internal runs to one space, uppercase. The normalised form is what
 * gets stored — never the raw keystrokes.
 */
export function normalizePlateDisplay(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * The uniqueness key. In the database this is a `GENERATED ALWAYS ... STORED`
 * column, so no code path can write a plate key that disagrees with its display
 * form. This function exists so the client can search on the same value; it is
 * never sent to the server as data.
 */
export function plateKeyOf(display: string): string {
  return display.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export const plateDisplaySchema = z
  .string({ required_error: "Plat nomor wajib diisi." })
  .trim()
  .min(1, "Plat nomor wajib diisi.")
  .transform(normalizePlateDisplay)
  .refine((value) => PLATE_DISPLAY_PATTERN.test(value), {
    message: "Format plat nomor tidak valid. Contoh yang benar: B 1234 ABC.",
  })
  .refine(
    (value) => {
      const key = plateKeyOf(value);
      return key.length >= MIN_PLATE_KEY_LENGTH && key.length <= MAX_PLATE_KEY_LENGTH;
    },
    { message: `Plat nomor harus terdiri dari ${MIN_PLATE_KEY_LENGTH}–${MAX_PLATE_KEY_LENGTH} huruf dan angka.` },
  );

// ── Chassis number ──────────────────────────────────────────────────────────

export const CHASSIS_PATTERN = /^[A-Z0-9]{5,25}$/;

/**
 * Nullable for now (PLAN/11 §3.2, staged path). The column exists from the first
 * migration even though it is optional, for the same reason the `operator` enum
 * value does: adding a column to an empty table is free, adding it to twelve
 * thousand production rows is not.
 */
export const chassisNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .refine((value) => value === "" || CHASSIS_PATTERN.test(value), {
    message: "Nomor rangka hanya boleh berisi huruf dan angka, 5–25 karakter.",
  })
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

// ── Axle configuration input ────────────────────────────────────────────────

export const axleConfigSchema = z.object({
  axleType: z.enum(AXLE_TYPES),
  axleCount: z
    .number({ required_error: "Jumlah poros per jenis wajib diisi." })
    .int("Jumlah poros harus bilangan bulat.")
    .min(0, "Jumlah poros tidak boleh negatif.")
    .max(MAX_AXLES_PER_TYPE, `Jumlah poros per jenis maksimal ${MAX_AXLES_PER_TYPE}.`),
  mounting: z.enum(TIRE_MOUNTINGS),
});

export type AxleConfigInput = z.infer<typeof axleConfigSchema>;

// ── Segmentation ────────────────────────────────────────────────────────────

const segmentationShape = {
  category: z.enum(VEHICLE_CATEGORIES, {
    errorMap: () => ({ message: "Kategori TB/LT wajib dipilih." }),
  }),
  segment: z.enum(VEHICLE_SEGMENTS, {
    errorMap: () => ({ message: "Segmen Utama wajib dipilih." }),
  }),
  subSegment: z.string({ required_error: "Kategori Bus/Truck wajib dipilih." }).trim().min(1, "Kategori Bus/Truck wajib dipilih."),
};

/**
 * V-09 and V-10, applied together because they read the same three fields.
 *
 * D-03: in the legacy system `Segmen Utama` never followed `Kategori TB/LT`, so
 * an LT vehicle could be recorded as a bus. Nothing downstream could catch it —
 * QC verifies photographs, not segmentation consistency.
 */
function refineSegmentation(
  value: { category: VehicleCategory; segment: VehicleSegment; subSegment: string },
  ctx: z.RefinementCtx,
): void {
  // V-09
  if (!SEGMENTS_BY_CATEGORY[value.category].includes(value.segment)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["segment"],
      message: `Kategori ${value.category} tidak dapat bersegmen ${value.segment === "bus" ? "Bus" : "Truck"}.`,
    });
  }

  // V-10
  const allowed: readonly string[] = SUB_SEGMENTS_BY_SEGMENT[value.segment];
  if (!allowed.includes(value.subSegment)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subSegment"],
      message: `Kategori yang dipilih tidak tersedia untuk segmen ${value.segment === "bus" ? "Bus" : "Truck"}.`,
    });
  }
}

// ── Vehicle payloads ────────────────────────────────────────────────────────

const vehicleBaseShape = {
  plateDisplay: plateDisplaySchema,
  chassisNumber: chassisNumberSchema,
  ...segmentationShape,
  vehicleBrandId: z.number().int().positive().nullable().optional(),
  vehicleBrandOther: z.string().trim().max(80).nullable().optional(),
  cargoType: z
    .string({ required_error: "Jenis Muatan wajib diisi." })
    .trim()
    .min(1, "Jenis Muatan wajib diisi.")
    .max(120, "Jenis Muatan maksimal 120 karakter."),
  cityId: z.number({ required_error: "Kota wajib dipilih." }).int().positive("Kota wajib dipilih."),
  axleCount: z
    .number({ required_error: "Jumlah Poros wajib dipilih." })
    .int()
    .refine((v) => (SUPPORTED_AXLE_COUNTS as readonly number[]).includes(v), {
      message: `Jumlah Poros harus salah satu dari ${SUPPORTED_AXLE_COUNTS.join(", ")}.`,
    }),
  axleConfigs: z.array(axleConfigSchema).min(1, "Rincian poros wajib diisi."),
};

export const createVehicleSchema = z
  .object(vehicleBaseShape)
  .superRefine((value, ctx) => {
    refineSegmentation(value, ctx);

    // ck_brand_present: at least one of the two brand fields must be filled.
    const hasBrand =
      (value.vehicleBrandId !== null && value.vehicleBrandId !== undefined) ||
      (value.vehicleBrandOther !== null &&
        value.vehicleBrandOther !== undefined &&
        value.vehicleBrandOther.length > 0);
    if (!hasBrand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicleBrandId"],
        message: "Merk Kendaraan wajib dipilih atau diisi.",
      });
    }

    // V-01 .. V-06, from the one engine both sides share.
    for (const error of validateAxleConfiguration({
      axleCount: value.axleCount,
      configs: value.axleConfigs,
    })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: error.field === "axleCount" ? ["axleCount"] : ["axleConfigs"],
        message: error.message,
      });
    }
  });

export type CreateVehicleInput = z.input<typeof createVehicleSchema>;
export type CreateVehicleOutput = z.output<typeof createVehicleSchema>;

/** Correcting a vehicle's data. The plate may change; history records it. */
export const updateVehicleSchema = createVehicleSchema.innerType().partial().extend({
  plateChangeReason: z.string().trim().max(300).optional(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

// ── Search (PLAN/11 §6) ─────────────────────────────────────────────────────

export const vehicleSearchSchema = z.object({
  /** Matched against plate_key, so spacing never matters to the user. */
  plate: z.string().trim().min(2, "Ketik minimal 2 karakter.").optional(),
  chassisNumber: z.string().trim().min(4).optional(),
});

export type VehicleSearchInput = z.infer<typeof vehicleSearchSchema>;

export interface VehicleSummary {
  id: number;
  plateDisplay: string;
  plateKey: string;
  chassisNumber: string | null;
  category: VehicleCategory;
  segment: VehicleSegment;
  subSegment: string;
  vehicleBrandName: string | null;
  cargoType: string;
  cityId: number;
  cityName: string;
  provinceName: string;
  axleCount: number;
  totalTires: number;
  /** Fills the confirmation card in PLAN/11 §6. */
  lastInspectedAt: string | null;
  lastInspectionStatus: string | null;
  lastInspectionSerialNumber: string | null;
  inspectionCount: number;
  /**
   * Q-12 option (c): a supplier may inspect a vehicle another supplier
   * registered, but the vehicle is flagged for an admin to look at. Rejecting it
   * outright would block fleets served by more than one supplier.
   */
  needsReview: boolean;
}
