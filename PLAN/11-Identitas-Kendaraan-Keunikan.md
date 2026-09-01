# 11 — Identitas Kendaraan & Aturan Keunikan

**Prasyarat:** `00`, `02`, `03`
**Mengubah:** `02` (tabel baru + pemisahan), `03` (aturan V-08), `07` (deduplikasi saat migrasi)
**Menutup:** `D-06` secara benar, bukan secara dangkal

---

## 1. Permintaan dan Apa yang Sebenarnya Ia Tuntut

Permintaannya: **setiap data kendaraan adalah unik.**

Kalimat itu terdengar seperti satu `UNIQUE` constraint. Ia bukan. Ia menuntut jawaban atas pertanyaan yang belum pernah dijawab sistem ini: **apa yang membuat sebuah kendaraan menjadi kendaraan yang sama?**

Sistem berjalan tidak punya konsep kendaraan sama sekali. Yang ada hanyalah **pengajuan**, dan plat nomor kebetulan tercatat di dalamnya. Satu Serial Number = satu plat = satu pengajuan (dokumen `00` §1.3). Kendaraan tidak pernah menjadi entitas; ia hanya kolom.

### 1.1 Akibat yang Sudah Terlihat di Rancangan Sekarang

```sql
CREATE UNIQUE INDEX uq_active_plate ON submissions(plate_number)
  WHERE deleted_at IS NULL AND status <> 'dropped_qc';
```

Indeks ini mencakup `passed_qc`. Konsekuensinya:

| Skenario | Perilaku | Sesuai aturan bisnis? |
|---|---|---|
| Dua supplier mengirim plat sama bersamaan | Ditolak | ✅ |
| Pengajuan ditolak QC, supplier kirim ulang | Diizinkan | ✅ |
| Kendaraan lolos QC, diperiksa lagi kemudian | **Ditolak selamanya** | ✅ **disengaja** — lihat §5.4 |

Baris ketiga adalah perilaku yang **dikehendaki**: pemilik sistem menetapkan bahwa status `passed` dan `pending` mengunci plat, sementara `rejected` membukanya. Indeks itu sudah menegakkannya dengan benar.

Yang tetap salah bukan aturannya, melainkan **tempat aturan itu tinggal**. Karena plat adalah kolom pada tabel pengajuan, sistem tidak punya cara menyatakan "kendaraan ini sudah pernah kita data" secara terpisah dari "pengajuan ini sedang berjalan". Dua pernyataan yang berbeda dipaksa berbagi satu baris, dan akibatnya muncul di tempat lain:

| Akibat | Contoh |
|---|---|
| Data kendaraan diketik ulang setiap pemeriksaan | Konfigurasi poros diisi berulang → permukaan `D-04` melebar |
| Tidak ada riwayat per kendaraan | "Kendaraan ini sudah pernah diperiksa?" hanya terjawab lewat pencarian plat |
| Mutasi plat memutus data | Kendaraan yang sama menjadi dua entitas terpisah (§3) |
| Aturan penguncian tidak dapat dilingkupi periode | Awal 2027 menuntut perubahan skema saat produksi berjalan (§5.7) |

**Akar masalahnya bukan indeksnya, melainkan bahwa "kendaraan" dan "pemeriksaan" adalah satu tabel yang sama.** Memisahkannya membuat aturan penguncian Anda dapat dinyatakan dengan tepat — dan dilingkupi periode kalau kelak diperlukan — tanpa mengubah maknanya sama sekali.

---

## 2. Keputusan: Pisahkan Kendaraan dari Pemeriksaan

```
SEBELUM                          SESUDAH
───────                          ───────
submissions                      vehicles          ← identitas, unik
  ├ plate_number                   ├ identitas kendaraan
  ├ segmentasi                     ├ segmentasi
  ├ konfigurasi poros              ├ konfigurasi poros
  ├ status QC                      │
  └ foto + spesifikasi             │ 1 : N
                                   ▼
                                 inspections       ← peristiwa, berulang
                                   ├ serial_number
                                   ├ status QC
                                   └ foto + spesifikasi
```

