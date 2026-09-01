#!/bin/sh
# docker-entrypoint.sh — Initialize database (migrations + queue schema) before
# starting the API.
#
# 1. Run `prisma migrate deploy` to create all application tables from the SQL
#    migrations in prisma/migrations/.
# 2. Run pg-boss queue setup so the job queue exists.
#
# Both are idempotent — safe to run on every container start.

set -e

echo "Waiting for database to be ready..."
while ! node -e "
const PgBoss = require('pg-boss');
const b = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: 'pgboss' });
b.start().then(() => { b.stop({ graceful: false }); process.exit(0); })
  .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "Database is ready."

echo "Running Prisma migrations..."
cd /app
node ./node_modules/prisma/build/index.js migrate deploy 2>&1

echo "Running full queue setup..."
node -e "
const PgBoss = require('pg-boss');
const QUEUE_SCHEMA = 'pgboss';
const JOB_NAMES = [
  'outbox.dispatch', 'notification.send', 'photo.thumbnail',
  'export.build', 'upload.orphan-cleanup', 'report.refresh',
  'notification.archive', 'queue.health', 'metrics.daily',
  'inspection.draft-expiry', 'photo.retention-sweep'
];
const JOB_RETRY_POLICY = {
  'outbox.dispatch': { retryLimit: 3, retryBackoff: true },
  'notification.send': { retryLimit: 5, retryBackoff: true },
  'photo.thumbnail': { retryLimit: 3, retryBackoff: true },
  'export.build': { retryLimit: 2, retryBackoff: true },
  'upload.orphan-cleanup': { retryLimit: 1, retryBackoff: false },
  'report.refresh': { retryLimit: 1, retryBackoff: false },
  'notification.archive': { retryLimit: 1, retryBackoff: false },
  'queue.health': { retryLimit: 0, retryBackoff: false },
  'metrics.daily': { retryLimit: 2, retryBackoff: true },
  'inspection.draft-expiry': { retryLimit: 1, retryBackoff: false },
  'photo.retention-sweep': { retryLimit: 1, retryBackoff: false }
};

(async () => {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: QUEUE_SCHEMA });
  await boss.start();
  for (const name of JOB_NAMES) {
    const policy = JOB_RETRY_POLICY[name];
    await boss.createQueue(name, { name, retryLimit: policy.retryLimit, retryBackoff: policy.retryBackoff });
  }
  await boss.stop({ graceful: false });
  console.log(\`  queue schema \"\${QUEUE_SCHEMA}\" ready, \${String(JOB_NAMES.length)} queues registered\`);
  process.exit(0);
})();
"

echo "Queue setup complete. Starting API..."
exec "$@"