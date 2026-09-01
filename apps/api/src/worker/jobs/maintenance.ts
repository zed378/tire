import sharp from "sharp";
import { DRAFT_EXPIRY_DAYS, RETENTION_MONTHS } from "@c26/contracts";
import { recordAudit } from "../../kernel/audit.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { getLogger } from "../../kernel/logger.ts";
import { publishEvent } from "../../kernel/outbox.ts";
import { ALERT_THRESHOLDS } from "../../kernel/queue.ts";
import { deleteObject, getObject, putObject, thumbnailKeyFor } from "../../kernel/storage/index.ts";

/**
 * Scheduled maintenance jobs (PLAN/12 §7, PLAN/06 §6).
 *
 * Every one of them runs in the worker process, never in a request. That
 * separation is the failure isolation this system actually needs, and it costs
 * one extra entry in docker-compose rather than a network service split
 * (PLAN/01 §5).
 */

// ── Thumbnails ──────────────────────────────────────────────────────────────

/**
 * QC reviews a gallery of up to 30 photos per inspection. Serving full-size
 * images for that grid would spend bandwidth the reviewer does not need until
 * they open one.
 */
export async function buildThumbnail(photoId: bigint): Promise<{ built: boolean }> {
  const prisma = getPrisma();
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (photo === null || photo.thumbnailKey !== null) return { built: false };

  const original = await getObject(photo.storageKey);
  if (original === null) return { built: false };

  const thumbnail = await sharp(original)
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  const thumbnailKey = thumbnailKeyFor(photo.storageKey);
  await putObject({ storageKey: thumbnailKey, body: thumbnail, mimeType: "image/webp" });
  await prisma.photo.update({ where: { id: photoId }, data: { thumbnailKey } });

  return { built: true };
}

// ── Orphaned uploads ────────────────────────────────────────────────────────

/**
 * An object uploaded to storage but never confirmed becomes rubbish. This sweeps
 * anything older than 24 hours that has no matching `photos` row (PLAN/05 §7).
 */
export async function cleanupOrphanedUploads(): Promise<{ removed: number }> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stale = await prisma.pendingUpload.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { storageKey: true },
    take: 500,
  });

  const confirmed = await prisma.photo.findMany({
    where: { storageKey: { in: stale.map((upload) => upload.storageKey) } },
    select: { storageKey: true },
  });
  const confirmedKeys = new Set(confirmed.map((photo) => photo.storageKey));

  let removed = 0;
  for (const upload of stale) {
    if (confirmedKeys.has(upload.storageKey)) {
      // It landed after all; drop the pending row and leave the object alone.
      await prisma.pendingUpload.delete({ where: { storageKey: upload.storageKey } });
      continue;
    }
    await deleteObject(upload.storageKey);
    await prisma.pendingUpload.delete({ where: { storageKey: upload.storageKey } });
    removed++;
  }

  return { removed };
}

// ── Reporting aggregate ─────────────────────────────────────────────────────

export async function refreshReportView(): Promise<void> {
  // CONCURRENTLY needs the unique index uq_mv_region. Without it the refresh
  // takes a lock and the dashboard freezes every ten minutes.
  await getPrisma().$executeRawUnsafe(
    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_region_progress",
  );
}

// ── Daily metrics ───────────────────────────────────────────────────────────

/**
 * Fills `daily_metrics` (PLAN/01 §6).
 *
 * Most of these numbers cannot be compared against the legacy system at all,
 * because it measured nothing. Knowing what is happening is itself one of the
 * larger results of this rewrite.
 */
