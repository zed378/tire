import type { HealthReport, JobListQuery, JobRecord, LogEntry, OrphanUpload } from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import { loadConfig } from "../../kernel/config.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { ALERT_THRESHOLDS } from "../../kernel/queue.ts";
import { deleteObject } from "../../kernel/storage/index.ts";

/**
 * The operations panel (PLAN/10 §3).
 *
 * It exists because operations are run by a third person who does not read the
 * code, has no `psql`, and must resolve most problems without calling the system
 * owner. PLAN/10 §1 states the consequence plainly: every operational task
 * without an interface is a task that ends as a phone call, and enough of those
 * mean the role split has failed.
 *
 * The scope is deliberately narrow (PLAN/10 §3.2). No free-form SQL — a panel
 * that can run arbitrary queries is `psql` access that merely feels safe. No
 * action deletes business data. Every action is audited; the panel is not
 * exempt, it is the part that most needs to be covered.
 */

interface DatabaseCheck {
  ok: boolean;
  latencyMs: number;
}

async function checkDatabase(): Promise<DatabaseCheck> {
  const started = Date.now();
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

export async function getHealth(): Promise<HealthReport> {
  const config = loadConfig();
  const prisma = getPrisma();
  const database = await checkDatabase();

  const [queueDepth, failedJobs, oldestOutbox, storage, lastMetric] = await Promise.all([
    prisma
      .$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pgboss.job WHERE state IN ('created','retry')`
      .then((rows) => Number(rows[0]?.count ?? 0))
      .catch(() => 0),
    prisma
      .$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM pgboss.job
         WHERE state = 'failed' AND created_on > now() - interval '24 hours'`
      .then((rows) => Number(rows[0]?.count ?? 0))
      .catch(() => 0),
    prisma.outbox.findFirst({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.photo.aggregate({
      where: { deletedAt: null },
      _sum: { byteSize: true },
      _count: { _all: true },
    }),
    prisma.dailyMetric.findFirst({ orderBy: { day: "desc" } }),
  ]);

  /**
   * The one signal most easily missed (PLAN/12 §7.1).
   *
   * An outbox that stops being processed produces no error at all: the system
   * looks healthy while nobody is being told anything. Queue depth does not
   * catch it — only the AGE of the oldest unprocessed entry does. This is D-08
   * at the infrastructure level.
   */
  const oldestOutboxSeconds =
    oldestOutbox === null
      ? null
      : Math.round((Date.now() - oldestOutbox.createdAt.getTime()) / 1000);

  const outboxStalled =
    oldestOutboxSeconds !== null && oldestOutboxSeconds > ALERT_THRESHOLDS.oldestOutboxSeconds;

  const status: HealthReport["status"] = !database.ok
    ? "down"
    : outboxStalled || queueDepth > ALERT_THRESHOLDS.queueDepth
      ? "degraded"
      : "ok";

  return {
    status,
    version: config.APP_VERSION,
    checks: [
      {
        name: "Basis data",
        status: database.ok ? "ok" : "down",
        detail: database.ok ? "Terhubung" : "Tidak dapat dijangkau",
        latencyMs: database.latencyMs,
      },
      {
        name: "Antrean pekerjaan",
        status: queueDepth > ALERT_THRESHOLDS.queueDepth ? "degraded" : "ok",
        detail: `${queueDepth} pekerjaan menunggu`,
        latencyMs: null,
      },
      {
        name: "Outbox notifikasi",
        status: outboxStalled ? "degraded" : "ok",
        detail:
          oldestOutboxSeconds === null
            ? "Kosong"
            : `Entri tertua ${oldestOutboxSeconds} detik yang lalu`,
        latencyMs: null,
      },
    ],
    queue: {
      depth: queueDepth,
      failedLast24h: failedJobs,
      deadLetterCount: 0,
      oldestUnprocessedOutboxSeconds: oldestOutboxSeconds,
    },
    storage: {
      usedBytes: Number(storage._sum.byteSize ?? 0),
      objectCount: storage._count._all,
      trendBytesPerDay: lastMetric === null ? null : Number(lastMetric.photoBytes),
    },
    backup: {
      lastRunAt: null,
      lastVerifiedAt: null,
      lastResult: "unknown",
    },
  };
}

interface RawJob {
  id: string;
  name: string;
  state: string;
  retry_count: number;
  created_on: Date;
  started_on: Date | null;
  completed_on: Date | null;
  output: unknown;
  data: unknown;
}

export async function listJobs(query: JobListQuery): Promise<JobRecord[]> {
  const since = query.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await getPrisma()
    .$queryRawUnsafe<RawJob[]>(
      `
      SELECT id::text, name, state::text, retry_count, created_on, started_on, completed_on, output, data
        FROM pgboss.job
       WHERE state::text = $1
         AND created_on >= $2::timestamptz
         AND ($3::text IS NULL OR name = $3)
       ORDER BY created_on DESC
       LIMIT $4 OFFSET $5
      `,
      query.state,
      since,
      query.name ?? null,
      query.perPage,
      (query.page - 1) * query.perPage,
    )
    .catch(() => [] as RawJob[]);

  return rows.map((row) => {
    const output = row.output as { message?: string } | null;
    const data = row.data as { requestId?: string } | null;

    return {
      id: row.id,
      name: row.name,
      state: row.state,
      retryCount: row.retry_count,
      createdAt: row.created_on.toISOString(),
      startedAt: row.started_on?.toISOString() ?? null,
      completedAt: row.completed_on?.toISOString() ?? null,
      errorMessage: output?.message ?? null,
      requestId: data?.requestId ?? null,
    };
  });
}

export async function retryJobs(
  actor: AuditActor,
  jobIds: string[],
): Promise<{ retried: number }> {
  return withTransaction(async (tx) => {
    const retried = await tx.$executeRawUnsafe(
      `UPDATE pgboss.job
          SET state = 'created', retry_count = 0, start_after = now(), completed_on = NULL
        WHERE id::text = ANY($1::text[]) AND state = 'failed'`,
      jobIds,
    );

    await recordAudit(tx, actor, {
      action: "ops.job_retried",
      entity: "job",
      entityId: 0,
      after: { jobIds, retried },
    });

    return { retried };
  });
}

export async function cancelJobs(
  actor: AuditActor,
  jobIds: string[],
): Promise<{ cancelled: number }> {
  return withTransaction(async (tx) => {
    const cancelled = await tx.$executeRawUnsafe(
      `UPDATE pgboss.job SET state = 'cancelled', completed_on = now()
        WHERE id::text = ANY($1::text[]) AND state IN ('created','retry','failed')`,
      jobIds,
    );

    await recordAudit(tx, actor, {
      action: "ops.job_cancelled",
      entity: "job",
      entityId: 0,
      after: { jobIds, cancelled },
    });

    return { cancelled };
  });
}

/**
 * Log search by requestId (PLAN/10 §3.3).
 *
 * The audit trail is the searchable record this panel can reach; the Pino stream
 * itself lives with the log provider. Both carry the same requestId, which is
 * what makes "gagal, kodenya req_..." a usable opening line rather than the
 * start of "coba jelaskan lagi apa yang Anda lakukan".
 */
export async function searchLogs(requestId: string): Promise<LogEntry[]> {
  const entries = await getPrisma().auditLog.findMany({
    where: { requestId },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { role: true } } },
    take: 100,
  });

  return entries.map((entry) => ({
    timestamp: entry.createdAt.toISOString(),
    level: "info",
    message: `${entry.action} pada ${entry.entity}#${entry.entityId.toString()}`,
    route: null,
    statusCode: null,
    durationMs: null,
    userId: entry.actorId === null ? null : Number(entry.actorId),
    role: entry.actor?.role ?? null,
  }));
}

/**
 * Presigned but never confirmed, older than 24 hours.
 *
 * PLAN/10 §3.2 rule 2: this touches only objects that never had a completed
 * `photos` row. It cannot reach a photo somebody took.
 */
export async function listOrphanUploads(): Promise<OrphanUpload[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pending = await getPrisma().pendingUpload.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return pending.map((upload) => ({
    storageKey: upload.storageKey,
    byteSize: upload.byteSize,
    uploadedAt: upload.createdAt.toISOString(),
    ageHours: Math.floor((Date.now() - upload.createdAt.getTime()) / (60 * 60 * 1000)),
  }));
}

export async function cleanupOrphans(
  actor: AuditActor,
  storageKeys: string[],
): Promise<{ cleaned: number }> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Re-checked here, not trusted from the request. A confirmed photo must never
  // be reachable by this path whatever the client sends.
  const eligible = await prisma.pendingUpload.findMany({
    where: { storageKey: { in: storageKeys }, createdAt: { lt: cutoff } },
    select: { storageKey: true },
  });

  const confirmed = await prisma.photo.findMany({
    where: { storageKey: { in: eligible.map((e) => e.storageKey) } },
    select: { storageKey: true },
  });
  const confirmedKeys = new Set(confirmed.map((photo) => photo.storageKey));

  const safeKeys = eligible.map((e) => e.storageKey).filter((key) => !confirmedKeys.has(key));

  for (const key of safeKeys) await deleteObject(key);

  await withTransaction(async (tx) => {
    await tx.pendingUpload.deleteMany({ where: { storageKey: { in: safeKeys } } });
    await recordAudit(tx, actor, {
      action: "ops.orphans_cleaned",
      entity: "storage",
      entityId: 0,
      after: { count: safeKeys.length },
    });
  });

  return { cleaned: safeKeys.length };
}
