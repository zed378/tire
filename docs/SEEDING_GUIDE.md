# Seeding Guide

## Overview

Commercial 2026 uses a comprehensive master data seeding strategy that includes:
1. **Geographic Data**: All 34 Indonesian provinces with 289 cities/regencies (BPS codes)
2. **Vehicle Brands**: 19 major commercial vehicle manufacturers
3. **Tire Brands**: 27 tire manufacturers (premium, mid-range, and budget options)
4. **CSV Data** (optional): Tire patterns and sizes from CSV files in `requirements/` directory

The seeding system is production-safe with environment validation and idempotent operations.

## Master Data Coverage

### Geographic Data: 34 Provinces & 289 Cities

Complete coverage of all Indonesian provinces:

| Region | Provinces | Cities/Regencies |
|--------|-----------|-----------------|
| Sumatera | 6 | 50+ |
| Java | 6 | 35+ |
| Bali & Nusa Tenggara | 3 | 20+ |
| Kalimantan | 5 | 40+ |
| Sulawesi | 6 | 50+ |
| Maluku & Papua | 4 | 60+ |
| Lampung & Kepulauan Riau | 2 | 20+ |
| **TOTAL** | **34** | **289** |

All codes follow official **BPS (Badan Pusat Statistik)** classification.

### Vehicle Brands: 19 Options

- **Premium**: Mercedes-Benz, Scania, Volvo, Man, DAF
- **Asian**: Hino, Mitsubishi Fuso, Isuzu, UD Trucks, Tata Motors, Hyundai, Toyota
- **Chinese**: Shacman, Sinotruk, Beiben, FAW, JAC
- **Other**: Renault, Iveco

### Tire Brands: 27 Options

- **Premium**: Bridgestone, Michelin, Goodyear, Dunlop, Continental, Yokohama, Hankook, Toyo
- **Mid-range**: GT Radial, Maxxis, Kumho, Kenda, Roadstone, Westlake, Cooper, Triangle, Firemax
- **Budget**: Zeta, Aspira, Kalina, Accelera, Boto, Duro, Chengshan, Linglong, Winrun, Double Coin

## Seeding Process

### For Development & Staging

```bash
# Set required environment variables
export SEED_ADMIN_PASSWORD="SecurePassword123"
export SEED_DEMO_PASSWORD="DemoPassword123"  # Optional, for demo data
export APP_ENV="local"  # or "staging"

# Run the seed script
pnpm db:seed
```

This will:
1. Create upload directories
2. Seed master data:
   - 34 provinces with BPS codes
   - 289 cities/regencies with BPS codes
   - 19 vehicle brands
   - 27 tire brands
3. Seed CSV data (tire patterns and sizes from `requirements/` directory)
4. Create the first admin account
5. Create demo accounts (if `SEED_DEMO_PASSWORD` is set)

**Expected Output**:
```
seeding (APP_ENV=local)
  upload directory ready: apps/api/uploads
  master data: 34 provinces, 289 cities, 19 vehicle brands, 27 tire brands
  admin 'admin' created; must change its password on first login
```

### For Production

⚠️ **Important**: The main seed script refuses to run on production to prevent accidental data overwrites.

For production deployment, you must:

1. **Run database migrations first**:

```bash
pnpm db:migrate
```

2. **Create the first admin** using the dedicated production script:

```bash
node dist/scripts/seed-prod-admin.js "YourSecurePassword123"
# Or with specific username:
node dist/scripts/seed-prod-admin.js "YourSecurePassword123" --username=admin
```

3. **Seed master data** (provinces, cities, brands):

```bash
# This runs only in production inside a container
node dist/prisma/seed.js
```

4. **Seed CSV data** (tire brands & patterns) - optional:

```bash
node dist/scripts/seed-csv-prod.js
```

All production scripts enforce two strict security gates:
- ✅ Must run ONLY when `APP_ENV=production`
- ✅ Must run ONLY inside a Docker/Podman container

