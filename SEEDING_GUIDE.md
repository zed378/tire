# Production Deployment Seeding Guide

## Overview

When deploying to production, the system requires initial master data (Vehicle Brands, Tire Brands, and Tire Patterns) to be seeded. This data is loaded from CSV files in the `requirements/` directory.

## CSV Files

Three CSV files contain the initial data:

### 1. `req-TB Brand Pattern.csv`
- **Description**: Truck/Bus (TB) tire brands and their associated patterns
- **Format**: Brand name in column B, Pattern name in column C
- **Content**: ~50 TB tire brands with 1,250+ patterns total

### 2. `req-LT Brand Pattern.csv`
- **Description**: Light Truck (LT) tire brands and their associated patterns  
- **Format**: Brand name in column B, Pattern name in column C
- **Content**: Vehicle brands and LT tire patterns

### 3. `req-Size.csv`
- **Description**: Tire sizes grouped by category (TB/LT)
- **Format**: Group in column A (TB or LT), Size in column B
- **Content**: ~30 tire sizes

## Seeding Process

### For Development & Staging

```bash
# Set required environment variables
export SEED_ADMIN_PASSWORD="SecurePassword123"
export SEED_DEMO_PASSWORD="DemoPassword123"
export APP_ENV="local"  # or "staging"

# Run the seed script
pnpm db:seed
```

This will:
1. Create upload directories
2. Seed master data (provinces, cities, vehicle brands)
3. **Seed CSV data** (tire brands and patterns from requirements/)
4. Create the first admin account
5. Create demo accounts (if SEED_DEMO_PASSWORD is set)

### For Production

⚠️ **Important**: The main seed script refuses to run on production to prevent accidental data overwrites.

For production deployment, you must:

1. **Manually create the first admin** through a reviewed migration or operator action
2. **Run CSV data seeding only** using a custom script:

```bash
# Create a production-safe seeding script
node dist/scripts/seed-csv-prod.js
```

The seed file will:
- Parse CSV files from `requirements/` directory
- Upsert tire brands (no duplicates, safe to rerun)
- Not modify existing data beyond updating brand records

## CSV Seeding Implementation

The seeding logic is implemented in:
- `apps/api/prisma/seed/csv-data.ts` - CSV parsing and database operations
- `apps/api/prisma/seed.ts` - Main seed orchestration

### How It Works

1. **Parse CSV Files**
   - TB Brand Pattern: Extract brand name and patterns
   - LT Brand Pattern: Extract brand name and patterns
   - Size: Extract group and size values

2. **Upsert Tire Brands**
   - Uses database `UPSERT` (insert if not exists, update if exists)
   - Prevents duplicates
   - Safe to run multiple times

3. **Output Summary**
   - Prints count of brands and sizes loaded
   - Example: `CSV data: 64 TB brands, 40 LT brands, 30 tire sizes`

## Deployment Checklist

- [ ] CSV files exist in `requirements/` directory
  - `req-TB Brand Pattern.csv`
  - `req-LT Brand Pattern.csv`
  - `req-Size.csv`
- [ ] Database is initialized (migrations run)
- [ ] First admin created (via manual migration or operator action)
- [ ] Run CSV seeding script
- [ ] Verify tire brands appear in admin UI
- [ ] Verify tire sizes are available in inspection forms

## Troubleshooting

### CSV files not found
**Error**: `ENOENT: no such file or directory, open 'requirements/req-TB Brand Pattern.csv'`

**Solution**: Ensure CSV files are in the correct location:
```
project-root/
├── requirements/
│   ├── req-TB Brand Pattern.csv
│   ├── req-LT Brand Pattern.csv
│   └── req-Size.csv
```

### Duplicate brands
**Status**: Database contains duplicate brand entries

**Solution**: The upsert logic prevents new duplicates. Existing duplicates must be manually cleaned:
```sql
-- Find and merge duplicate brands if needed
SELECT name, COUNT(*) FROM tire_brands 
GROUP BY name HAVING COUNT(*) > 1;
```

### Seed script fails on production
**Error**: "Refusing to seed a production database"

**Solution**: This is intentional for safety. Create admin accounts through:
1. Reviewed database migrations
2. Operator manual actions via API
3. Custom seed scripts that don't modify accounts

## Data Integrity

- **Upsert Strategy**: Uses `name` as unique key
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Won't delete existing tire brands or patterns
- **Audit Trail**: All database operations are logged via Prisma
