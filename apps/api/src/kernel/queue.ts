import PgBoss from "pg-boss";
import { loadConfig } from "./config.ts";
import { getLogger } from "./logger.ts";

/**
 * Background jobs (PLAN/01 §4.2, PLAN/12 §7).
 *
 * pg-boss rather than Redis + BullMQ. The stated reason in PLAN/01 is that this
 * system needs a queue for three things that run tens to hundreds of times a
 * day, not thousands per second, and every component not run is a win for one
 * person. PLAN/12 §2.1 gives the deeper reason: because pg-boss lives in the
 * same PostgreSQL, enqueueing can join the data transaction — which is what
 * makes the transactional outbox possible at all.
 *
 * Redis gets reconsidered above ~50 jobs/second. That will not happen at this
 * volume.
 */

export const JOB_NAMES = {
  /** Reads the outbox and composes notifications (PLAN/12 §7). */
  outboxDispatch: "outbox.dispatch",
  notificationSend: "notification.send",
  photoThumbnail: "photo.thumbnail",
  exportBuild: "export.build",
  orphanCleanup: "upload.orphan-cleanup",
  reportRefresh: "report.refresh",
  notificationArchive: "notification.archive",
  queueHealth: "queue.health",
  metricsDaily: "metrics.daily",
  draftExpiry: "inspection.draft-expiry",
  retentionSweep: "photo.retention-sweep",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

let boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (boss !== null) return boss;

  const config = loadConfig();
  const log = getLogger();

  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    schema: "pgboss",
    // Retained long enough for the operations panel to show a week of failures
    // (PLAN/10 §3.1).
    archiveCompletedAfterSeconds: 7 * 24 * 60 * 60,
    deleteAfterDays: 30,
  });

  boss.on("error", (error) => {
    log.error({ err: error }, "pg-boss error");
  });

  await boss.start();
  return boss;
}

export async function stopQueue(): Promise<void> {
  if (boss !== null) {
    await boss.stop({ graceful: true, timeout: 30_000 });
    boss = null;
  }
}

/**
 * Enqueues from inside an open transaction.
 *
 * pg-boss's own API opens its own connection, so a job queued that way would
 * survive a rollback. This writes the job row through the caller's transaction
 * instead, which is what keeps "the data changed" and "the work was queued"
 * atomic.
 */
export async function sendInTransaction(
  tx: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> },
  name: JobName,
  data: Record<string, unknown>,
  options: { retryLimit?: number; startAfterSeconds?: number } = {},
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO pgboss.job (name, data, retry_limit, start_after)
     VALUES ($1, $2::jsonb, $3, now() + ($4 || ' seconds')::interval)`,
    name,
    JSON.stringify(data),
    options.retryLimit ?? 3,
    String(options.startAfterSeconds ?? 0),
  );
}

/** Retry policy per job (PLAN/12 §7). */
export const JOB_RETRY_POLICY: Record<JobName, { retryLimit: number; retryBackoff: boolean }> = {
  [JOB_NAMES.outboxDispatch]: { retryLimit: 3, retryBackoff: true },
  // Idempotent through uq_notif, so retrying is always safe.
  [JOB_NAMES.notificationSend]: { retryLimit: 5, retryBackoff: true },
  [JOB_NAMES.photoThumbnail]: { retryLimit: 3, retryBackoff: true },
  [JOB_NAMES.exportBuild]: { retryLimit: 2, retryBackoff: true },
  [JOB_NAMES.orphanCleanup]: { retryLimit: 1, retryBackoff: false },
  [JOB_NAMES.reportRefresh]: { retryLimit: 1, retryBackoff: false },
  [JOB_NAMES.notificationArchive]: { retryLimit: 1, retryBackoff: false },
  [JOB_NAMES.queueHealth]: { retryLimit: 0, retryBackoff: false },
  [JOB_NAMES.metricsDaily]: { retryLimit: 2, retryBackoff: true },
  [JOB_NAMES.draftExpiry]: { retryLimit: 1, retryBackoff: false },
  [JOB_NAMES.retentionSweep]: { retryLimit: 1, retryBackoff: false },
};

/**
 * Alert thresholds (PLAN/12 §7.1).
 *
 * The second entry is the one that matters and the one most often missed. An
 * outbox that stops being processed raises no error at all: the system looks
 * healthy while nobody is being told anything. Queue depth does not catch that —
 * only the AGE of the oldest unprocessed entry does. It is D-08 at the
 * infrastructure level.
 */
export const ALERT_THRESHOLDS = {
  queueDepth: 500,
  queueDepthSustainedMinutes: 10,
  oldestOutboxSeconds: 300,
  failedJobs24h: 20,
  deadLetterCount: 0,
} as const;