Satu kendaraan, banyak pemeriksaan sepanjang waktu. Keunikan ditegakkan pada `vehicles`; pemeriksaan bebas berulang.

### 2.1 Mengapa Ini Bukan Perluasan Ruang Lingkup

Dokumen `00` §3.1 memasang penjaga gerbang terhadap godaan membangun manajemen armada. Pemisahan ini **tidak melanggarnya**, dan pembedaannya perlu tegas:

| Yang dibangun | Yang tetap tidak dibangun |
|---|---|
| Identitas kendaraan yang stabil dan unik | Penjadwalan servis |
| Riwayat pemeriksaan per kendaraan | Pelacakan usia & masa pakai ban |
| Data kendaraan diisi sekali, dipakai ulang | Manajemen inventaris ban |
| — | Peringatan penggantian ban |
| — | Biaya per kilometer |

Yang ditambahkan adalah **model identitas yang benar** — prasyarat agar "unik" punya arti. Yang ditolak tetap ditolak. Kalau baris kanan mulai muncul di sprint, itu tanda ruang lingkup melebar, dan `R-08` di dokumen `01` berlaku.

### 2.2 Yang Didapat Secara Gratis

Pemisahan ini menyelesaikan beberapa hal sekaligus tanpa pekerjaan tambahan:

- **Pemeriksaan ulang menjadi mungkin** — kegagalan §1.1 hilang.
- **Supplier tidak mengetik ulang** data kendaraan yang sama pada pemeriksaan kedua. Pengisian formulir panjang di lapangan berkurang drastis.
- **Konfigurasi poros diisi sekali.** `D-04` punya permukaan serang yang jauh lebih kecil: kesalahan konfigurasi hanya mungkin saat kendaraan pertama kali didaftarkan, bukan setiap kali diperiksa.
- **Riwayat menjadi dapat ditanyakan** — "kendaraan ini sudah diperiksa berapa kali" terjawab tanpa fitur baru.

---

## 3. Pertanyaan yang Harus Dijawab: Apa Kunci Identitasnya

Ini keputusan bisnis, bukan teknis, dan tidak bisa saya putuskan untuk Anda. Tiga kandidat:

| Kandidat | Stabil? | Dikumpulkan hari ini? | Masalahnya |
|---|---|---|---|
| **Plat nomor** | ❌ Tidak | ✅ Ya | Berubah saat mutasi antarwilayah, ganti kepemilikan, atau penggantian plat. Plat lama dapat dipakai ulang kendaraan lain |
| **Nomor rangka** (VIN) | ✅ Ya, seumur hidup kendaraan | ❌ Tidak | Menambah field baru. Ada di STNK dan di bodi kendaraan |
| **Nomor mesin** | ⚠️ Berubah kalau mesin diganti | ❌ Tidak | Lebih lemah dari nomor rangka |

**Plat nomor adalah identitas yang salah, dan ini bukan kehalusan teori.** Sebuah truk yang dimutasi dari Jawa Barat ke Jawa Timur akan mendapat plat baru — dan dengan kunci berbasis plat, ia menjadi kendaraan kedua yang berbeda di sistem. Riwayat pemeriksaannya terputus. Sebaliknya, plat yang dilepas dapat dialokasikan ulang ke kendaraan lain — dan sistem akan menganggapnya kendaraan lama.

### 3.1 Rekomendasi: Nomor Rangka sebagai Identitas, Plat sebagai Atribut

```
vehicles
  chassis_number   ← identitas, UNIQUE, tidak pernah berubah
  plate_number     ← atribut saat ini, dapat berubah
     │
     └─ vehicle_plate_history   ← plat sebelumnya + kapan berubah
```

Biayanya: satu field tambahan yang harus diisi supplier di lapangan. Nomor rangka tercantum di STNK, jadi ia tersedia — tapi tetap menambah gesekan pada formulir yang sudah panjang.

Imbalannya: identitas yang benar-benar unik dan benar-benar stabil, plus riwayat plat yang menjelaskan mutasi alih-alih memutus data.

### 3.2 Jalur Bertahap kalau Nomor Rangka Belum Bisa Diwajibkan

