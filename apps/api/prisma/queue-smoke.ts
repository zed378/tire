import { loadEnvFile } from "../src/kernel/load-env.ts";

loadEnvFile();

import { disconnectPrisma, getPrisma, withTransaction } from "../src/kernel/db.ts";
import { assertQueueReady, JOB_NAMES, sendInTransaction } from "../src/kernel/queue.ts";

/**
 * Proves the transactional enqueue path end to end.
 *
 * It exercises exactly what `POST /api/reports/export` does — `sendInTransaction`
 * inside a Prisma transaction — which is the path that failed twice in
 * production-like use: first because the pg-boss schema did not exist, then
 * because pg-boss v10 partitions `job` by queue name and no partition had been
 * created. Both were only visible at runtime.
 *
 * Run with `pnpm --filter @c26/api db:queue-smoke` after a migration.
 */
async function main(): Promise<void> {
  await assertQueueReady(getPrisma());
  process.stdout.write("  assertQueueReady: OK\n");

  const marker = `smoke-${Date.now().toString()}`;

  await withTransaction(async (tx) => {
    await sendInTransaction(tx, JOB_NAMES.exportBuild, { jobId: marker });
  });

  const rows = await getPrisma().$queryRawUnsafe<{ name: string; state: string }[]>(
    `SELECT name, state::text AS state FROM ${"pgboss"}.job WHERE data->>'jobId' = $1`,
    marker,
  );

  if (rows.length !== 1) {
    throw new Error(`expected exactly one queued job, found ${String(rows.length)}`);
  }

  process.stdout.write(`  enqueued: ${rows[0]?.name ?? "?"} (state=${rows[0]?.state ?? "?"})\n`);

  // Leave nothing behind; the worker would otherwise pick up a fake export.
  await getPrisma().$executeRawUnsafe(
    `DELETE FROM ${"pgboss"}.job WHERE data->>'jobId' = $1`,
    marker,
  );
  process.stdout.write("  cleaned up\n");

  await disconnectPrisma();
}

main().catch((error: unknown) => {
  process.stderr.write(`queue smoke test failed: ${String(error)}\n`);
  process.exit(1);
});
