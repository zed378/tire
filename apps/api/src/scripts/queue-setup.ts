import { loadEnvFile } from "../kernel/load-env.ts";

// Must run before anything reads process.env.
loadEnvFile();

import PgBoss from "pg-boss";
import { JOB_RETRY_POLICY, QUEUE_SCHEMA } from "../kernel/queue.ts";

/**
 * Installs the pg-boss schema and every queue this system uses.
 *
 * WHY THIS EXISTS AS A SEPARATE STEP.
 *
 * The API enqueues by writing to `pgboss.job` inside the caller's transaction —
 * it has to, because PLAN/12 §2.1 requires the job and the data change to commit
 * together, and that is the whole reason pg-boss was chosen over Redis.
 *
 * Writing to that table directly means two things must already exist, and both
 * were previously created only when the WORKER first started:
 *
 *   1. the schema itself, or the insert fails with
 *      `relation "pgboss.job" does not exist`
 *   2. a PARTITION for each queue name — pg-boss v10 partitions `job` by `name`,
 *      so an insert for an unknown queue fails with
 *      `no partition of relation "job" found for row`
 *
 * Both surfaced as a 500 the moment a user pressed Export, rather than at deploy
 * time. Creating them here removes the ordering dependency entirely: the API can
 * enqueue against a cold database, and the worker is needed only to *process*
 * what was enqueued.
 *
 * Idempotent. pg-boss checks its own version table, and `createQueue` is a
 * no-op for a queue that already exists.
 */
export async function setupQueue(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === "") {
    throw new Error("DATABASE_URL is required to install the queue schema");
  }

  const boss = new PgBoss({ connectionString, schema: QUEUE_SCHEMA });

  // `start()` runs pg-boss's own migrations.
  await boss.start();

  const names = Object.keys(JOB_RETRY_POLICY);
  for (const name of names) {
    const policy = JOB_RETRY_POLICY[name as keyof typeof JOB_RETRY_POLICY];
    await boss.createQueue(name, {
      name,
      retryLimit: policy.retryLimit,
      retryBackoff: policy.retryBackoff,
    });
  }

  await boss.stop({ graceful: false });

  process.stdout.write(
    `  queue schema "${QUEUE_SCHEMA}" ready, ${String(names.length)} queues registered\n`,
  );
}

// Auto-run if executed directly as entrypoint script
const scriptArg = process.argv[1];
if (
  scriptArg !== undefined &&
  (scriptArg.endsWith("queue-setup.js") || scriptArg.endsWith("queue-setup.ts"))
) {
  setupQueue()
    .then(() => {
      process.exit(0);
    })
    .catch((error: unknown) => {
      process.stderr.write(`queue setup failed: ${String(error)}\n`);
      process.exit(1);
    });
}
