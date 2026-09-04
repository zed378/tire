import { z } from "zod";
import { VEHICLE_CATEGORIES } from "./constants.ts";

/**
 * Reporting and export (PLAN/05 §8, PLAN/08 F5).
 *
 * D-09 is the defect this closes: in the legacy system both export buttons were
 * completely mute. No spinner, no notification, no new tab — a click produced
 * nothing observable, and there was no way to tell success from failure.
 */

export const regionProgressQuerySchema = z.object({
  provinceId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  category: z.enum(VEHICLE_CATEGORIES).optional(),
  /** New in the rewrite: the legacy dashboard had no date filter at all. */
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

export type RegionProgressQuery = z.infer<typeof regionProgressQuerySchema>;

export interface RegionProgressPoint {
  period: string;
  cityId: number;
  cityName: string;
  provinceId: number;
  provinceName: string;
  /** TB versus LT is the analytic axis the whole management dashboard sits on (K-04). */
  tb: number;
  lt: number;
  total: number;
}

export interface RegionProgressResult {
  points: RegionProgressPoint[];
  totals: { tb: number; lt: number; total: number };
  /**
   * The materialised view refreshes every 10 minutes, so the dashboard states
   * how old its numbers are rather than implying they are live.
   */
  refreshedAt: string | null;
}

// ── Export ──────────────────────────────────────────────────────────────────

export const EXPORT_KINDS = ["qc", "tire_specs", "region_progress"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_KIND_LABELS: Record<ExportKind, string> = {
  qc: "Data Quality Control",
  tire_specs: "Spesifikasi Ban",
  region_progress: "Progres Wilayah",
};

/**
 * How long a finished export stays available for download.
 *
 * The row carries an `expiresAt` and a cleanup job removes the file, so this is
 * the file's own lifetime — not the lifetime of the photo links inside it. Those
 * are separate and deliberately different; see `EXPORT_PHOTO_LINK_TTL_SECONDS`.
 */
export const EXPORT_RETENTION_SECONDS = 7 * 24 * 60 * 60;

/**
 * How long a photo link inside an export stays valid. `null` means never.
 *
 * ASKED FOR EXPLICITLY, and it is a grant rather than a setting, so it is worth
 * stating what it grants. A signed photo link carries its own authorisation —
 * that is what makes it work from a spreadsheet with no login (`PLAN/05` §7). A
 * link with no expiry is therefore permanent, unauthenticated access to that
 * photograph for anyone the spreadsheet is ever forwarded to. Revoking one means
 * rotating `STORAGE_SIGNING_KEY`, which invalidates every link in every export
 * ever issued.
 *
 * IT ALSO PINS THE STORAGE DRIVER. AWS SigV4, which R2 speaks, refuses to sign a
 * URL for longer than seven days, so `null` cannot be honoured there. The S3
 * driver throws rather than quietly capping — a "permanent" link that silently
 * becomes a seven-day one is the worse failure. Moving to R2 means setting a
 * number here first.
 *
 * A number is the alternative if that trade stops looking worthwhile: 604800 is
 * the longest R2 will accept.
 */
export const EXPORT_PHOTO_LINK_TTL_SECONDS: number | null = null;

/**
 * The name an export is saved under.
 *
 * Written here rather than in the API because it is a user-facing string, and
 * `K-10` puts those in one place alongside the labels they are built from.
 *
 * Without it the browser saves the storage key, and an operator ends up with
 * `aae0f09f-ee98-46a6-8b9a-bdb261147f8e.xlsx` in their downloads folder — a file
 * they cannot tell apart from the next one.
 *
 * The date is the day the export was requested, in WIB, because that is the day
 * the person asking for it will remember. It is written `dd-mm-yyyy` to match
 * every other date this application shows.
 */
export function exportFileName(kind: ExportKind, requestedAt: Date): string {
  const wib = new Date(requestedAt.getTime() + 7 * 60 * 60 * 1000);
  const day = String(wib.getUTCDate()).padStart(2, "0");
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const date = `${day}-${month}-${String(wib.getUTCFullYear())}`;

  return `${EXPORT_KIND_LABELS[kind]} ${date}.xlsx`;
}

export const createExportSchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  provinceId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  category: z.enum(VEHICLE_CATEGORIES).optional(),
  status: z.array(z.string()).optional(),
});

export type CreateExportInput = z.infer<typeof createExportSchema>;

export interface ExportJobAccepted {
  jobId: string;
  statusUrl: string;
}

export interface ExportJobStatus {
  jobId: string;
  kind: ExportKind;
  status: "queued" | "running" | "done" | "failed";
  /** 0..100. Rendered as a progress bar rather than an indeterminate spinner. */
  progress: number;
  rowCount: number | null;
  downloadUrl: string | null;
  /** Indonesian, ready to show. Never a stack trace. */
  error: string | null;
  requestedAt: string;
  finishedAt: string | null;
}

/** Client polling interval for the status endpoint (PLAN/05 §8). */
export const EXPORT_POLL_INTERVAL_MS = 2000;
