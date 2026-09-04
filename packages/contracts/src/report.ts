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
 * How long an export, and every link inside it, remains usable.
 *
 * ONE NUMBER FOR BOTH, on purpose. The export row carries an `expiresAt` and the
 * photo links in the sheet are signed URLs with their own expiry; if those two
 * drift apart you get a spreadsheet that is still listed as available and full
 * of links that answer 404, which is worse than one that is plainly gone.
 *
 * Seven days is also the ceiling rather than a preference: AWS SigV4, which R2
 * speaks, refuses to sign a URL for longer. Choosing anything above it would
 * work on the local driver and silently fail the day storage moves to R2.
 *
 * WHAT THIS COSTS, stated plainly because it is a real trade. A signed photo
 * link needs no login — the signature is the authorisation (PLAN/05 §7). A
 * spreadsheet full of them is therefore a spreadsheet that grants a week of
 * access to customer fleet photographs to anyone it is forwarded to. That is the
 * price of a report whose links work; the alternative is links that expire
 * before the person reading the report gets to them.
 */
export const EXPORT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

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
