# Database Initialization & Seeding Flow

## Overview

Flow database initialization telah diubah untuk mengotomatisasi seeding data master dan CSV saat fase `db-init` deployment. Setup admin password tetap manual untuk keamanan.

## Fase Startup Container

Saat container Docker dimulai, `docker-entrypoint.sh` menjalankan tiga fase dalam urutan:

### 1. Database Ready Check
Menunggu database PostgreSQL siap menerima koneksi (retry setiap 2 detik).

### 2. Prisma Migrations
```bash
prisma migrate deploy
```
- Menjalankan semua SQL migrations dari `prisma/migrations/`
- Membuat schema dan tabel aplikasi
- Idempotent: aman dijalankan setiap kali container start

### 3. Database Seeding (BARU - Otomatis)
```bash
node dist/scripts/db-init-seed.js
```
- Seeds master data (provinces, cities, vehicle brands, tire brands)
- Seeds CSV data jika file tersedia di `requirements/`
- Idempotent: menggunakan `findUnique` + `create` untuk menghindari duplikasi
- Optional: jika CSV files tidak lengkap, akan skip dan log warning

**File CSV yang diharapkan:**
- `requirements/req-TB Brand Pattern.csv`
- `requirements/req-LT Brand Pattern.csv`
- `requirements/req-Size.csv`
- `requirements/req-Vehicle Brand.csv`

### 4. Queue Setup
```bash
node -e "... pg-boss queue initialization ..."
```
- Membuat schema pgboss dan job queues
- Idempotent: aman dijalankan setiap kali container start

### 5. Start API Server
```bash
node dist/server.js
```

## Admin Password Setup (MANUAL - Tidak Otomatis)

Admin password setup **tidak dijalankan otomatis** sebagai exception untuk keamanan (PLAN/13 §8).

### Setup Admin Account

Setelah container berjalan, gunakan `docker exec`:

```bash
# Dengan positional argument
docker exec <container> node dist/scripts/seed-prod-admin.js "MySecurePassword123"

# Dengan flag
docker exec <container> node dist/scripts/seed-prod-admin.js --password="MySecurePassword123" --username="admin"

# Dengan environment variable
docker exec <container> -e SEED_ADMIN_PASSWORD="MySecurePassword123" \
  node dist/scripts/seed-prod-admin.js
```

**Requirements:**
- Password minimal 10 karakter
- Hanya berjalan di APP_ENV=production dan inside container
- Idempotent: jika admin sudah ada, tidak membuat duplikat

## NPM Scripts

### Development

```bash
# Seed database lokal (development)
pnpm db:seed

# Reset database dan seed ulang
pnpm db:reset
```

### Production

```bash
# Seed master + CSV data (manual, untuk testing)
pnpm db:init-seed

# Setup admin account (manual)
pnpm db:seed:prod-admin "password"

# Seed CSV data saja
pnpm db:seed:csv-prod
```

## Docker Deployment Examples

### Build image
```bash
docker build -t tire-app:latest .
```

### Run container dengan automatic seeding
```bash
docker run -d \
  --name tire-app \
  -e DATABASE_URL="postgresql://user:pass@postgres:5432/tire_db" \
  -e APP_ENV=production \
  -e STORAGE_DRIVER=local \
  -e UPLOAD_DIR=/app/uploads \
  tire-app:latest
```

Container akan otomatis:
1. Menunggu database ready
2. Run migrations
3. Seed master data + CSV data
4. Setup queues
5. Start API

### Setup admin account setelah container ready
```bash
docker exec tire-app node dist/scripts/seed-prod-admin.js "AdminPassword123"
```

## Troubleshooting

### CSV files not found
```
warning: CSV file not found: req-TB Brand Pattern.csv
```
- Pastikan file CSV ada di `requirements/` directory
- Script akan skip CSV seeding jika files tidak lengkap
- Master data akan tetap di-seed

### Seeding failed: File tidak ditemukan
```
Gagal: script ini HANYA dapat dijalankan pada lingkungan produksi (APP_ENV=production).
```
- Pastikan `APP_ENV=production` saat menjalankan seed-prod-admin
- Script hanya berjalan di production environment untuk keamanan

### Admin password tidak valid
```
Gagal: parameter input password (minimal 10 karakter) wajib diberikan.
```
- Password minimal 10 karakter
- Contoh: `docker exec <container> node dist/scripts/seed-prod-admin.js "MySecurePassword123"`

## Idempotency & Safety

Semua seeding operations **idempotent**:
- Menjalankan seeding 2x tidak membuat duplikasi data
- Aman untuk dijalankan setiap kali container restart
- Menggunakan `findUnique` + conditional create untuk menghindari duplikasi

Admin setup adalah exception:
- **Tidak otomatis** untuk keamanan password
- Hanya melalui manual `docker exec` dengan APP_ENV=production check
- Double gate: production environment + container detection

## Files Modified

1. **apps/api/src/scripts/db-init-seed.ts** (NEW)
   - Unified seeding script untuk master data + CSV data
   - Dijalankan otomatis di db-init phase

2. **docker-entrypoint.sh**
   - Tambahan: `node dist/scripts/db-init-seed.js` setelah migrations
   - Updated komentarnya

3. **apps/api/package.json**
   - Tambahan: `"db:init-seed"` script

4. **Dockerfile**
   - Updated komentarnya untuk clarify flow baru
   - Pastikan src/scripts tersedia di image

## Security Notes

- ✅ Admin password TIDAK hardcoded
- ✅ Admin setup TIDAK otomatis
- ✅ Password hanya via CLI argument atau env variable (docker exec)
- ✅ Double-gated: APP_ENV=production + container detection
- ✅ Master data & CSV data aman di-otomatisasi (tidak contains credentials)
