import { z } from "zod";
import {
  INSPECTION_STATUSES,
  type AxleType,
  type InspectionStatus,
  type TireDepth,
  type TireSide,
} from "./constants.ts";
import { paginationQuerySchema } from "./envelope.ts";
import { createVehicleSchema } from "./vehicle.ts";

/**
 * Inspections (PLAN/11 §5.2 — the table PLAN/02 called `submissions`).
 *
 * A vehicle is identity; an inspection is an event. One vehicle, many
 * inspections over time. The Serial Number stays attached to the inspection,
 * not the vehicle, so K-05 holds: an old `SN2026-0001` still refers to exactly
 * what it always referred to — one inspection event.
 */

// ── Creating an inspection ──────────────────────────────────────────────────

/**
 * Either an existing vehicle is chosen, or a new one is described inline.
 *
 * PLAN/11 §6 rule 2: a plate match is never treated as certainty. Plates get
 * reassigned to other vehicles, so the supplier confirms the summary card
 * before the id is sent — the client never resolves a plate to an id silently.
 */
export const createInspectionSchema = z.union([
  z.object({
    vehicleId: z.number().int().positive(),
    /** Corrections applied at inspection time, if the supplier said "data berubah". */
    vehicleUpdate: createVehicleSchema.innerType().partial().optional(),
  }),
  z.object({
    newVehicle: createVehicleSchema,
  }),
]);

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;

export function isNewVehiclePayload(
  input: CreateInspectionInput,
): input is { newVehicle: z.infer<typeof createVehicleSchema> } {
  return "newVehicle" in input;
}

/**
 * Saving a draft. Everything is optional: a draft exists precisely so a long
 * form filled in a garage is not lost to a dropped signal or a flat battery.
 * V-01..V-11 are checked on the submit transition, not here (PLAN/11 §5.6).
 */
export const saveDraftSchema = z.object({
  vehicleUpdate: createVehicleSchema.innerType().partial().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

// ── Listing and filtering ───────────────────────────────────────────────────

/**
 * D-01: in the legacy system the QC filters were rendered but never reached the
 * data — a date range of 2020 still returned a 2026 record. Here the filter is
 * the query.
 */
export const inspectionListQuerySchema = paginationQuerySchema.extend({
  status: z
    .union([z.enum(INSPECTION_STATUSES), z.array(z.enum(INSPECTION_STATUSES))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  /** ISO dates. The UI renders dd/mm/yyyy; the wire stays unambiguous. */
  submittedFrom: z.string().datetime({ offset: true }).optional(),
  submittedTo: z.string().datetime({ offset: true }).optional(),
  cityId: z.coerce.number().int().positive().optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(60).optional(),
  sort: z.enum(["created_desc", "created_asc", "submitted_desc", "submitted_asc"]).default("created_desc"),
});

export type InspectionListQuery = z.infer<typeof inspectionListQuerySchema>;

// ── Read models ─────────────────────────────────────────────────────────────

export interface TirePositionView {
  id: number;
  positionCode: string;
  positionLabel: string;
  axleType: AxleType;
  axleIndex: number;
  side: TireSide;
  depth: TireDepth | null;
  sortOrder: number;
  photoCount: number;
  hasSpec: boolean;
}

export interface InspectionListItem {
  id: number;
  serialNumber: string;
  status: InspectionStatus;
  plateDisplay: string;
  cityName: string;
  provinceName: string;
  category: string;
  totalTires: number;
  photoCount: number;
  submittedAt: string | null;
  createdAt: string;
  submittedByName: string;
  /** Present on needs_revision and dropped_qc so the reason travels with the row. */
  latestQcNotes: string | null;
}

export interface InspectionDetail extends InspectionListItem {
  vehicleId: number;
  chassisNumber: string | null;
  segment: string;
  subSegment: string;
  vehicleBrandName: string | null;
  cargoType: string;
  axleCount: number;
  axleConfigs: { axleType: AxleType; axleCount: number; mounting: string }[];
  tirePositions: TirePositionView[];
  generalPhotos: { slot: string; photoIds: number[] }[];
  specProgress: { filled: number; total: number };
  canSubmit: boolean;
  /** Why the submit button is disabled, in Indonesian, ready to render. */
  submitBlockedReason: string | null;
}

// ── Position preview (PLAN/05 §6) ───────────────────────────────────────────

/**
 * The client may derive positions locally for responsiveness — and must, to
 * generate photo slots offline (PLAN/06 §2) — but the server decides (V-06).
 * Every write recomputes from the configuration rather than trusting a count
 * that arrived over the wire.
 */
export const previewPositionsSchema = z.object({
  axleCount: z.number().int(),
  axleConfigs: z.array(
    z.object({
      axleType: z.enum(["steer", "drive", "free_rolling"]),
      axleCount: z.number().int(),
      mounting: z.enum(["single", "double"]),
    }),
  ),
});

export type PreviewPositionsInput = z.infer<typeof previewPositionsSchema>;

export interface PreviewPositionsResult {
  totalTires: number;
  positions: {
    positionCode: string;
    positionLabel: string;
    axleType: AxleType;
    axleIndex: number;
    side: TireSide;
    depth: TireDepth | null;
    sortOrder: number;
  }[];
}