Kalau memaksa supplier mengisi nomor rangka dianggap terlalu berat untuk rilis pertama:

| Tahap | Identitas | Catatan |
|---|---|---|
| **F2** | Plat ternormalisasi, `chassis_number` nullable dan opsional | Keunikan berbasis plat; diterima sebagai kompromi sementara |
| **F5+** | Nomor rangka wajib untuk kendaraan **baru**; yang lama diisi bertahap saat pemeriksaan berikutnya | Backfill alami, tanpa proyek migrasi tersendiri |
| Setelah cakupan memadai | `chassis_number` menjadi `NOT NULL`, kunci identitas berpindah | Mengikuti resep migrasi bertahap dokumen `07` |

Kolomnya **tetap ditambahkan sejak migrasi pertama** meski nullable, dengan alasan yang sama seperti enum `operator` di dokumen `02`: menambah kolom ke tabel kosong itu gratis, ke tabel berisi 12.000 baris produksi tidak.

> **Q-11 (baru):** apakah supplier dapat diwajibkan mengisi nomor rangka sejak rilis pertama? Ini memblokir bentuk final `vehicles`.

---

## 4. Normalisasi Plat: Prasyarat Keunikan

Keunikan atas kolom yang tidak dinormalisasi adalah keunikan palsu. `B 1234 ABC`, `b1234abc`, dan `B1234ABC` adalah tiga nilai berbeda bagi PostgreSQL, dan satu kendaraan yang sama bagi manusia.

Sistem berjalan sudah menghapus spasi dan mengapitalkan huruf saat mengetik — tapi hanya di klien, dan `D-05` membuktikan karakter lain lolos (`b 1234 abc!` → `B1234ABC!`).

### 4.1 Dua Kolom, Bukan Satu

| Kolom | Isi | Kegunaan |
|---|---|---|
| `plate_display` | `B 1234 ABC` | Ditampilkan ke pengguna dan dicetak di export. Terbaca manusia |
| `plate_key` | `B1234ABC` | Dihasilkan basis data, dasar keunikan. Tidak pernah ditampilkan |

```sql
plate_display text NOT NULL,
plate_key     text GENERATED ALWAYS AS (
                upper(regexp_replace(plate_display, '[^A-Za-z0-9]', '', 'g'))
              ) STORED,

CONSTRAINT ck_plate_format
  CHECK (plate_display ~ '^[A-Z]{1,2} ?[0-9]{1,4} ?[A-Z]{0,3}$'),
CONSTRAINT ck_plate_key_len
  CHECK (length(plate_key) BETWEEN 3 AND 9)
```

`GENERATED ALWAYS ... STORED` yang membuat ini kokoh: `plate_key` tidak dapat ditulis aplikasi, tidak dapat menyimpang dari `plate_display`, dan tidak dapat dilewati oleh bug di lapisan mana pun. Tidak ada jalur kode yang bisa memasukkan plat yang tidak ternormalisasi.

Regex `ck_plate_format` menggantikan `^[A-Z0-9]{4,11}$` yang ada di dokumen `02`. Yang lama menerima `AAAA` dan `1234` — keduanya bukan plat nomor Indonesia yang sah.

> **Catatan.** Regex ini mengikuti pola plat sipil Indonesia. Plat dinas, kedutaan, dan kendaraan khusus mengikuti pola berbeda. Kalau armada pelanggan mencakup kendaraan seperti itu, regex harus dilonggarkan — dan itu keputusan bisnis yang perlu ditanyakan sebelum F2.

---

## 5. Skema

### 5.1 `vehicles`