## Master Data Implementation

### File Structure

```
apps/api/
├── prisma/
│   ├── seed.ts                    # Main seed orchestration
│   ├── seed-prod.ts               # Production seed (node compatible)
│   └── seed/
│       ├── master-data.ts         # 34 provinces + 289 cities + 46 brands
│       ├── csv-data.ts            # CSV parsing for dev/staging
│       └── demo-data.ts           # Demo accounts and sample data
└── src/
    └── scripts/
        ├── seed-prod-admin.ts     # Production admin creation
        └── seed-csv-prod.ts       # Production CSV seeding
```

### Master Data Structure

Location: `apps/api/prisma/seed/master-data.ts` (630+ lines)

```typescript
export const REGIONS = [
  {
    code: "31",                    // BPS province code (2 digits)
    name: "DKI Jakarta",
    cities: [
      { code: "3172", name: "Jakarta Timur" },      // BPS city code (4 digits)
      { code: "3175", name: "Jakarta Utara" },
      // ... more cities
    ]
  },
  // ... 33 more provinces
]

const VEHICLE_BRANDS = [
  "Hino", "Mitsubishi Fuso", "Isuzu", "UD Trucks", // ... 15 more
]

const TIRE_BRANDS = [
  "Bridgestone", "GT Radial", "Dunlop", // ... 24 more
]
```

### Upsert Strategy

All data uses Prisma's `upsert()` for safety:

```typescript
const province = await prisma.province.upsert({
  where: { code: region.code },
  create: { code: region.code, name: region.name },
  update: { name: region.name },
});
```

**Benefits**:
- ✅ Idempotent: Safe to run multiple times
- ✅ No duplicates: Uses unique `code` as key
- ✅ Non-destructive: Won't delete existing data
- ✅ Updates names if changed

## Optional: CSV Seeding

If you have CSV files with tire patterns and sizes, you can seed them:

### CSV Files

Three CSV files in `requirements/` directory:

1. **`req-TB Brand Pattern.csv`** - Truck/Bus tire brands and patterns
2. **`req-LT Brand Pattern.csv`** - Light Truck tire brands and patterns
3. **`req-Size.csv`** - Tire sizes grouped by TB/LT

### CSV Seeding Process

**Development/Staging**: Automatic (included in `pnpm db:seed`)

**Production**:
```bash
# Only runs in production inside container
node dist/scripts/seed-csv-prod.js
```

## Deployment Checklist

### Initial Setup
- [ ] Database is initialized (migrations run via `pnpm db:migrate`)
- [ ] Application is running in Docker/Podman container
- [ ] `APP_ENV=production` is set in environment

### Seeding Steps
- [ ] Create first admin: `node dist/scripts/seed-prod-admin.js "password"`
- [ ] Seed master data: `node dist/prisma/seed.js`
- [ ] (Optional) Seed CSV data: `node dist/scripts/seed-csv-prod.js`

### Verification
- [ ] Admin account is created and can login
- [ ] 34 provinces appear in province dropdown
- [ ] 289 cities/regencies appear when selecting province
- [ ] 19 vehicle brands appear in vehicle selection
- [ ] 27 tire brands appear in tire brand selection
- [ ] (If using CSV) Tire patterns and sizes are available

## Troubleshooting

### Prisma schema not found

**Error**: `Could not find Prisma Schema that is required for this command`

**Solution**: Ensure `prisma/schema.prisma` is included in Docker image:
```dockerfile
# In Dockerfile
COPY apps/api/prisma ./apps/api/prisma
```

Or rebuild with correct schema:
```bash
# Rebuild locally first
pnpm build

# Then push to production with built files
docker build -t myapp:latest .
```

### Module not found: dist/prisma/seed.js

**Error**: `Cannot find module '/app/dist/prisma/seed.js'`

**Solution**: The seed script needs to be built. Ensure:
1. Build happens before deployment: `pnpm build`
2. `dist/` directory is included in Docker image
3. Alternatively, use TypeScript version directly:

