# Fix Master Data Seeding - Implementation Ready

## Problem Summary
Master data (34 provinces, 200+ cities, 27+ tire brands) tidak terseed ke database saat deployment. Root cause: `db-init-seed.ts` tidak ter-copy ke Docker image karena file berada di `prisma/` directory (tidak di-compile).

## Root Cause Analysis
1. `db-init-seed.ts` adalah `.ts` source file di `/apps/api/prisma/`
2. TypeScript compiler hanya compile `src/**/*.ts` (per tsconfig.build.json)
3. Dockerfile copies from `build` stage yang hanya punya `.js` compiled files
4. Result: Source `.ts` file tidak ada di container
5. Impact: `tsx apps/api/prisma/db-init-seed.ts` → FILE NOT FOUND → silent fail

## Solution: Option B (Recommended)

Copy source prisma directory ke Docker image agar tsx dapat menjalankan `.ts` file directly.

### Changes Required

**File: `Dockerfile`**
- Location: After line 52
- Add: `COPY apps/api/prisma ./apps/api/prisma` 
- Purpose: Copy source `.ts` files for runtime tsx execution

This is already done by existing line 52, BUT line 52 copies from `build` stage which only has compiled files. Need to add source copy.

### Exact Change

```dockerfile
# Line 52 (EXISTING - copies from build stage, has *.sql migration files)
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# NEW - Add this line to copy source .ts files (for tsx execution)
COPY apps/api/prisma ./apps/api/prisma
```

Wait - this would overwrite. Better approach:

**Better: Add explicit source copy**
```dockerfile
# Line 52-53 (EXISTING - migrations & config)
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# NEW - Copy source .ts files that tsx needs (db-init-seed, seed/*, schema.prisma)
COPY apps/api/prisma/db-init-seed.ts ./apps/api/prisma/
COPY apps/api/prisma/seed ./apps/api/prisma/seed
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/
```

## Validation Steps

### Step 1: Build & Deploy
```bash
docker-compose up --build
```

### Step 2: Check Logs
Verify these lines appear:
```
Running Prisma migrations...
Running database seeding (master data + CSV data)...
db-init-seed: Starting seeding phase
seeding (APP_ENV=...)
master data: 34 provinces created, 200+ cities created...
Running full queue setup...
```

### Step 3: Verify Database
```sql
SELECT COUNT(*) FROM province;      -- Expect: 34
SELECT COUNT(*) FROM city;          -- Expect: 500+
SELECT COUNT(*) FROM "tireBrand";   -- Expect: 27
SELECT COUNT(*) FROM "vehicleBrand"; -- Expect: 19
```

### Step 4: Verify Application
- Login page should work
- Inspection list should load provinces/cities
- Master data admin panel should show populated lists

## Implementation Tasks

- [ ] Task 1: Add source file copies to Dockerfile (3 lines after line 53)
- [ ] Task 2: Rebuild Docker image: `docker-compose build`
- [ ] Task 3: Deploy: `docker-compose up`
- [ ] Task 4: Check logs for seeding output
- [ ] Task 5: Verify database has data (SQL query)
- [ ] Task 6: Test application UI (inspections, master data)
- [ ] Task 7: After confirmed - proceed with mobile-friendly implementation

## Risk Assessment

**Risk Level: LOW**
- Only adding file copies, no logic changes
- Idempotent (copy operation safe)
- Can easily rollback (revert Dockerfile)
- No breaking changes

## Related Files

- `Dockerfile` - Add source file copies
- `docker-entrypoint.sh` - Already correct (runs tsx script)
- `apps/api/prisma/db-init-seed.ts` - Already correct (script logic)
- `.kilo/plans/1788336354866-fix-master-data-seeding.md` - This plan

## Notes

- After this fix completes, user will have master data seeded
- Then we proceed with original request: **Mobile-friendly frontend**
- Mobile-friendly implementation is separate task (waiting for this fix)