```sql
CREATE TABLE vehicles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Identitas
  chassis_number  text,                    -- lihat §3.2; NOT NULL setelah backfill
  plate_display   text NOT NULL,
  plate_key       text GENERATED ALWAYS AS (
                    upper(regexp_replace(plate_display, '[^A-Za-z0-9]', '', 'g'))
                  ) STORED,

  -- Segmentasi (pindah dari submissions)
  category            vehicle_category NOT NULL,
  segment             vehicle_segment  NOT NULL,
  sub_segment         text NOT NULL,
  vehicle_brand_id    bigint REFERENCES vehicle_brands(id),
  vehicle_brand_other text,
  cargo_type          text NOT NULL,

  -- Konfigurasi poros (pindah dari submissions)
  axle_count      int NOT NULL,
  total_tires     int NOT NULL,

  -- Wilayah operasi saat ini
  city_id         bigint NOT NULL REFERENCES cities(id),

  created_by      bigint NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT ck_plate_format  CHECK (plate_display ~ '^[A-Z]{1,2} ?[0-9]{1,4} ?[A-Z]{0,3}$'),
  CONSTRAINT ck_chassis_format CHECK (chassis_number IS NULL OR chassis_number ~ '^[A-Z0-9]{5,25}$'),
  CONSTRAINT ck_lt_not_bus    CHECK (NOT (category = 'LT' AND segment = 'bus')),
  CONSTRAINT ck_axle_count    CHECK (axle_count IN (2,3,4,6)),
  CONSTRAINT ck_total_tires   CHECK (total_tires BETWEEN 4 AND 22)
);

-- Keunikan sesungguhnya
CREATE UNIQUE INDEX uq_vehicle_chassis ON vehicles(chassis_number)
  WHERE deleted_at IS NULL AND chassis_number IS NOT NULL;

CREATE UNIQUE INDEX uq_vehicle_plate ON vehicles(plate_key)
  WHERE deleted_at IS NULL;
```

Dua indeks unik, bukan satu. Nomor rangka unik **kalau ada**; plat unik selalu. Selama masa transisi §3.2, plat yang menegakkan keunikan; setelah backfill selesai, nomor rangka menjadi kunci utama dan indeks plat diturunkan menjadi peringatan, bukan penolakan — karena plat memang boleh berpindah antar kendaraan seiring waktu.

### 5.2 `inspections` (sebelumnya `submissions`)

Tabel `submissions` di dokumen `02` §7 tetap ada dengan nama `inspections`, **dikurangi** seluruh kolom yang pindah ke `vehicles`:

```sql
CREATE TABLE inspections (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id     bigint NOT NULL REFERENCES vehicles(id),

  serial_number  text NOT NULL UNIQUE,
  serial_year    int  NOT NULL,
  serial_seq     int  NOT NULL,

  status         submission_status NOT NULL DEFAULT 'draft',
  submitted_by   bigint NOT NULL REFERENCES users(id),
  submitted_at   timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,

  CONSTRAINT ck_serial_parts CHECK (serial_number = 'SN' || serial_year || '-' || lpad(serial_seq::text, 4, '0')),
  CONSTRAINT ck_submitted_at CHECK ((status = 'draft') = (submitted_at IS NULL))
);

-- Aturan keunikan sesuai keputusan pemilik sistem (§5.4):
-- satu kendaraan hanya boleh punya SATU pemeriksaan yang mengunci.
CREATE UNIQUE INDEX uq_locking_inspection ON inspections(vehicle_id)
  WHERE deleted_at IS NULL
    AND status IN ('pending_qc', 'needs_revision', 'passed_qc');
```

`serial_number` tetap `SN{tahun}-{urut}` dan tetap melekat pada **pemeriksaan**, bukan kendaraan. `K-05` terjaga: format tidak berubah, dan Serial Number lama tetap merujuk hal yang sama, yaitu satu peristiwa pemeriksaan.

### 5.4 Aturan Keunikan: Status Mana yang Mengunci

Keputusan pemilik sistem: **plat yang sama boleh dibuat record baru bila statusnya ditolak atau tidak lolos; tidak boleh bila statusnya lolos atau menunggu.**

Sistem target punya lima status, dan aturan itu menyebut empat keadaan. Pemetaannya:

| Status | Mengunci? | Dasar |
|---|---|---|
| `pending_qc` | 🔒 **Ya** | "pending" — dinyatakan langsung |
| `passed_qc` | 🔒 **Ya** | "passed" — dinyatakan langsung |
| `dropped_qc` | 🔓 Tidak | "rejected" — dinyatakan langsung |
| `needs_revision` | 🔒 **Ya** | **Keputusan turunan — lihat §5.5** |
| `draft` | 🔓 Tidak | **Keputusan turunan — lihat §5.6** |

