import { z } from "zod";
import { paginationQuerySchema } from "./envelope.ts";

/**
 * Operations panel and audit (PLAN/10, PLAN/04 §6).
 *
 * The panel exists because operations are run by a third person who does not
 * read the code, has no `psql`, and must resolve most problems without calling
 * the system owner. Every operational task without an interface is a task that
 * ends as a phone call — and enough of those and the role split has failed.
 *
 * Its scope is deliberately narrow. A panel that can do everything is a panel
 * that can break everything. There is no free-form SQL, and no action deletes
 * business data.
 */

export interface HealthReport {
  status: "ok" | "degraded" | "down";
  version: string;
  checks: {
    name: string;
    status: "ok" | "degraded" | "down";
    detail: string;
    latencyMs: number | null;
  }[];
  queue: {
    depth: number;
    failedLast24h: number;
    deadLetterCount: number;
    /**
     * The signal that matters most and is easiest to miss: an outbox that stops
     * being processed raises no error at all. The system looks healthy while
     * nobody is being told anything. Depth does not catch that — age does.
     */
    oldestUnprocessedOutboxSeconds: number | null;
  };
  storage: {
    usedBytes: number;
    objectCount: number;
    trendBytesPerDay: number | null;
  };
  backup: {
    lastRunAt: string | null;
    lastVerifiedAt: string | null;
    lastResult: "ok" | "failed" | "unknown";
  };
}

export const jobListQuerySchema = paginationQuerySchema.extend({
  state: z.enum(["failed", "active", "completed", "retry"]).default("failed"),
  name: z.string().trim().max(80).optional(),
  since: z.string().datetime({ offset: true }).optional(),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export interface JobRecord {
  id: string;
  name: string;
  state: string;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  /** Ties a user's report straight to the log line and the Sentry event. */
  requestId: string | null;
}

export const jobActionSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1).max(100),
  /** PLAN/10 §3.2 rule 4: two-step confirmation, in an app dialog. */
  confirm: z.literal(true),
});

export type JobActionInput = z.infer<typeof jobActionSchema>;

/**
 * Log search by requestId. PLAN/10 §3.3: with a separate operator this field
 * stops being a nice touch and becomes the backbone of the support flow —
 * "gagal, kodenya req_..." is where every report should start.
 */
export const logSearchSchema = z.object({
  requestId: z
    .string()
    .trim()
    .min(6, "Masukkan kode permintaan yang dilaporkan pengguna.")
    .max(80),
});

export type LogSearchInput = z.infer<typeof logSearchSchema>;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  route: string | null;
  statusCode: number | null;
  durationMs: number | null;
  userId: number | null;
  role: string | null;
}

export interface OrphanUpload {
  storageKey: string;
  byteSize: number;
  uploadedAt: string;
  /** Presigned but never confirmed; older than 24 hours. */
  ageHours: number;
}

export const cleanupOrphansSchema = z.object({
  storageKeys: z.array(z.string().min(1)).min(1).max(500),
  confirm: z.literal(true),
});

export type CleanupOrphansInput = z.infer<typeof cleanupOrphansSchema>;

// ── Audit (PLAN/04 §6) ──────────────────────────────────────────────────────

export const auditQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().max(40).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().max(60).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  actorId: number | null;
  actorName: string | null;
  actorRole: string | null;
  /** Only the columns that changed, and never a secret — not even hashed. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
}