export async function computeDailyMetrics(day: Date = new Date()): Promise<void> {
  const prisma = getPrisma();

  const start = new Date(day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [created, statuses, photos] = await Promise.all([
    prisma.inspection.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.qcReview.groupBy({
      by: ["decision"],
      where: { reviewedAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.photo.aggregate({
      where: { createdAt: { gte: start, lt: end }, deletedAt: null },
      _count: { _all: true },
      _sum: { byteSize: true },
    }),
  ]);

  const decisionCount = (decision: string): number =>
    statuses.find((row) => row.decision === decision)?._count._all ?? 0;

  await prisma.dailyMetric.upsert({
    where: { day: start },
    create: {
      day: start,
      inspectionsCreated: created,
      inspectionsPassed: decisionCount("pass"),
      inspectionsDropped: decisionCount("drop"),
      inspectionsRevised: decisionCount("revision"),
      photosUploaded: photos._count._all,
      photoBytes: BigInt(photos._sum.byteSize ?? 0),
    },
    update: {
      inspectionsCreated: created,
      inspectionsPassed: decisionCount("pass"),
      inspectionsDropped: decisionCount("drop"),
      inspectionsRevised: decisionCount("revision"),
      photosUploaded: photos._count._all,
      photoBytes: BigInt(photos._sum.byteSize ?? 0),
      computedAt: new Date(),
    },
  });
}

// ── Draft expiry ────────────────────────────────────────────────────────────

/**
 * Removes drafts untouched for 30 days (PLAN/11 §5.6).
 *
 * Drafts do not lock a plate, so an abandoned one blocks nothing — but leaving
 * them forever turns the supplier's own list into a graveyard they stop reading.
 */
export async function expireStaleDrafts(): Promise<{ expired: number }> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const stale = await prisma.inspection.findMany({
    where: { status: "draft", deletedAt: null, updatedAt: { lt: cutoff } },
    select: { id: true, serialNumber: true },
    take: 200,
  });

  for (const draft of stale) {
    await withTransaction(async (tx) => {
      await tx.inspection.update({ where: { id: draft.id }, data: { deletedAt: new Date() } });
      await recordAudit(
        tx,
        { id: null, role: null, requestId: `job_draft_expiry_${Date.now()}`, ipAddress: null },
        {
          action: "inspection.draft_expired",
          entity: "inspection",
          entityId: draft.id,
          after: { serialNumber: draft.serialNumber, reason: `untouched for ${DRAFT_EXPIRY_DAYS} days` },
        },
      );
    });
  }

  return { expired: stale.length };
}

// ── Notification archive ────────────────────────────────────────────────────

export async function archiveOldNotifications(): Promise<{ archived: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await getPrisma().notification.deleteMany({
    where: { channel: "in_app", createdAt: { lt: cutoff }, readAt: { not: null } },
  });
  return { archived: result.count };
}

// ── Queue health ────────────────────────────────────────────────────────────

/**
 * Watches the queue and, above all, the AGE of the oldest unprocessed outbox
 * entry (PLAN/12 §7.1).
 *
 * A stalled outbox raises no error at all: the system looks healthy while nobody
 * is being told anything. Depth does not detect that. This is D-08 at the
 * infrastructure level, and age is the only signal that catches it.
 */
export async function monitorQueueHealth(): Promise<void> {
  const prisma = getPrisma();
  const log = getLogger();

  const [failedCount, oldestOutbox] = await Promise.all([
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
  ]);

  const outboxAgeSeconds =
    oldestOutbox === null ? 0 : Math.round((Date.now() - oldestOutbox.createdAt.getTime()) / 1000);

  if (outboxAgeSeconds > ALERT_THRESHOLDS.oldestOutboxSeconds) {
    log.error({ outboxAgeSeconds }, "outbox is stalled — notifications have stopped silently");
  }

  if (failedCount > ALERT_THRESHOLDS.failedJobs24h) {
    await withTransaction(async (tx) => {
      await publishEvent(tx, { id: null, requestId: `job_health_${Date.now()}` }, {
        type: "job.repeatedly_failed",
        aggregateId: 0,
        payload: { jobName: "beberapa pekerjaan", failureCount: failedCount },
      });
    });
  }
}

// ── Retention ───────────────────────────────────────────────────────────────

/**
 * Deletes storage objects past the retention window (PLAN/06 §6).
 *
 * The only path in the system that removes a photo object, and even here it only
 * touches finalised inspections older than 24 months. Deleting a photo a user
 * asked to remove is `deleted_at` on the row — a photo is evidence of work that
 * may be questioned months later (PLAN/00 §3.3 rule 5).
 */
export async function sweepRetention(): Promise<{ purged: number }> {
  const prisma = getPrisma();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const expired = await prisma.photo.findMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
      inspection: { status: { in: ["passed_qc", "dropped_qc"] }, submittedAt: { lt: cutoff } },
    },
    select: { id: true, storageKey: true, thumbnailKey: true },
    take: 200,
  });

  for (const photo of expired) {
    await deleteObject(photo.storageKey);
    if (photo.thumbnailKey !== null) await deleteObject(photo.thumbnailKey);
  }

  return { purged: expired.length };
}