Ini **mengganti keputusan V-06** pada versi sebelumnya dokumen ini, yang mengeluarkan `passed_qc` dari penguncian agar pemeriksaan ulang mungkin. Aturan pemilik sistem berlaku; konsekuensinya dicatat di §5.7.

### 5.5 Mengapa `needs_revision` Mengunci

`needs_revision` secara harfiah adalah "tidak lolos", sehingga terlihat masuk kategori yang boleh dibuat ulang. Ia tidak, dan alasannya menyangkut `D-11`.

Status ini ada supaya foto buram tidak menggugurkan seluruh pengajuan — supplier memperbaiki lalu mengirim ulang record **yang sama** (dokumen `03` §7, transisi `needs_revision → pending_qc`). Kalau ia tidak mengunci:

| Yang terjadi | Akibat |
|---|---|
| Supplier membuat record baru alih-alih memperbaiki | Record lama tergantung di `needs_revision` selamanya |
| Dua record hidup untuk kendaraan yang sama | Admin QC melihat antrean ganda |
| Alur revisi tidak pernah dipakai | **`D-11` kembali dalam bentuk baru** — fitur ada, tapi tak terpakai |

Membiarkannya membuka mengubah "perbaiki dan kirim ulang" menjadi "buang dan mulai lagi", yang persis perilaku sistem berjalan yang sedang diperbaiki.

### 5.6 Mengapa `draft` Tidak Mengunci

Ini jebakan yang mudah terlewat: memasukkan `draft` ke indeks unik terasa aman, tapi berarti **satu draf yang ditinggalkan mengunci plat itu selamanya**.

Draf ditinggalkan terus-menerus dalam pekerjaan lapangan — sinyal putus, baterai habis, pekerjaan dialihkan. Kalau draf mengunci, setiap kejadian seperti itu menghasilkan plat yang tidak dapat diproses siapa pun, dan satu-satunya jalan keluarnya adalah campur tangan Admin.

Karena itu:

| Kapan | Yang terjadi |
|---|---|
| Membuat draf atas plat yang terkunci | **Diizinkan**, dengan peringatan di layar: *"Kendaraan ini sedang dalam proses (SN2026-0042). Draf ini tidak dapat dikirim selama pemeriksaan itu berjalan."* |
| Mengirim draf (`draft → pending_qc`) | **Diperiksa V-08.** Ditolak bila masih terkunci |
| Draf tidak disentuh 30 hari | Dihapus otomatis oleh pekerjaan terjadwal |

Pemeriksaan terjadi pada **transisi pengiriman**, bukan pada penyimpanan draf. Gerbangnya sudah ada — dokumen `03` §7 mensyaratkan V-01…V-11 lolos pada transisi itu. Pendekatan ini juga menghindari kebocoran informasi: supplier tidak diberi tahu bahwa plat tertentu sedang digarap orang lain sampai ia benar-benar mencoba mengirim.

### 5.7 Konsekuensi yang Perlu Dinyatakan: Kendaraan yang Lolos Terkunci Permanen

Dengan `passed_qc` mengunci, sebuah kendaraan yang lolos QC **tidak akan pernah dapat diperiksa lagi**. Ini konsekuensi langsung dan tak terhindarkan dari aturan yang dipilih.

Kalau memang begitu model bisnisnya — pendataan sekali per kendaraan — aturan ini benar dan tidak ada yang perlu diubah.

Tapi ada petunjuk kuat bahwa modelnya **berbasis periode**, bukan sekali seumur hidup:

- Nama sistemnya **Commercial 2026**.
- Serial Number berformat `SN2026-0001` — tahun dibawa di dalam identitas setiap record.

Kalau ini program tahunan, aturan yang benar bukan "terkunci selamanya" melainkan **"terkunci untuk periode berjalan"**:

```sql
-- Alternatif: penguncian dilingkupi periode kampanye
CREATE UNIQUE INDEX uq_locking_inspection ON inspections(vehicle_id, campaign_year)
  WHERE deleted_at IS NULL
    AND status IN ('pending_qc', 'needs_revision', 'passed_qc');
```