```bash
# Instead of:
node dist/prisma/seed.js

# Use with tsx (if available):
tsx prisma/seed.ts
```

### Module type warning for seed-csv-prod.js

**Warning**: `Module type of file is not specified and it doesn't parse as CommonJS`

**Solution**: Add `"type": "module"` to `package.json` (already present in root)

The warning is non-blocking and doesn't affect functionality.

### Script not found during db:migrate

**Error**: `prisma migrate deploy && tsx prisma/queue-setup.ts` fails

**Solution**: Ensure migrations are available:
```bash
# In Dockerfile, copy migrations
COPY apps/api/prisma/migrations ./apps/api/prisma/migrations

# Then run migrations
pnpm db:migrate
```

If migrations don't exist, create them:
```bash
# Locally
cd apps/api
npx prisma migrate dev --name init

# Then commit and rebuild
```

## Data Quality

### BPS Compliance

All province and city codes follow official **Badan Pusat Statistik** standards:
- **Province codes**: 2 digits (e.g., `31` = DKI Jakarta)
- **City codes**: 4 digits (e.g., `3172` = Jakarta Timur)

### Brand Coverage

- **Vehicle Brands**: All major commercial manufacturers in Indonesian market (2026)
- **Tire Brands**: Mix of international premium, mid-range, and local budget brands

### Data Integrity

- **Upsert Strategy**: Uses unique identifiers (`code` or `name`)
- **Idempotent**: Safe to run multiple times without data corruption
- **Non-destructive**: Won't delete or overwrite user data
- **Audit Trail**: All operations logged via Prisma

## Docker Production Setup

### Dockerfile Best Practices

Ensure your Dockerfile includes all required files for seeding:

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build everything
RUN pnpm build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install pnpm in production image too
RUN npm install -g pnpm

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built dist directory
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema and migrations (IMPORTANT for seeding!)
COPY apps/api/prisma ./apps/api/prisma

# Copy requirements directory if using CSV seeding
COPY requirements ./requirements

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "apps/api/dist/server.js"]
```

### Production Deployment Steps

1. **Build locally**:
   ```bash
   pnpm build
   docker build -t myapp:latest .
   ```

2. **Push to registry**:
   ```bash
   docker tag myapp:latest registry.example.com/myapp:latest
   docker push registry.example.com/myapp:latest
   ```

3. **Deploy and initialize database**:
   ```bash
   # Run container
   docker run -d --name myapp \
     -e APP_ENV=production \
     -e DATABASE_URL="postgresql://..." \
     registry.example.com/myapp:latest

   # Run migrations
   docker exec myapp pnpm db:migrate

   # Create admin
   docker exec myapp node dist/scripts/seed-prod-admin.js "AdminPassword123"

   # Seed master data
   docker exec myapp node dist/scripts/seed-csv-prod.js
   ```

### Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Storage
STORAGE_DRIVER=local
STORAGE_SIGNING_KEY=long-random-key-32-characters-minimum
UPLOAD_DIR=/app/uploads

# Security
MFA_ENCRYPTION_KEY=base64-32-byte-key

# Application
APP_ENV=production
APP_VERSION=0.1.0
API_HOST=0.0.0.0
API_PORT=3000

# Seed (production)
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=SecurePassword123
```

### Verify Deployment

After seeding, verify everything is working:

```bash
# Check database connection
docker exec myapp node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().\$queryRaw\`SELECT 1\`"

# Check master data was seeded
docker exec myapp node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.province.count().then(c => console.log('Provinces:', c))"

# Check API is responding
curl http://localhost:3000/api/health

# Check admin can login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourPassword123"}'
```

## Support & Documentation

For more detailed information:
- See `MASTER_DATA_GUIDE.md` for comprehensive master data documentation
- See `CLAUDE.md` for development guidelines and rules
- See `.env.example` for all available environment variables

