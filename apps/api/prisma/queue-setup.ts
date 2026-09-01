import { loadEnvFile } from "../src/kernel/load-env.ts";

// Must run before anything reads process.env.
loadEnvFile();

import PgBoss from "pg-boss";
import { QUEUE_SCHEMA } from "../src/kernel/queue.ts";

/**
 * Creates the pg-boss schema.
 *
 * WHY THIS EXISTS AS A SEPARATE STEP.
 *
 * pg-boss installs its own tables the first time `boss.start()` runs, which
 * happens in the worker. But the API writes to `pgboss.job` directly — it has
 * to, because PLAN/12 §2.1 requires the job to be enqueued inside the same
 * transaction as the data change, and that is the whole reason pg-boss was
 * chosen over Redis.
 *
 * That left the API depending on the worker having been started at least once.
 * If it had not, every export and every photo confirmation answered 500 with
 * `relation "pgboss.job" does not exist` — at the moment a user pressed the
 * button, not at deploy time.
 *
 * Owning the schema at migration time removes the ordering dependency: the API
 * can enqueue from a cold database, and the worker is only needed to *process*
 * what was enqueued.
 *
 * Idempotent: pg-boss checks its own version table and does nothing when the
 * schema is already current.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === "") {
    throw new Error("DATABASE_URL is required to install the queue schema");
  }

  const boss = new PgBoss({ connectionString, schema: QUEUE_SCHEMA });

  // `start()` runs pg-boss's own migrations. Stopping immediately afterwards
  // leaves the schema in place with nothing consuming from it.
  await boss.start();
  await boss.stop({ graceful: false });

  process.stdout.write(`  queue schema "${QUEUE_SCHEMA}" ready\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`queue setup failed: ${String(error)}\n`);
  process.exit(1);
});