Efeknya persis seperti yang Anda minta di dalam satu tahun — satu kendaraan, satu record yang lolos atau menunggu — sementara periode berikutnya terbuka sendiri tanpa campur tangan siapa pun. Tanpa pelingkupan ini, awal 2027 akan menuntut keputusan mendadak: membuka blokir secara manual untuk 12.000 kendaraan, atau mengubah skema saat produksi berjalan.

> **Q-14 (baru):** apakah pendataan bersifat **per periode** (tahunan) atau **sekali seumur hidup kendaraan**? Kalau per periode, `campaign_year` masuk sejak migrasi pertama. Menambahkannya sekarang gratis; menambahkannya ke indeks unik pada tabel produksi menuntut pembangunan ulang indeks.

Kalau jawabannya "sekali seumur hidup" tetapi kelak muncul kebutuhan memeriksa ulang, jalan keluar yang tersedia tanpa mengubah skema adalah transisi `passed_qc → pending_qc` yang sudah ada di dokumen `03` §7 — terbatas pada Admin, tercatat di audit, dan hanya bila spesifikasi ban belum terisi.

### 5.3 `vehicle_plate_history`

```sql
CREATE TABLE vehicle_plate_history (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id     bigint NOT NULL REFERENCES vehicles(id),
  plate_display  text NOT NULL,
  valid_from     timestamptz NOT NULL,
  valid_to       timestamptz,
  changed_by     bigint NOT NULL REFERENCES users(id),
  reason         text
);
```

Diisi otomatis oleh trigger setiap `plate_display` berubah. Tanpa ini, mutasi plat menghapus jejak dan pemeriksaan lama tampak milik kendaraan yang tidak pernah ada.

---

## 6. Alur Supplier yang Berubah

Bagian ini menentukan apakah pemisahan terasa membantu atau merepotkan di lapangan.

```
Supplier menekan "Pemeriksaan Baru"
   │
   ├─ Ketik plat (atau pindai nomor rangka)
   │
   ├─ SISTEM MENCARI kendaraan yang cocok
   │
   ├── KETEMU ─────────────────────────────────────────┐
   │     Tampilkan kartu ringkas:                      │
   │       B 1234 ABC · Hino · TB-Truck · 6 Ban        │
   │       Terakhir diperiksa: 12 Mar 2026 (Pass QC)   │
   │                                                    │
   │     [Ya, kendaraan ini]  →  langsung ke foto ─────┤
   │     [Bukan / data berubah] → form koreksi ────────┤
   │                                                    ▼
   └── TIDAK KETEMU → form lengkap (identitas +      Slot foto
                       segmentasi + konfigurasi        per posisi
                       poros)  ─────────────────────────┘
```

**Tiga aturan yang mengikat alur ini:**

1. **Pencarian dilakukan atas `plate_key`, bukan `plate_display`.** Supplier mengetik dengan spasi atau tanpa spasi, hasilnya sama.
2. **Kendaraan yang ketemu tidak boleh langsung dipakai tanpa konfirmasi.** Plat dapat dipakai ulang kendaraan lain; menganggap kecocokan plat sebagai kepastian identitas justru menciptakan kelas kesalahan baru. Kartu ringkas ada supaya supplier dapat menyanggah.
3. **Supplier hanya melihat kendaraan yang pernah ia periksa**, kecuali pencarian nomor rangka. Kalau seluruh supplier dapat menelusuri seluruh armada lewat plat, sistem berubah menjadi direktori kendaraan pelanggan — masalah privasi yang tidak perlu diciptakan.

> **Q-12 (baru):** kalau supplier A mengetik plat yang sudah didaftarkan supplier B, apa yang terjadi? Tiga opsi: (a) tolak sebagai duplikat, (b) izinkan memakai kendaraan yang sama, (c) izinkan dan tandai untuk ditinjau Admin. Jawabannya bergantung pada apakah satu armada dilayani lebih dari satu supplier — dan itu fakta bisnis yang saya tidak tahu.

---

## 7. Dampak ke Dokumen Lain

