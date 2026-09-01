import type PgBoss from "pg-boss";
import { disconnectPrisma } from "./kernel/db.ts";
import { getLogger } from "./kernel/logger.ts";
import { getQueue, JOB_NAMES, JOB_RETRY_POLICY, stopQueue } from "./kernel/queue.ts";
import { dispatchOutbox } from "./worker/jobs/outbox-dispatch.ts";
import { sendNotification } from "./worker/jobs/notification-send.ts";
import { buildExport } from "./worker/jobs/export-build.ts";
import {
  archiveOldNotifications,
  buildThumbnail,
  cleanupOrphanedUploads,
  computeDailyMetrics,
  expireStaleDrafts,
  monitorQueueHealth,
  refreshReportView,
  sweepRetention,
} from "./worker/jobs/maintenance.ts";

/**
 * The worker process (PLAN/01 §5, PLAN/12 §7).
 *
 * Separate from the API for one reason worth restating: an Excel export over
 * 43,000 inspections and the processing of hundreds of photos must not share an
 * event loop with a field worker's upload. This is the failure isolation the
 * system actually needs, obtained with one extra container rather than by
 * splitting into network services.
 */

const log = getLogger();

async function registerHandlers(boss: PgBoss): Promise<void> {
  await boss.work(JOB_NAMES.outboxDispatch, async () => {
    const result = await dispatchOutbox();
    if (result.created > 0) log.info(result, "outbox dispatched");
  });

  await boss.work<{ notificationId: string }>(
    JOB_NAMES.notificationSend,
    { batchSize: 10 },
    async (jobs) => {
      for (const job of jobs) {
        await sendNotification(BigInt(job.data.notificationId));
      }
    },
  );

  await boss.work<{ photoId: string }>(JOB_NAMES.photoThumbnail, async (jobs) => {
    for (const job of jobs) await buildThumbnail(BigInt(job.data.photoId));
  });

  await boss.work<{ jobId: string }>(JOB_NAMES.exportBuild, async (jobs) => {
    for (const job of jobs) await buildExport(job.data.jobId);
  });

  await boss.work(JOB_NAMES.orphanCleanup, async () => {
    const result = await cleanupOrphanedUploads();
    log.info(result, "orphaned uploads cleaned");
  });

  await boss.work(JOB_NAMES.reportRefresh, async () => {
    await refreshReportView();
  });

  await boss.work(JOB_NAMES.metricsDaily, async () => {
    await computeDailyMetrics();
  });

  await boss.work(JOB_NAMES.draftExpiry, async () => {
    const result = await expireStaleDrafts();
    if (result.expired > 0) log.info(result, "stale drafts expired");
  });

  await boss.work(JOB_NAMES.notificationArchive, async () => {
    const result = await archiveOldNotifications();
    log.info(result, "notifications archived");
  });

  await boss.work(JOB_NAMES.queueHealth, async () => {
    await monitorQueueHealth();
  });

  await boss.work(JOB_NAMES.retentionSweep, async () => {
    const result = await sweepRetention();
    if (result.purged > 0) log.info(result, "photos purged past retention");
  });
}

/**
 * Schedules (PLAN/12 §7).
 *
 * The outbox is polled every 5 seconds: the whole point of writing an event in
 * the data transaction is that it gets delivered promptly afterwards.
 */
async function registerSchedules(boss: PgBoss): Promise<void> {
  const schedules: [string, string][] = [
    [JOB_NAMES.outboxDispatch, "*/5 * * * * *"],
    [JOB_NAMES.reportRefresh, "*/10 * * * *"],
    [JOB_NAMES.queueHealth, "*/5 * * * *"],
    // 02:00 WIB is 19:00 UTC the previous day.
    [JOB_NAMES.orphanCleanup, "0 19 * * *"],
    [JOB_NAMES.metricsDaily, "10 19 * * *"],
    [JOB_NAMES.draftExpiry, "20 19 * * *"],
    [JOB_NAMES.retentionSweep, "30 19 * * *"],
    [JOB_NAMES.notificationArchive, "0 20 * * 0"],
  ];

  for (const [name, cron] of schedules) {
    await boss.schedule(name, cron, {}, { tz: "UTC" });
  }
}

async function main(): Promise<void> {
  const boss = await getQueue();

  for (const [name, policy] of Object.entries(JOB_RETRY_POLICY)) {
    await boss.createQueue(name, {
      name,
      retryLimit: policy.retryLimit,
      retryBackoff: policy.retryBackoff,
    });
  }

  await registerHandlers(boss);
  await registerSchedules(boss);

  log.info("worker started");

  const shutdown = (signal: string): void => {
    log.info({ signal }, "worker shutting down");
    void stopQueue()
      .then(() => disconnectPrisma())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  process.stderr.write(`worker failed to start: ${String(error)}\n`);
  process.exit(1);
});
