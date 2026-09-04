import {
  EXPORT_LINK_TTL_SECONDS,
  exportFileName,
  type CreateExportInput,
  type ExportJobStatus,
  type ExportKind,
  type RegionProgressQuery,
  type RegionProgressResult,
} from "@c26/contracts";
import type { Actor } from "../../kernel/authorization.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import type { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../kernel/envelope/index.ts";
import { JOB_NAMES, sendInTransaction } from "../../kernel/queue.ts";
import { presignDownload } from "../../kernel/storage/index.ts";

/**
 * Reporting and export (PLAN/05 §8).
 *
 * D-09 is the defect being closed, and it is worth restating how complete it
 * was: both legacy export buttons produced nothing at all. No spinner, no
 * notification, no new tab — a click and then silence, with no way to tell
 * success from failure.
 */

interface RegionProgressRow {
  period: Date;
  city_id: bigint;
  city_name: string;
  province_id: bigint;
  province_name: string;
  category: string;
  unit_count: bigint;
}

/**
 * Reads the materialised view, refreshed every ten minutes by a job.
 *
 * `idx_insp_reporting` and `mv_region_progress` exist specifically so this stays
 * fast at 43,200 inspections. Without them the aggregate scans the whole table —
 * the same failure that made the legacy QC filter unusable as data grew (B-04).
 */
export async function getRegionProgress(
  query: RegionProgressQuery,
): Promise<RegionProgressResult> {
  const prisma = getPrisma();

  const truncation = query.groupBy;
  const rows = await prisma.$queryRawUnsafe<RegionProgressRow[]>(
    `
    SELECT date_trunc($1, mv.day) AS period,
           mv.city_id,
           c.name  AS city_name,
           mv.province_id,
           p.name  AS province_name,
           mv.category::text AS category,
           sum(mv.unit_count) AS unit_count
      FROM mv_region_progress mv
      JOIN cities c    ON c.id = mv.city_id
      JOIN provinces p ON p.id = mv.province_id
     WHERE ($2::bigint IS NULL OR mv.province_id = $2)
       AND ($3::bigint IS NULL OR mv.city_id = $3)
       AND ($4::text   IS NULL OR mv.category::text = $4)
       AND ($5::timestamptz IS NULL OR mv.day >= $5)
       AND ($6::timestamptz IS NULL OR mv.day <= $6)
     GROUP BY 1, 2, 3, 4, 5, 6
     ORDER BY 1, 3
    `,
    truncation,
    query.provinceId ?? null,
    query.cityId ?? null,
    query.category ?? null,
    query.from ?? null,
    query.to ?? null,
  );

  // TB versus LT is the axis the whole management dashboard is built on (K-04),
  // so the two categories are pivoted into one row per city and period.
  const byKey = new Map<string, RegionProgressResult["points"][number]>();

  for (const row of rows) {
    const key = `${row.period.toISOString()}|${row.city_id.toString()}`;
    const existing = byKey.get(key) ?? {
      period: row.period.toISOString(),
      cityId: Number(row.city_id),
      cityName: row.city_name,
      provinceId: Number(row.province_id),
      provinceName: row.province_name,
      tb: 0,
      lt: 0,
      total: 0,
    };

    const count = Number(row.unit_count);
    if (row.category === "TB") existing.tb += count;
    else existing.lt += count;
    existing.total += count;

    byKey.set(key, existing);
  }

  const points = [...byKey.values()];

  return {
    points,
    totals: points.reduce(
      (sum, point) => ({
        tb: sum.tb + point.tb,
        lt: sum.lt + point.lt,
        total: sum.total + point.total,
      }),
      { tb: 0, lt: 0, total: 0 },
    ),
    // Stated rather than implied. A dashboard that silently shows ten-minute-old
    // numbers as if they were live invites the wrong kind of trust.
    refreshedAt: await lastRefreshedAt(),
  };
}

async function lastRefreshedAt(): Promise<string | null> {
  const rows = await getPrisma().$queryRaw<{ last_refresh: Date | null }[]>`
    SELECT max(computed_at) AS last_refresh FROM daily_metrics
  `;
  return rows[0]?.last_refresh?.toISOString() ?? null;
}

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Queues an export and answers immediately with a job id.
 *
 * The contract that closes D-09: 202 with a status URL, the client polls every
 * two seconds and shows progress, and the finished file arrives as a download
 * link plus an in-app notification.
 */
export async function requestExport(
  actor: Actor,
  requestId: string,
  input: CreateExportInput,
): Promise<{ jobId: string; statusUrl: string }> {
  return withTransaction(async (tx) => {
    const job = await tx.exportJob.create({
      data: {
        kind: input.kind,
        requestedById: actor.id,
        params: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
        requestId,
      },
      select: { id: true },
    });

    // Enqueued through the caller's transaction, so the job row and the
    // export_jobs row commit together or not at all.
    await sendInTransaction(tx, JOB_NAMES.exportBuild, { jobId: job.id });

    return { jobId: job.id, statusUrl: `/api/exports/${job.id}` };
  });
}

export async function getExportStatus(actor: Actor, jobId: string): Promise<ExportJobStatus> {
  const job = await getPrisma().exportJob.findUnique({ where: { id: jobId } });

  // Scoped to the requester: another admin's export is simply not there.
  if (job === null || job.requestedById !== actor.id) throw new AppError("NOT_FOUND");

  return {
    jobId: job.id,
    kind: job.kind as ExportJobStatus["kind"],
    status: job.status,
    progress: job.progress,
    rowCount: job.rowCount,
    downloadUrl:
      job.storageKey === null
        ? null
        : await presignDownload(job.storageKey, {
            ttlSeconds: EXPORT_LINK_TTL_SECONDS,
            filename: exportFileName(job.kind as ExportKind, job.createdAt),
          }),
    error: job.errorMessage,
    requestedAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

export async function listExports(actor: Actor): Promise<ExportJobStatus[]> {
  const jobs = await getPrisma().exportJob.findMany({
    where: { requestedById: actor.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Promise.all(
    jobs.map(async (job) => ({
      jobId: job.id,
      kind: job.kind as ExportJobStatus["kind"],
      status: job.status,
      progress: job.progress,
      rowCount: job.rowCount,
      downloadUrl:
        job.storageKey === null
          ? null
          : await presignDownload(job.storageKey, {
              ttlSeconds: EXPORT_LINK_TTL_SECONDS,
              filename: exportFileName(job.kind as ExportKind, job.createdAt),
            }),
      error: job.errorMessage,
      requestedAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    })),
  );
}