| Dokumen | Perubahan |
|---|---|
| `02` | Tabel `vehicles` + `vehicle_plate_history` baru. `submissions` → `inspections`, kehilangan 9 kolom. `uq_active_plate` diganti `uq_locking_inspection` (§5.4). Seluruh FK `submission_id` → `inspection_id` |
| `03` | **V-08 ditulis ulang** — dari "plat belum dipakai pengajuan aktif" menjadi "kendaraan belum punya pemeriksaan berjalan". Aturan konfigurasi poros (V-01…V-07) berpindah sasaran ke `vehicles` |
| `05` | Endpoint pencarian kendaraan baru. `POST /inspections` menerima `vehicleId` atau blok kendaraan baru |
| `07` | **Deduplikasi menjadi langkah migrasi tersendiri** — lihat §8 |
| `08` | F2 bertambah: entitas kendaraan, pencarian, alur konfirmasi. Perkirakan **+1 minggu** implementasi dan verifikasi |
| `09` | Uji baru: normalisasi plat, keunikan lintas soft-delete, penolakan pemeriksaan ganda |

---

## 8. Deduplikasi Saat Migrasi

Ini pekerjaan yang tidak bisa dihindari, dan harus dilakukan **sebelum** data masuk.

Dokumen `07` §3 sudah mencatat kemungkinan duplikat plat karena `D-06`. Dengan model kendaraan, konsekuensinya berubah: setiap kelompok baris dengan `plate_key` sama harus dipetakan menjadi **satu** `vehicles` dan **beberapa** `inspections`.

| Langkah | Tindakan |
|---|---|
| 1 | Normalisasi seluruh plat dari sheet menjadi `plate_key` |
| 2 | Kelompokkan menurut `plate_key`. Kelompok berukuran 1 aman |
| 3 | Untuk kelompok > 1: bandingkan segmentasi, merk, dan konfigurasi poros |
| 4 | **Konsisten** → satu kendaraan, N pemeriksaan. Ambil atribut dari baris terbaru |
| 5 | **Bertentangan** (mis. plat sama tapi 2 poros vs 3 poros) → **karantina**, keputusan manusia |
| 6 | Plat yang gagal `ck_plate_format` → karantina, diperbaiki manual |

Langkah 5 adalah yang paling mungkin memakan waktu. Plat sama dengan konfigurasi poros berbeda berarti salah satunya salah — dan `D-04` membuat itu sangat mungkin terjadi, karena sistem berjalan tidak pernah memvalidasi konfigurasi poros sama sekali. **Perkirakan jumlahnya tidak kecil**, dan sediakan waktu untuk menyelesaikannya sebelum F6 dimulai.

---

## 9. Ringkasan Keputusan

| # | Keputusan | Status |
|---|---|---|
| V-01 | Kendaraan dipisah dari pemeriksaan menjadi dua tabel | Diusulkan, menunggu persetujuan |
| V-02 | Nomor rangka sebagai identitas final; plat sebagai atribut | Menunggu **Q-11** |
| V-03 | Kolom `chassis_number` ditambahkan sejak migrasi pertama, nullable | Dianjurkan tanpa syarat |
| V-04 | `plate_key` sebagai kolom `GENERATED ALWAYS ... STORED` | Dianjurkan tanpa syarat |
| V-05 | Regex plat diperketat ke pola plat Indonesia | Perlu konfirmasi soal plat dinas |
| V-06 | **Penguncian oleh `pending_qc`, `needs_revision`, `passed_qc`; dibuka oleh `dropped_qc`** | **Ditetapkan pemilik sistem** |
| V-09 | `draft` tidak mengunci; V-08 diperiksa pada transisi pengiriman | Dianjurkan — §5.6 |
| V-10 | Draf tak tersentuh 30 hari dihapus otomatis | Dianjurkan — §5.6 |
| V-11 | `campaign_year` melingkupi penguncian | Menunggu **Q-14** |
| V-07 | Riwayat plat dicatat lewat trigger | Dianjurkan tanpa syarat |
| V-08 | Visibilitas kendaraan dibatasi per supplier | Menunggu **Q-12** |
