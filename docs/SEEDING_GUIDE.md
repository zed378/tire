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

### Main seed script runs on production

**Error**: `Refusing to seed a production database`

**Solution**: This is intentional protection. Use separate production scripts instead:
```bash
node dist/scripts/seed-prod-admin.js "password"
node dist/prisma/seed.js
```

### Script not found

**Error**: `Cannot find module '/app/dist/scripts/seed-csv-prod.js'`

**Solution**: Build the API first:
```bash
pnpm build
# Or just the API:
pnpm build --filter=@c26/api
```

### Database connection fails

**Error**: `Can't reach database server at localhost:5433`

**Solution**: Ensure database is running:
```bash
# Check if containers are running
docker-compose ps

# Start containers
docker-compose up -d

# Wait for database to be ready
docker-compose logs postgres
```

### CSV files not found

**Error**: `ENOENT: no such file or directory, open 'requirements/req-TB Brand Pattern.csv'`

**Solution**: Place CSV files in `requirements/` directory:
```
project-root/
├── requirements/
│   ├── req-TB Brand Pattern.csv
│   ├── req-LT Brand Pattern.csv
│   └── req-Size.csv
```

### Duplicate data in database

**Status**: Multiple entries for same province/city/brand

**Solution**: The upsert logic prevents new duplicates. For existing duplicates:
```sql
-- Check for duplicates
SELECT name, COUNT(*) FROM provinces 
GROUP BY name HAVING COUNT(*) > 1;

-- Manual cleanup may be needed
-- Contact database administrator
```

### Permission denied during pnpm install

**Error**: `EACCES: permission denied, open '/app/_tmp_*'`

**Solution**: This happens when installing dependencies as non-root in container. Ensure:
- Build happens before deployment
- Dependencies are installed with `pnpm install` before building
- Production container has pre-built `dist/` directory

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

## Support & Documentation

For more detailed information:
- See `MASTER_DATA_GUIDE.md` for comprehensive master data documentation
- See `CLAUDE.md` for development guidelines and rules
- See `.env.example` for all available environment variables

