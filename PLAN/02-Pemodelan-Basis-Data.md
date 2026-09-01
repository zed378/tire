# 02 — Pemodelan Basis Data (PostgreSQL 18)

**Prasyarat:** dokumen `00`, `01`
**Sasaran:** menerjemahkan model data terobservasi (dok `00` §1.3) menjadi skema yang menegakkan aturan domain di tingkat basis data — bukan hanya di tingkat aplikasi.

---

## 1. Prinsip Pemodelan

1. **Setiap aturan yang bisa ditegakkan oleh constraint, ditegakkan oleh constraint.** `D-04` dan `D-05` lolos karena validasi hanya ada di formulir. Kolom bertipe benar dan `CHECK` yang benar tidak bisa di-bypass oleh bug apa pun di lapisan aplikasi.
2. **Posisi ban adalah baris, bukan kolom.** Sistem berjalan menyimpan konfigurasi dalam bentuk yang tersirat; target menyimpan tiap posisi sebagai baris tersendiri. Inilah yang membuat foto dan spesifikasi bisa diikat ke posisi secara referensial.
3. **Tidak ada penghapusan keras atas data bisnis.** Prinsip `00` §3.3 poin 5. Penghapusan adalah `deleted_at`, dan seluruh query normal menyaringnya.
4. **Status hanya berubah lewat transisi yang sah**, ditegakkan oleh `CHECK` + logika transisi di dokumen `03`.
5. **Pengenal internal adalah `bigint` identity; pengenal yang dilihat pengguna terpisah.** Serial Number (`SN2026-0001`) adalah kode bisnis, bukan kunci primer. Kalau formatnya berubah, kunci tidak ikut goyah.
6. **Nama tabel dan kolom berbahasa Inggris; label yang dilihat pengguna berbahasa Indonesia.** Kamus istilah ada di §9.

---

## 2. Peta Tabel

```
users ──┬── user_regions ──── cities ──── provinces
        │
        ├── submissions ──┬── axle_configs
        │   (SN, status)  ├── tire_positions ──┬── tire_specs
        │                 │                    └── photos (per posisi)
        │                 ├── photos (foto umum)
        │                 └── qc_reviews ──── qc_comments
        │
        └── audit_logs (soft reference ke semua entitas)

Master: provinces, cities, vehicle_brands, tire_brands
Sistem: sessions, login_attempts, serial_counters, daily_metrics
```

---

## 3. Tipe Enum

```sql
CREATE TYPE user_role         AS ENUM ('supplier', 'admin', 'manager', 'operator');
CREATE TYPE submission_status AS ENUM ('draft', 'pending_qc', 'needs_revision', 'passed_qc', 'dropped_qc');
CREATE TYPE vehicle_category  AS ENUM ('TB', 'LT');
CREATE TYPE vehicle_segment   AS ENUM ('bus', 'truck');
CREATE TYPE axle_type         AS ENUM ('steer', 'drive', 'free_rolling');
CREATE TYPE tire_mounting     AS ENUM ('single', 'double');
CREATE TYPE tire_side         AS ENUM ('left', 'right');
CREATE TYPE tire_depth        AS ENUM ('inner', 'outer');
CREATE TYPE photo_slot        AS ENUM ('front_rear', 'side', 'tire_position');
CREATE TYPE qc_decision       AS ENUM ('pass', 'drop', 'revision');
```

**Catatan atas `submission_status`.** Sistem berjalan hanya punya tiga status (`Pending QC`, `Pass QC`, `Drop QC`). Dua ditambahkan:

- `draft` — supplier menyimpan sebagian, belum mengirim. Mengatasi hilangnya isian formulir panjang di lapangan.
- `needs_revision` — menutup `D-11`. Hari ini foto buram berarti seluruh pengajuan gugur dan supplier harus mengulang dari nol.

