# Master Data Seeding Fix - Complete

## Problem
Master data (provinces, cities, tire brands) tidak terseed ke database. Log hanya menunjukkan migrations + queue setup, tanpa output seeding.

## Root Cause
`db-init-seed.ts` adalah source file di `apps/api/prisma/` (bukan di `src/`). File ini tidak di-compile oleh TypeScript karena `tsconfig.build.json` hanya include `src/**/*.ts`. Dockerfile hanya copy dari `build` stage yang berisi compiled `.js` files, sehingga source `.ts` file tidak ter-copy ke container.

Saat `docker-entrypoint.sh` menjalankan `tsx apps/api/prisma/db-init-seed.ts`, file tidak ditemukan → silent fail.

## Solution Applied

### 1. Dockerfile Fix
Added explicit copy untuk source `.ts` file di Dockerfile (line 58-61):

```dockerfile
# ── Source .ts files for tsx execution (db-init-seed.ts) ────────────────────
# The build stage only has compiled .js files. We need source .ts files for
# tsx to execute db-init-seed.ts at runtime. Copy only the files needed.
COPY --from=build /app/apps/api/prisma/db-init-seed.ts ./apps/api/prisma/db-init-seed.ts
```

### 2. docker-entrypoint.sh Verbose Logging
Added checks untuk tsx availability dan file existence (line 37-48):

```sh
echo "Running database seeding (master data + CSV data)..."
echo "  Checking tsx availability..."
which tsx || echo "  ERROR: tsx not found in PATH"
echo "  Checking seed script existence..."
ls -la apps/api/prisma/db-init-seed.ts 2>&1 || echo "  ERROR: db-init-seed.ts not found"
cd /app && tsx apps/api/prisma/db-init-seed.ts 2>&1
SEED_EXIT_CODE=$?
if [ $SEED_EXIT_CODE -ne 0 ]; then
  echo "  ERROR: Seeding failed with exit code $SEED_EXIT_CODE"
  exit $SEED_EXIT_CODE
fi
echo "  Seeding completed"
```

## Files Verified Available in Container

After fix, these files will be available:
- `/app/apps/api/prisma/db-init-seed.ts` ✅ (NEW)
- `/app/apps/api/prisma/seed/master-data.ts` ✅ (already)
- `/app/apps/api/prisma/seed/csv-data.ts` ✅ (already)
- `/app/apps/api/src/kernel/load-env.ts` ✅ (already)
- `/app/apps/api/src/kernel/config.ts` ✅ (already)
- `/app/apps/api/src/generated/prisma/index.js` ✅ (already)

## Expected Log Output After Fix

```
Waiting for database to be ready...
Database is ready.

Running Prisma migrations...
  Checking prisma binary...
  Migration output above

Running database seeding (master data + CSV data)...
  Checking tsx availability...
/usr/local/bin/tsx
  Checking seed script existence...
-rw-r--r-- 1 root root 2400 ... db-init-seed.ts

db-init-seed: Starting seeding phase (APP_ENV=production)
  upload directory ready: /app/uploads
  master data: 34 provinces created (0 skipped), 200+ cities created (0 skipped), 19 vehicle brands created (0 skipped), 27 tire brands created (0 skipped)
  CSV data: ... 

db-init-seed: Seeding phase completed successfully

  Seeding completed

Running full queue setup...
  queue schema "pgboss" ready, 11 queues registered

Queue setup complete. Starting API...
```

## Validation Queries

After redeploy, run these SQL queries to verify:

```sql
SELECT COUNT(*) FROM province;      -- Expect: 34
SELECT COUNT(*) FROM city;          -- Expect: 200+
SELECT COUNT(*) FROM "tireBrand";   -- Expect: 27
SELECT COUNT(*) FROM "vehicleBrand"; -- Expect: 19
```

## Deployment Steps

1. **Rebuild image:**
   ```bash
   docker-compose build --no-cache
   ```

2. **Deploy:**
   ```bash
   docker-compose up -d
   ```

3. **Check logs:**
   ```bash
   docker-compose logs -f api
   ```
   
   Look for "Running database seeding..." line and subsequent output.

4. **Verify data:**
   ```bash
   docker exec -it <container> psql -U postgres -d c26 -c "SELECT COUNT(*) FROM province;"
   ```

## If Seeding Still Fails

### Check 1: tsx availability
```bash
docker exec <container> which tsx
```
Should output: `/usr/local/bin/tsx` or similar

### Check 2: File existence
```bash
docker exec <container> ls -la /app/apps/api/prisma/db-init-seed.ts
```
Should show the file exists

### Check 3: Database connection
```bash
docker exec <container> node -e "console.log(process.env.DATABASE_URL)"
```
Should show the DATABASE_URL

### Check 4: Manual run
```bash
docker exec <container> tsx apps/api/prisma/db-init-seed.ts
```
Should run seeding manually and show output

## Related Files Modified

- `Dockerfile` - Added source .ts file copy (line 58-61)
- `docker-entrypoint.sh` - Added verbose logging (line 37-48)
- `.kilo/plans/1788336354866-fix-master-data-seeding.md` - Plan document

## Next Steps

After confirming master data is seeded:
1. Test application UI (inspections, master data pages)
2. Proceed with mobile-friendly implementation
3. Continue with other features as planned
