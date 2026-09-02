#!/bin/sh
# docker-entrypoint.sh — Initialize database during container startup.
#
# Three phases (all idempotent — safe to run on every container start):
#
# 1. Prisma migrations: Create all application tables from SQL migrations
#    in prisma/migrations/
#
# 2. Database seeding: Seed master data (provinces, cities, vehicle/tire brands)
#    and optional CSV data from requirements/ directory. Automatic on first init.
#
# 3. Queue setup: Initialize pg-boss job queues for background tasks.
#
# Admin password setup (seed-prod-admin) is MANUAL-ONLY via docker exec,
# never automated, to ensure credentials are never embedded in deployment.

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
echo "  Checking prisma binary..."
ls -la ./node_modules/prisma/build/index.js 2>&1 || echo "  Binary not found at expected path"
node ./node_modules/prisma/build/index.js migrate deploy 2>&1
echo "  Migration output above"

echo "Running database seeding (master data + CSV data)..."
cd /app && tsx apps/api/prisma/db-init-seed.ts 2>&1
echo "  Seeding completed"

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