`manager` dipilih sebagai nilai enum untuk role `PM/PIC/SPV` karena nilai enum sebaiknya pendek dan stabil; labelnya tetap ditampilkan sebagai `PM/PIC/SPV`.

**Catatan atas `operator`.** Peran keempat, tidak diwarisi dari sistem berjalan. Ia ada karena operasional dipegang orang yang berbeda dari pemilik sistem — lihat dokumen `10` §2. Nilainya ditambahkan **sejak migrasi pertama meski panel operasionalnya baru dibangun di F7**, karena menambah nilai ke `ENUM` pada tabel yang sudah berisi data produksi menuntut `ALTER TYPE` yang tidak dapat dijalankan di dalam transaksi pada sebagian versi PostgreSQL. Biayanya nol sekarang, dan merepotkan nanti.

---

## 4. Fondasi Bersama

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Dipasang pada setiap tabel yang punya updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

Konvensi kolom yang berlaku di semua tabel bisnis:

| Kolom        | Tipe                                  | Keterangan     |
| ------------ | ------------------------------------- | -------------- |
| `id`         | `bigint GENERATED ALWAYS AS IDENTITY` | Kunci primer   |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`  |                |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`  | Dijaga trigger |
| `deleted_at` | `timestamptz`                         | `NULL` = aktif |

Seluruh waktu disimpan sebagai `timestamptz` dalam UTC dan ditampilkan sebagai WIB. Sistem berjalan memakai format tanggal `mm/dd/yyyy` di filter QC — format Amerika di aplikasi berbahasa Indonesia. Target memakai `dd/mm/yyyy` di seluruh UI.

---

## 5. Master Data

Menutup Q-07: wilayah menjadi data yang dikelola, bukan konstanta di kode.

```sql
CREATE TABLE provinces (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text   NOT NULL UNIQUE,          -- '31', '32' (kode BPS)
  name        text   NOT NULL UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  province_id bigint NOT NULL REFERENCES provinces(id),
  code        text   NOT NULL UNIQUE,
  name        text   NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, name)
);
CREATE INDEX idx_cities_province ON cities(province_id) WHERE is_active;

CREATE TABLE vehicle_brands (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tire_brands (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

> **Perubahan perilaku.** Sistem berjalan menyimpan `Merk Ban` sebagai teks bebas tanpa daftar — akibatnya `Bridgestone`, `bridgestone`, dan `Bridgstone` menjadi tiga merk berbeda saat dilaporkan. Target memakai daftar yang dikelola, dengan opsi "merk lain" yang menyimpan teks bebas ke `tire_specs.brand_other` dan memunculkannya di antrean peninjauan admin agar dapat dipromosikan menjadi master.

---

## 6. Pengguna & Akses

```sql
CREATE TABLE users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username        citext NOT NULL,
  display_name    text   NOT NULL,
  password_hash   text   NOT NULL,             -- Argon2id
  role            user_role NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_by      bigint REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Username unik hanya di antara pengguna yang belum dihapus
CREATE UNIQUE INDEX uq_users_username_active
  ON users(username) WHERE deleted_at IS NULL;

