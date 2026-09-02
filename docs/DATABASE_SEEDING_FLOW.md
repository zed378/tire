# Database Seeding Flow

Bagaimana database diisi saat deployment, dan apa yang sengaja tidak otomatis.

## Ringkasan

Semua pekerjaan database sekali-per-deployment dijalankan oleh service `db-init`
di `docker-compose.prod.yml`, sebagai `command`-nya:

```yaml
command: ["sh", "-c", "pnpm db:migrate && pnpm db:seed:init"]
```

`api` dan `worker` menunggu `db-init` selesai dengan sukses
(`service_completed_successfully`). Jadi kalau seeding gagal, deployment
berhenti — bukan naik dengan tabel master kosong.

| Fase | Perintah | Isi |
| --- | --- | --- |
| 1. Migrasi | `prisma migrate deploy` | Membuat/memperbarui skema |
| 2. Antrian | `node dist/scripts/queue-setup.js` | Skema dan 11 antrian pg-boss |
| 3. Seed | `node dist/scripts/seed-init.js` | Data referensi |

Ketiganya idempoten dan dijalankan ulang pada setiap deployment.

## Apa yang di-seed

`seed-init` mengisi data referensi saja — tidak pernah membuat akun:

- **Master data bawaan** (`src/scripts/seed/master-data.ts`): 32 provinsi, 290
  kota, plus daftar awal merek kendaraan dan merek ban.
- **Master data CSV** (`src/scripts/seed/csv-data.ts`), dibaca dari
  `/app/requirements` (bind mount, read-only):
  - `req-Vehicle Brand.csv` → `vehicle_brands`
  - `req-TB Brand Pattern.csv` → `tire_brands` + `tire_brand_patterns` (type `TB`)
  - `req-LT Brand Pattern.csv` → `tire_brands` + `tire_brand_patterns` (type `LT`)
  - `req-Size.csv` → dibaca dan dihitung saja. **Tidak disimpan**: tidak ada
    tabel ukuran ban. Ukuran dicatat per ban di `tire_specs.size` (PLAN/02 §7).

Hasil pada database kosong: 32 provinsi, 290 kota, 32 merek kendaraan, 174 merek
ban, 1.551 pola ban (1.247 TB + 304 LT).

Kalau direktori CSV tidak ditemukan, seeding **tidak gagal** — data bawaan tetap
masuk — tetapi log mengatakannya dengan jelas. Letaknya bisa diarahkan lewat
`SEED_REQUIREMENTS_DIR`.

### Idempotensi

Setiap baris dicek dulu, lalu dibuat kalau belum ada. Baris yang sudah ada tidak
pernah diubah: kalau admin mengganti nama atau menonaktifkan sebuah merek lewat
layar admin, deployment berikutnya tidak boleh mengembalikannya.

Jalankan ulang kapan saja:

```bash
docker exec -it commercial2026-api-1 pnpm db:seed:init
```

## Yang sengaja manual: akun admin pertama

Password tidak boleh lewat di langkah deployment (PLAN/13 §8). Jadi akun admin
pertama dibuat operator, sekali, setelah stack berjalan:

```bash
docker exec -it commercial2026-api-1 node dist/scripts/seed-prod-admin.js "PasswordAnda123"

# atau dengan username lain (default: admin)
docker exec -it commercial2026-api-1 node dist/scripts/seed-prod-admin.js "PasswordAnda123" --username=superadmin
```

Script itu menolak jalan di luar container dan di luar `APP_ENV=production`.
Akun yang dibuat wajib ganti password saat login pertama, dan — karena admin —
wajib mendaftarkan MFA sebelum bisa melakukan apa pun (PLAN/13 §3.1).

## Development lokal

```bash
pnpm db:migrate    # migrasi + antrian
pnpm db:seed       # master data + admin pertama + data demo
```

`pnpm db:seed` menolak jalan saat `APP_ENV=production`, karena ia juga membuat
akun dan inspeksi contoh. Ia memerlukan `SEED_ADMIN_PASSWORD` (minimal 10
karakter) dan, untuk data demo, `SEED_DEMO_PASSWORD`.

## Kalau deployment berhenti dengan P3009

`prisma migrate deploy` menolak menerapkan apa pun selama masih ada migrasi
gagal yang tercatat, dan catatan itu bertahan sampai operator menyatakan apa yang
terjadi padanya. Ini nyata terjadi di proyek ini: migrasi `0002_login_attempts`
gagal pada 2026-09-01 dengan error 42P07 (`login_attempts` sudah dibuat oleh
`0001_init`), foldernya kemudian dihapus, dan barisnya memblokir setiap
deployment sesudahnya.

Lihat apa yang gagal dan apakah ia sempat mengubah sesuatu:

```bash
docker exec -it commercial2026-postgres-1 psql -U c26 -d c26 \
  -c "select migration_name, started_at, finished_at, applied_steps_count, logs
      from _prisma_migrations where finished_at is null;"
```

`applied_steps_count = 0` berarti database tidak tersentuh, jadi catatannya boleh
ditandai rolled back lalu deployment diulang:

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh db-init \
  -c "cd /app/apps/api && node /app/node_modules/prisma/build/index.js \
      migrate resolve --rolled-back <migration_name>"
```

Kalau ada langkah yang **sudah** diterapkan, jangan lakukan ini — telusuri dulu
apa yang sempat masuk. Langkah ini sengaja manual: skrip deployment yang
membereskan migrasi gagalnya sendiri, cepat atau lambat akan membereskan satu
yang seharusnya diperiksa.

## Riwayat

Sebelum ini, seeding ditulis di `docker-entrypoint.sh` — file yang tidak pernah
di-`COPY` ke image dan tidak pernah dijadikan `ENTRYPOINT`. Ia hanya dirujuk oleh
sebuah komentar di Dockerfile. `db-init` menjalankan `pnpm db:migrate` saja,
sehingga setiap deployment naik dengan `provinces`, `cities`, `vehicle_brands`,
dan `tire_brands` kosong, tanpa satu pun tanda bahwa ada yang dilewati.

Ada enam entrypoint seed yang saling menduplikasi saat itu; sekarang tersisa dua,
masing-masing dengan satu tugas: `seed-init` (otomatis, data referensi) dan
`seed-prod-admin` (manual, akun pertama). Ditambah `prisma/seed.ts` untuk
development lokal.

Dokumen lain di `docs/` yang menyebut `docker-entrypoint.sh`,
`db-init-seed.ts`, `seed-csv-prod.js`, atau `seed-prod.ts` adalah catatan
historis dari periode itu dan tidak lagi menggambarkan sistem yang berjalan.
