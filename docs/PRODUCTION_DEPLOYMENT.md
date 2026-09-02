# Production Deployment Guide

## Docker Build Fix

### Issue Fixed
Docker build was failing with error:
```
COPY requirements/ ./requirements/ 2>/dev/null || true
target worker: failed to solve: failed to compute cache key
```

**Cause**: Shell redirection syntax (`2>/dev/null || true`) is not valid in Dockerfile COPY commands.

### Solution Implemented

**1. Dockerfile Updated** (Line 60)
```dockerfile
# Instead of:
COPY requirements/ ./requirements/ 2>/dev/null || true

# Changed to:
RUN mkdir -p /app/requirements
```

**Benefits**:
- ✅ Dockerfile syntax is valid
- ✅ Creates directory with proper permissions
- ✅ No build errors
- ✅ CSV files can be mounted at runtime

**2. docker-compose.prod.yml Updated** (db-init service)
```yaml
volumes:
  # CSV files for seed data (optional)
  - ./requirements:/app/requirements:ro
```

**Benefits**:
- ✅ CSV files can be mounted from host
- ✅ Read-only access (`:ro`) prevents accidental modifications
- ✅ Optional - works even if directory doesn't exist
- ✅ Clear documentation of what goes in requirements/

## Production Deployment Workflow

### 1. Prepare Environment Variables
Create `.env.prod` file:
```bash
# Database
POSTGRES_USER=c26
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=c26
DATABASE_URL=postgresql://c26:your_secure_password@postgres:5432/c26?schema=public

# Application
APP_ENV=production
APP_VERSION=0.1.0
API_HOST=0.0.0.0
API_PORT=3000

# Storage
STORAGE_DRIVER=local
STORAGE_SIGNING_KEY=your-32-character-random-key-here
UPLOAD_DIR=/app/uploads

# Security
MFA_ENCRYPTION_KEY=your-base64-32-byte-key-here

# Seed
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=your_secure_admin_password
```

### 2. Prepare CSV Files (Optional)
Place CSV files in `requirements/` directory:
```
requirements/
├── req-TB Brand Pattern.csv
├── req-LT Brand Pattern.csv
├── req-Size.csv
└── req-Vehicle Brand.csv
```

If CSV files don't exist, seeding will still work with master data only.

### 3. Build and Deploy
```bash
# Build Docker image
docker compose -f docker-compose.prod.yml build

# Start containers
docker compose -f docker-compose.prod.yml up -d --force-recreate

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f db-init
```

### 4. Verify Deployment

**Check if database migrations ran:**
```bash
docker compose -f docker-compose.prod.yml exec api \
  node -e "
    const { PrismaClient } = require('@prisma/client');
    new PrismaClient().\$queryRaw\`SELECT COUNT(*) as count FROM provinces\`.then(r => {
      console.log('Provinces in database:', r[0].count);
      process.exit(0);
    });
  "
```

**Check API health:**
```bash
curl http://127.0.0.1:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 123.456
}
```

### 5. Optional: Seed Master Data

If you want to manually seed CSV data:
```bash
docker compose -f docker-compose.prod.yml exec api \
  node dist/scripts/seed-csv-prod.js
```

## File Structure

### Required Files in Docker Image
```
/app/
├── dist/                  (compiled API)
├── web/                   (built SPA)
├── prisma/                (schema + migrations)
├── apps/api/package.json
├── packages/contracts/package.json
└── requirements/          (optional CSV files)
```

### Volume Mounts
```yaml
# From docker-compose.prod.yml
volumes:
  - postgres-data:/var/lib/postgresql/18/docker  # Database persistence
  - uploads:/app/uploads                         # Photo storage
  - ./requirements:/app/requirements:ro           # CSV seed data (read-only)
```

## Anti-Duplicate Guarantee

All seeding operations use **create-only** approach:

1. **Check exists first** - Query database before creating
2. **Create only new** - Only non-existent records are imported
3. **Skip existing** - Existing records are counted but never re-imported
4. **No duplicates** - Same record cannot be created twice
5. **Safe re-runs** - Can run seeding multiple times without issues

Output example:
```
master data: 34 provinces created (0 skipped), 289 cities created (0 skipped),
19 vehicle brands created (0 skipped), 27 tire brands created (0 skipped)

CSV data: 30 vehicle brands created (0 skipped), 141 TB brands created (0 skipped),
76 LT brands created (0 skipped), 28 tire sizes
```

On second run (all data exists):
```
master data: 0 provinces created (34 skipped), 0 cities created (289 skipped),
0 vehicle brands created (19 skipped), 0 tire brands created (27 skipped)
(360 existing records were not re-imported to avoid duplicates)

CSV data: All CSV data already exists in database - no new records imported
```

## Troubleshooting

### Docker build fails
**Error**: "COPY requirements/ ./requirements/ 2>/dev/null || true"

**Solution**: Already fixed in current Dockerfile. Uses `RUN mkdir -p` instead.

### Database migrations don't run
**Check**: 
```bash
docker compose -f docker-compose.prod.yml logs db-init
```

**Solution**: Ensure `DATABASE_URL` is correctly set in `.env.prod`

### API won't start
**Check**:
```bash
docker compose -f docker-compose.prod.yml logs api
```

**Solution**: Wait for db-init to complete (check with `docker compose ps`)

### CSV files not found
**Expected**: Seeding still works with master data only

**If you want CSV files**: Place them in `requirements/` directory before starting containers

### Duplicate data in database
**Should not happen**: Anti-duplicate logic prevents re-imports

**Verify**:
```sql
-- Check for duplicates (should be empty)
SELECT name, COUNT(*) FROM provinces GROUP BY name HAVING COUNT(*) > 1;
SELECT name, COUNT(*) FROM tire_brands GROUP BY name HAVING COUNT(*) > 1;
```

## Performance Notes

- First deployment: 30-60 seconds (migrations + seeding)
- Subsequent deployments: 10-15 seconds (no re-seeding, no duplicate writes)
- Master data seeding: ~5 seconds for 360+ records
- CSV seeding: ~3 seconds for 217+ brands

## Security Notes

✅ **CSV files are read-only** (`:ro` mount flag in docker-compose)
✅ **Database password in .env.prod** (not in image)
✅ **No hardcoded secrets** in Dockerfile
✅ **Anti-duplicate prevents data corruption** from re-runs
✅ **Least privilege** - app container runs as `node` user

## Next Steps

1. Prepare `.env.prod` with secure passwords
2. Optionally prepare CSV files in `requirements/`
3. Run `docker compose -f docker-compose.prod.yml up -d --force-recreate`
4. Verify with health check and database query
5. Monitor logs with `docker compose logs -f`