-- Menutup D-13: supplier dibatasi ke wilayah tertentu. Tanpa baris = tanpa batas.
CREATE TABLE user_regions (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  province_id bigint REFERENCES provinces(id),
  city_id     bigint REFERENCES cities(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(province_id, city_id) = 1)
);
CREATE UNIQUE INDEX uq_user_regions ON user_regions(user_id, COALESCE(province_id,0), COALESCE(city_id,0));
```

**`citext` untuk username** menghapus seluruh kelas bug "kenapa `Admin1` tidak bisa login". Sistem berjalan tidak menunjukkan penanganan apa pun soal ini.

`password_hash` menutup `B-11`. Nilai lama tidak dimigrasikan apa pun bentuknya — lihat dokumen `07` §5.

---

## 7. Pengajuan Kendaraan

```sql
CREATE TABLE submissions (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  serial_number    text NOT NULL UNIQUE,       -- 'SN2026-0001'
  serial_year      int  NOT NULL,
  serial_seq       int  NOT NULL,

  -- Identitas kendaraan
  plate_number     text NOT NULL,
  city_id          bigint NOT NULL REFERENCES cities(id),

  -- Segmentasi
  category         vehicle_category NOT NULL,  -- TB | LT
  segment          vehicle_segment  NOT NULL,  -- bus | truck
  sub_segment      text NOT NULL,              -- 'General Cargo', 'City Bus', ...
  vehicle_brand_id bigint REFERENCES vehicle_brands(id),
  vehicle_brand_other text,
  cargo_type       text NOT NULL,

  -- Konfigurasi poros (ringkasan; rinciannya di axle_configs)
  axle_count       int NOT NULL,
  total_tires      int NOT NULL,

  -- Status
  status           submission_status NOT NULL DEFAULT 'draft',
  submitted_by     bigint NOT NULL REFERENCES users(id),
  submitted_at     timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,

  -- ── Constraint yang menutup cacat sistem berjalan ──

  -- D-05: plat nomor hanya huruf & angka, panjang wajar
  CONSTRAINT ck_plate_format CHECK (plate_number ~ '^[A-Z0-9]{4,11}$'),

  -- D-03: LT tidak boleh bersegmen bus  (lihat dok 03 §4 — perlu konfirmasi bisnis)
  CONSTRAINT ck_lt_not_bus CHECK (NOT (category = 'LT' AND segment = 'bus')),

  -- Jumlah poros hanya nilai yang didukung
  CONSTRAINT ck_axle_count CHECK (axle_count IN (2,3,4,6)),

  -- Batas fisik jumlah ban: 4 (2 poros semua single) s.d. 22 (6 poros semua double).
  -- Rentang ini hasil enumerasi 34 kombinasi sah di dokumen 03 §3, bukan perkiraan.
  CONSTRAINT ck_total_tires CHECK (total_tires BETWEEN 4 AND 22),

  CONSTRAINT ck_serial_parts CHECK (serial_number = 'SN' || serial_year || '-' || lpad(serial_seq::text, 4, '0')),
  CONSTRAINT ck_submitted_at CHECK ((status = 'draft') = (submitted_at IS NULL)),
  CONSTRAINT ck_brand_present CHECK (num_nonnulls(vehicle_brand_id, vehicle_brand_other) >= 1)
);

-- D-06: status `pending_qc`, `needs_revision`, dan `passed_qc` mengunci plat;
-- `dropped_qc` membukanya, `draft` tidak pernah mengunci.
-- Aturan lengkap + alasannya: dokumen 11 §5.4-§5.6.
CREATE UNIQUE INDEX uq_locking_inspection ON submissions(plate_number)
  WHERE deleted_at IS NULL
    AND status IN ('pending_qc', 'needs_revision', 'passed_qc');

CREATE INDEX idx_sub_status_created ON submissions(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_sub_supplier       ON submissions(submitted_by, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_sub_city           ON submissions(city_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sub_reporting      ON submissions(city_id, category, submitted_at) WHERE deleted_at IS NULL AND status = 'passed_qc';
```

`idx_sub_reporting` ada khusus untuk dashboard `F-11`. Tanpa itu, agregasi TB vs LT per kota memindai seluruh tabel — persis kegagalan yang membuat filter QC tidak berskala di sistem berjalan (`B-04`).

### 7.1 Serial Number Tanpa Tabrakan

`B-03` mencatat generator Serial Number rawan tabrakan saat dua supplier submit bersamaan. Di PostgreSQL ini diselesaikan tuntas:

```sql
CREATE TABLE serial_counters (
  year     int PRIMARY KEY,
  last_seq int NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_serial_number(p_year int)
RETURNS text AS $$
DECLARE v_seq int;
BEGIN
  INSERT INTO serial_counters (year, last_seq) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = serial_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN 'SN' || p_year || '-' || lpad(v_seq::text, 4, '0');
END $$ LANGUAGE plpgsql;
```

`ON CONFLICT DO UPDATE … RETURNING` bersifat atomik dan mengunci baris tahun tersebut. Dua request bersamaan mendapat dua nomor berbeda, dijamin oleh mesin basis data.

> **Konsekuensi format.** `lpad(…, 4)` habis pada `SN2026-9999`. Pada 1.200 pengajuan/bulan, itu tercapai di bulan ke-9. **Format harus diperlebar menjadi 5 digit** (`SN2026-00001`) sebelum rilis, atau nomor akan bertabrakan di tahun pertama. `K-05` mempertahankan _pola_ penomoran, bukan lebar digitnya — dan data lama tetap dapat dibaca karena parsing dilakukan pada `serial_year` + `serial_seq`, bukan pada string.

### 7.2 Rincian Konfigurasi Poros

```sql
CREATE TABLE axle_configs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  axle_type     axle_type NOT NULL,
  axle_count    int  NOT NULL CHECK (axle_count BETWEEN 1 AND 5),
  mounting      tire_mounting NOT NULL,
  UNIQUE (submission_id, axle_type),
  -- K-01: poros kemudi selalu single
  CONSTRAINT ck_steer_single CHECK (axle_type <> 'steer' OR mounting = 'single')
);
```

**D-04 ditegakkan lewat trigger**, karena aturan "jumlah sub-poros harus sama dengan `axle_count`" melibatkan banyak baris sekaligus dan tidak bisa dinyatakan sebagai `CHECK` per baris:

```sql
CREATE OR REPLACE FUNCTION assert_axle_sum() RETURNS trigger AS $$
DECLARE v_sub bigint; v_sum int; v_declared int;
BEGIN
  v_sub := COALESCE(NEW.submission_id, OLD.submission_id);
  SELECT COALESCE(SUM(axle_count),0) INTO v_sum FROM axle_configs WHERE submission_id = v_sub;
  SELECT axle_count INTO v_declared FROM submissions WHERE id = v_sub;
  IF v_sum <> v_declared THEN
    RAISE EXCEPTION 'AXLE_SUM_MISMATCH: jumlah poros terinci (%) tidak sama dengan jumlah poros yang dipilih (%)', v_sum, v_declared;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_axle_sum
  AFTER INSERT OR UPDATE OR DELETE ON axle_configs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_axle_sum();
```

`DEFERRABLE INITIALLY DEFERRED` penting: pemeriksaan berjalan saat `COMMIT`, bukan setelah setiap baris. Tanpa itu, memasukkan tiga baris poros akan gagal di baris pertama karena jumlahnya belum lengkap.

---

## 8. Posisi Ban, Spesifikasi, dan Foto

### 8.1 `tire_positions` — Inti Model

Tabel ini adalah materialisasi `K-01` dan `K-02`. Barisnya **tidak pernah diinput manusia** — seluruhnya diturunkan mesin konfigurasi poros (dokumen `03`).

```sql
CREATE TABLE tire_positions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  position_code text NOT NULL,        -- 'DRIVE_1_R_OUT'  (stabil, untuk mesin)
  position_label text NOT NULL,       -- 'Drive 1 Kanan Luar'  (untuk manusia)

  axle_type     axle_type NOT NULL,
  axle_index    int  NOT NULL CHECK (axle_index BETWEEN 1 AND 5),
  side          tire_side NOT NULL,
  depth         tire_depth,           -- NULL pada poros single
  sort_order    int  NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id, position_code),
  UNIQUE (submission_id, sort_order),
  -- depth wajib ada pada double, wajib kosong pada single
  CONSTRAINT ck_depth_consistency CHECK (
    (axle_type = 'steer' AND depth IS NULL) OR axle_type <> 'steer'
  )
);
CREATE INDEX idx_tp_submission ON tire_positions(submission_id, sort_order);
```

`position_code` dipisahkan dari `position_label` karena satu untuk mesin dan satu untuk manusia. Sistem berjalan hanya punya label berbahasa Indonesia, yang berarti setiap perbaikan kalimat di UI berisiko memutus pencocokan foto. Kode yang stabil menghapus risiko itu.

### 8.2 `tire_specs`

```sql
CREATE TABLE tire_specs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tire_position_id bigint NOT NULL UNIQUE REFERENCES tire_positions(id) ON DELETE CASCADE,
  tire_brand_id    bigint REFERENCES tire_brands(id),
  brand_other      text,
  pattern          text,
  size             text,
  ply_rating       text,
  is_retread       boolean NOT NULL DEFAULT false,   -- Vulkanisir Y/N
  filled_by        bigint REFERENCES users(id),
  filled_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_size_format CHECK (size IS NULL OR size ~ '^[0-9]{1,4}(\.[0-9])?[/A-Z0-9.\-]{2,14}$')
);
```

`UNIQUE (tire_position_id)` menegakkan kardinalitas dari dokumen `00` §1.3: satu posisi ban punya **tepat satu** baris spesifikasi.

Seluruh kolom spesifikasi boleh `NULL` karena sistem berjalan mengizinkan pengisian bertahap (terobservasi: hanya `STEER 1 KANAN` yang terisi pada data demo). Kelengkapan dihitung sebagai turunan, bukan disimpan:

```sql
CREATE VIEW v_submission_spec_progress AS
SELECT tp.submission_id,
       count(*)                                                    AS total_positions,
       count(*) FILTER (WHERE ts.pattern IS NOT NULL
                          AND ts.size IS NOT NULL
                          AND (ts.tire_brand_id IS NOT NULL OR ts.brand_other IS NOT NULL)) AS filled_positions
FROM tire_positions tp
LEFT JOIN tire_specs ts ON ts.tire_position_id = tp.id
GROUP BY tp.submission_id;
```

### 8.3 `photos`

```sql
CREATE TABLE photos (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id    bigint NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  tire_position_id bigint REFERENCES tire_positions(id) ON DELETE CASCADE,
  slot             photo_slot NOT NULL,

  storage_key      text NOT NULL UNIQUE,   -- 'submissions/2026/SN2026-00001/DRIVE_1_R_OUT/uuid.webp'
  checksum_sha256  text NOT NULL,
  byte_size        int  NOT NULL CHECK (byte_size > 0),
  mime_type        text NOT NULL CHECK (mime_type IN ('image/webp','image/jpeg')),
  width            int, height int,
  captured_at      timestamptz,            -- dari EXIF bila ada
  uploaded_by      bigint NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,

  -- slot tire_position wajib punya posisi; slot umum wajib tidak punya
  CONSTRAINT ck_slot_position CHECK (
    (slot = 'tire_position') = (tire_position_id IS NOT NULL)
  )
);
CREATE INDEX idx_photos_submission ON photos(submission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_photos_position   ON photos(tire_position_id) WHERE deleted_at IS NULL;
```

**Batas 10 foto per slot (`K-06`) ditegakkan trigger**, bukan hanya di UI:

```sql
CREATE OR REPLACE FUNCTION assert_photo_limit() RETURNS trigger AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM photos
  WHERE submission_id = NEW.submission_id
    AND slot = NEW.slot
    AND tire_position_id IS NOT DISTINCT FROM NEW.tire_position_id
    AND deleted_at IS NULL;
  IF v_count > 10 THEN
    RAISE EXCEPTION 'PHOTO_LIMIT_EXCEEDED: maksimal 10 foto per slot';
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_photo_limit AFTER INSERT ON photos
  FOR EACH ROW EXECUTE FUNCTION assert_photo_limit();
```

`checksum_sha256` menghapus duplikat unggahan akibat pengiriman ulang antrean offline (dokumen `06`).

---

## 9. Verifikasi QC

```sql
CREATE TABLE qc_reviews (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id  bigint NOT NULL REFERENCES submissions(id),
  reviewer_id    bigint NOT NULL REFERENCES users(id),
  decision       qc_decision NOT NULL,
  status_before  submission_status NOT NULL,
  status_after   submission_status NOT NULL,
  notes          text,
  reviewed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_notes_required CHECK (decision = 'pass' OR (notes IS NOT NULL AND length(btrim(notes)) >= 10))
);
CREATE INDEX idx_qc_submission ON qc_reviews(submission_id, reviewed_at DESC);
CREATE INDEX idx_qc_reviewer   ON qc_reviews(reviewer_id, reviewed_at DESC);

CREATE TABLE qc_comments (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id   bigint NOT NULL REFERENCES qc_reviews(id) ON DELETE CASCADE,
  photo_id    bigint REFERENCES photos(id),
  tire_position_id bigint REFERENCES tire_positions(id),
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**`qc_reviews` adalah tabel riwayat, bukan kolom status.** Sistem berjalan menyimpan `Nama Admin QC` sebagai kolom pada record pengajuan — artinya keputusan kedua menimpa yang pertama dan tidak ada yang tahu pernah ada keputusan sebelumnya. Dengan `needs_revision`, satu pengajuan bisa melewati QC berkali-kali, sehingga riwayat menjadi keharusan.

`ck_notes_required` memaksa alasan ditulis saat `drop` atau `revision`. Tanpa itu, `D-11` hanya terpecahkan setengah: supplier tahu ditolak, tapi tidak tahu apa yang harus diperbaiki.

---

## 10. Jejak Audit

Menutup `D-15`.

```sql
CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    bigint REFERENCES users(id),
  actor_role  user_role,
  action      text   NOT NULL,        -- 'submission.status_changed', 'user.deleted'
  entity      text   NOT NULL,        -- 'submission', 'user', 'tire_spec'
  entity_id   bigint NOT NULL,
  before      jsonb,
  after       jsonb,
  request_id  text,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, created_at DESC);
```

Dipartisi per tahun sejak awal. Ini satu-satunya tabel yang tumbuh lebih cepat daripada `photos`, dan partisi membuat pembuangan data lama menjadi `DROP TABLE` — bukan `DELETE` atas jutaan baris.

`request_id` adalah tali penghubung antara apa yang dilihat pengguna, apa yang tercatat di log, dan apa yang muncul di Sentry. Kontraknya dirinci di dokumen `05`.

---

## 11. Sesi & Percobaan Login

```sql
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  user_agent    text,
  ip_address    inet,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username    citext NOT NULL,
  ip_address  inet,
  succeeded   boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts ON login_attempts(username, created_at DESC);
```

Token sesi disimpan sebagai hash, bukan nilai mentah. Basis data yang bocor tidak boleh menyerahkan sesi aktif.

---

## 12. Agregasi Pelaporan

Dashboard `F-11` menghitung ulang agregat setiap kali dimuat. Pada 43.200 pengajuan itu masih cepat dengan `idx_sub_reporting`, tapi materialized view menghapus persoalan sepenuhnya:

```sql
CREATE MATERIALIZED VIEW mv_region_progress AS
SELECT c.province_id, s.city_id, s.category,
       date_trunc('day', s.submitted_at) AS day,
       count(*) AS unit_count
FROM submissions s
JOIN cities c ON c.id = s.city_id
WHERE s.deleted_at IS NULL AND s.status = 'passed_qc'
GROUP BY 1,2,3,4;

CREATE UNIQUE INDEX uq_mv_region ON mv_region_progress(province_id, city_id, category, day);
-- Disegarkan job pg-boss tiap 10 menit:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_region_progress;
```

`CONCURRENTLY` menuntut indeks unik, karena itu `uq_mv_region` ada. Tanpanya, penyegaran mengunci view dan dashboard membeku.

---

## 13. Strategi Indeks & Pertumbuhan

| Tabel            | Baris di tahun ke-3 | Perlakuan                                                           |
| ---------------- | ------------------: | ------------------------------------------------------------------- |
| `submissions`    |              43.200 | Indeks biasa. Tidak perlu partisi                                   |
| `tire_positions` |             345.600 | Indeks biasa                                                        |
| `tire_specs`     |             345.600 | Indeks biasa                                                        |
| `photos`         |             648.000 | Indeks biasa; pertimbangkan partisi per tahun bila melampaui 5 juta |
| `audit_logs`     |         > 2.000.000 | **Dipartisi per tahun sejak awal**                                  |
| `qc_reviews`     |             ~50.000 | Indeks biasa                                                        |

Tidak ada tabel yang menuntut sharding, replika baca, atau partisi hash. Ini penegasan ulang dokumen `01` §1.2: volume yang mematikan Sheets adalah volume yang membosankan bagi PostgreSQL.

---

## 14. Kamus Istilah: Basis Data ↔ UI

| Tabel / kolom                           | Label UI (Bahasa Indonesia)   |
| --------------------------------------- | ----------------------------- |
| `submissions`                           | Pengajuan Kendaraan           |
| `submissions.serial_number`             | Serial Number                 |
| `submissions.plate_number`              | Plat Nomor                    |
| `submissions.category`                  | Kategori TB / LT              |
| `submissions.segment`                   | Segmen Utama                  |
| `submissions.sub_segment`               | Kategori Bus / Kategori Truck |
| `submissions.cargo_type`                | Jenis Muatan                  |
| `submissions.axle_count`                | Jumlah Poros                  |
| `submissions.total_tires`               | Total Jumlah Ban Terhitung    |
| `axle_configs.axle_type = steer`        | Poros Steer (Kemudi)          |
| `axle_configs.axle_type = drive`        | Poros Drive (Penggerak)       |
| `axle_configs.axle_type = free_rolling` | Poros Free Rolling            |
| `axle_configs.mounting`                 | Single / Double               |
| `tire_positions.position_label`         | mis. Drive 1 Kanan Luar       |
| `tire_specs.is_retread`                 | Vulkanisir (Y/N)              |
| `tire_specs.ply_rating`                 | PR (Ply Rating)               |
| `status = pending_qc`                   | Pending QC                    |
| `status = passed_qc`                    | Pass QC                       |
| `status = dropped_qc`                   | Drop QC                       |
| `status = needs_revision`               | Perlu Revisi _(baru)_         |
| `status = draft`                        | Draf _(baru)_                 |
| `role = manager`                        | PM/PIC/SPV                    |

---

## 15. Yang Berubah dari Sistem Berjalan

| Perubahan                                                                                    | Menutup           |
| -------------------------------------------------------------------------------------------- | ----------------- |
| Segmentasi dipecah menjadi 3 kolom bertipe, bukan satu string `"TB - Truck (General Cargo)"` | `D-03`, pelaporan |
| Posisi ban menjadi baris tersendiri                                                          | `K-01`, `K-02`    |
| Serial Number diperlebar ke 5 digit + generator atomik                                       | `B-03`, §7.1      |
| Plat nomor divalidasi regex di basis data                                                    | `D-05`            |
| Indeks unik parsial atas plat yang terkunci                                                  | `D-06`            |
| Jumlah sub-poros ditegakkan trigger                                                          | `D-04`            |
| Status `draft` dan `needs_revision` ditambahkan                                              | `D-11`            |
| Keputusan QC menjadi tabel riwayat                                                           | audit             |
| Kata sandi di-hash Argon2id                                                                  | `B-11`            |
| Wilayah & merk menjadi master data yang dikelola                                             | Q-07              |
| `audit_logs` dipartisi                                                                       | `D-15`            |
| Foto disimpan di R2 dengan checksum                                                          | `B-06`            |
