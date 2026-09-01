# 07 — Strategi Migrasi Data

**Prasyarat:** dokumen `02`, `03`, `06`
**Blokir:** Q-02 (sudah produksi atau masih pilot) dan Q-03 (berapa banyak data nyata) belum dijawab

> **Status dokumen.** Ini kerangka yang lengkap secara metode, tapi angkanya belum bisa diisi. Langkah pertama di §1 adalah inventarisasi yang menghasilkan angka-angka itu. Jangan menjadwalkan migrasi sebelum §1 selesai.

---

## 1. Inventarisasi: Langkah yang Harus Dikerjakan Lebih Dulu

Empat hal yang belum diketahui dan harus diukur, bukan diperkirakan:

| # | Yang diukur | Cara |
|---|---|---|
| I-01 | Jumlah baris per sheet, nama sheet, header tiap kolom | Buka spreadsheet, catat apa adanya |
| I-02 | Jumlah dan total ukuran berkas di folder Drive | Skrip Apps Script yang menghitung rekursif |
| I-03 | Bentuk penyimpanan kata sandi di sheet pengguna | Lihat langsung — menentukan §5 |
| I-04 | Struktur kolom berkas hasil Export Excel | Klik export, buka berkasnya. Menutup Q-09 |

I-04 penting melampaui migrasi: berkas export adalah kontrak pelaporan yang sudah dipakai orang. Kalau format target berbeda, ada proses kerja hilir yang patah tanpa ada yang memberi tahu.

---

## 2. Prinsip

1. **Sistem lama tidak pernah dimatikan sampai sistem baru terbukti.** Berjalan paralel, bukan pemindahan satu malam.
2. **Migrasi bersifat idempoten.** Dapat dijalankan berulang tanpa menggandakan apa pun. Jaminannya: kunci alami (`serial_number` untuk pengajuan, `checksum` untuk foto).
3. **Data kotor dipindahkan apa adanya, lalu dikarantina** — bukan diperbaiki diam-diam oleh skrip. Skrip yang menebak niat manusia menghasilkan kesalahan yang lebih sulit ditemukan daripada data kotornya sendiri.
4. **Foto adalah bagian tersulit**, bukan barisnya. Baris berjumlah puluhan ribu; foto berjumlah ratusan ribu berkas yang harus dipindahkan lintas penyedia.
5. **Setiap tahap dapat dibatalkan** sampai titik cutover.

---

## 3. Pemetaan Sheet → Tabel

Kolom sumber ditulis sebagai **[perlu I-01]** karena nama sebenarnya belum diketahui — audit hanya melihat label UI, bukan header sheet.

| Sumber (perkiraan) | Tujuan | Transformasi |
|---|---|---|
| Sheet pengguna | `users` | Peran dipetakan ke enum; kata sandi **tidak dimigrasikan** (§5) |
| Sheet pengajuan | `submissions` | Lihat §3.1 |
| Kolom konfigurasi poros | `axle_configs` | Diurai menjadi baris per jenis poros |
| *(tidak ada di sumber)* | `tire_positions` | **Diturunkan**, bukan disalin. Lihat §3.2 |
| Sheet spesifikasi ban | `tire_specs` | Dicocokkan ke posisi lewat nama posisi |
| Folder Drive | `photos` + objek R2 | Lihat §4 |
| Daftar provinsi/kota di kode | `provinces`, `cities` | 5 provinsi, 17 kota dari dokumen `00` §1.4 |
| Nilai merk yang muncul di data | `vehicle_brands`, `tire_brands` | Dinormalisasi, duplikat ejaan digabung manual |

### 3.1 Transformasi yang Tidak Sepele

**Segmentasi.** Sistem lama menyimpan satu string gabungan `"TB - Truck (General Cargo)"`. Target memakai tiga kolom bertipe. Penguraian memakai pola `{kategori} - {segmen} ({sub-segmen})`. Baris yang tidak cocok pola masuk karantina — **tidak ditebak**.

**Plat nomor.** `D-05` berarti data yang ada **sudah mengandung** plat dengan karakter tidak sah, karena `!` terbukti lolos. Skrip menormalkan (buang spasi, kapitalkan) lalu menguji `^[A-Z0-9]{4,11}$`. Yang gagal masuk karantina untuk diperbaiki manusia — bukan dipaksa lolos dengan membuang karakternya, karena `B1234ABC!` mungkin salah ketik dari `B1234ABC1`.

**Duplikat plat.** `D-06` berarti mungkin ada dua pengajuan dengan plat sama yang keduanya berstatus mengunci (`pending_qc`, `needs_revision`, atau `passed_qc`). `uq_locking_inspection` akan menolaknya. Deteksi dilakukan **sebelum** migrasi berjalan, dan penyelesaiannya adalah keputusan manusia: mana yang benar, mana yang dibatalkan.

Perhatikan bahwa plat yang berulang dengan status `dropped_qc` **bukan** duplikat dan tidak perlu diselesaikan — itu justru pola yang sah menurut aturan §5.4 dokumen `11`: ditolak, lalu diajukan ulang. Menyaringnya sebagai konflik akan menghasilkan ratusan temuan palsu yang memboroskan waktu karantina.

**Status.** Tiga status lama dipetakan langsung; `draft` dan `needs_revision` tidak punya sumber dan tetap kosong.

### 3.2 `tire_positions` Diturunkan, Bukan Disalin

Ini bagian terpenting dari seluruh migrasi.

Sistem lama tidak menyimpan posisi ban sebagai baris — ia menghitungnya ulang di UI setiap kali. Karena itu `tire_positions` **dibangkitkan** oleh `derivePositions()` (dokumen `03` §5) dari konfigurasi poros yang dimigrasikan, bukan disalin dari mana pun.

Ini juga yang membuat penamaan posisi target harus identik dengan yang lama (`K-02`) — kalau berbeda, foto lama tidak akan berpasangan dengan posisi baru.

**Tapi `D-04` menciptakan masalah nyata di sini.** Karena jumlah sub-poros tidak pernah divalidasi, data lama mungkin berisi pengajuan dengan `Jumlah Poros = 6` tetapi rincian yang berjumlah 3. V-01 akan menolaknya. Ada tiga pilihan, dan pilihannya harus dibuat manusia:

| Pilihan | Konsekuensi |
|---|---|
| Percayai `Jumlah Poros`, sesuaikan rincian | Menebak sub-poros mana yang salah |
| Percayai rincian, sesuaikan `Jumlah Poros` | Jumlah ban tetap benar; ini yang dilihat QC saat memutuskan |
| Karantina, perbaiki satu per satu | Paling lambat, paling benar |

**Rekomendasi: pilihan ketiga untuk pengajuan `passed_qc`, pilihan kedua untuk sisanya.** Pengajuan yang sudah lolos QC berarti seorang manusia sudah melihat fotonya dan menyetujuinya; datanya terlalu penting untuk ditebak. Jumlah kasusnya perlu diukur di I-01 sebelum keputusan ini dikunci.

---

## 4. Migrasi Foto

Bagian paling berisiko dan paling lama.

### 4.1 Pencocokan

Konvensi path Drive terekspos di UI sistem lama: `{SerialNumber}_{PlatNomor}_{Posisi}`. Ini yang membuat pencocokan mungkin.

```
SN2026-0001_B9876UYT_Drive_1_Kanan_Luar
     │           │              │
     │           │              └─► position_label → position_code (DRIVE_1_R_OUT)
     │           └─► verifikasi silang plat nomor
     └─► submissions.serial_number
```

**Risiko yang harus diantisipasi:** plat nomor yang mengandung karakter tidak sah (`D-05`) ikut masuk ke nama path. Berkas dengan path yang tidak dapat diurai masuk daftar yatim dan ditinjau manual — jangan pernah dilewati diam-diam.

### 4.2 Prosedur

1. Inventarisasi rekursif seluruh berkas: path, ukuran, hash (I-02).
2. Urai path menjadi `serial_number` + `position_code`. Yang gagal → daftar yatim.
3. Unduh, hitung SHA-256, kompresi ke profil dokumen `06` §3, unggah ke R2 dengan `storage_key` skema baru.
4. Sisipkan baris `photos` dengan `checksum_sha256`.
5. Verifikasi: jumlah objek R2 = jumlah baris `photos` = jumlah berkas Drive dikurangi yatim.

Dijalankan sebagai job pg-boss berbatch, dapat dijeda dan dilanjutkan. **Bukan sebagai satu skrip panjang** — pada ratusan ribu berkas, skrip yang mati di tengah tanpa kemampuan melanjutkan berarti mengulang dari nol.

### 4.3 Kompresi Ulang: Keputusan

Foto lama diunggah tanpa kompresi klien, jadi kemungkinan berukuran 3–8 MB.

| Pilihan | Konsekuensi |
|---|---|
| Kompres ulang ke profil baru | Hemat penyimpanan besar; **mengubah bukti kerja** |
| Simpan asli apa adanya | Bukti utuh; biaya penyimpanan jauh lebih besar |
| Simpan asli + buat turunan terkompresi | Keduanya; biaya paling tinggi |

**Rekomendasi: pilihan kedua untuk arsip.** Foto adalah bukti kerja (`00` §3.3 poin 5), dan memodifikasinya saat migrasi menghapus kemampuan membuktikan foto itu asli. Foto baru tetap dikompresi di perangkat sebelum pernah menyentuh server, jadi ini hanya berlaku untuk arsip lama yang jumlahnya terbatas dan tidak bertambah.

---

## 5. Kata Sandi Tidak Dimigrasikan

`B-11` mencatat kata sandi kemungkinan tersimpan sebagai teks polos. Apa pun hasil I-03, **tidak ada satu pun kata sandi lama yang dipindahkan.**

- Teks polos → tidak boleh masuk sistem baru dalam bentuk apa pun.
- Hash lemah (MD5/SHA-1 tanpa salt) → sama saja.
- Bahkan hash kuat → sudah tersimpan di tempat yang dapat dibaca banyak orang selama entah berapa lama.

Prosedur: setiap pengguna dibuat ulang dengan kata sandi awal sekali pakai dan `must_change_password = true`, disampaikan lewat kanal yang sudah ada antara admin dan pengguna. Ini bukan kerumitan tambahan — hanya satu kali kerja, dan menutup seluruh kelas risiko.

---

## 6. Berjalan Paralel

| Minggu | Sistem lama | Sistem baru |
|---|---|---|
| 1–2 | Pemakaian normal | Migrasi awal + verifikasi |
| 3–4 | Pemakaian normal, **sumber kebenaran** | Bayangan: data dimasukkan ganda oleh 1–2 supplier terpilih |
| 5–6 | Read-only | **Sumber kebenaran** |
| 7–8 | Read-only | Sumber kebenaran; sistem lama diarsipkan |

Minggu 3–4 adalah bagian yang sering dilewati dan sering disesali. Memasukkan data ganda memang menyebalkan, tapi itulah satu-satunya cara menemukan selisih hasil sebelum ada yang bergantung padanya.

**Yang dibandingkan setiap hari selama minggu 3–4:**
- Jumlah pengajuan per status
- Total ban per pengajuan pada sampel 20 kendaraan
- Jumlah foto per pengajuan
- Angka dashboard TB vs LT per kota

Selisih apa pun dicatat dan dijelaskan sebelum melangkah ke minggu 5. Selisih yang tidak dapat dijelaskan menahan cutover.

---

## 7. Cutover & Rollback

**Prasyarat sebelum minggu 5 (semua wajib):**

- [ ] Migrasi awal berjalan bersih; daftar karantina kosong atau seluruhnya sudah diputuskan
- [ ] Jumlah foto cocok: Drive = R2 = baris `photos`
- [ ] Nol selisih tak terjelaskan selama 5 hari kerja berturut-turut
- [ ] Seluruh pengguna sudah punya akun dan sudah pernah login
- [ ] Backup diuji pulih ke staging, tercatat tanggalnya
- [ ] Berkas export baru dibandingkan dengan yang lama (I-04) dan disetujui pemakainya

**Rollback.** Sampai akhir minggu 6, pembatalan berarti mengembalikan sistem lama menjadi dapat ditulis. Karena itu sistem lama dijadikan read-only, **bukan dihapus** — biayanya nol dan ia adalah jaring pengaman.

Setelah minggu 6, rollback tidak lagi realistis: data baru sudah masuk hanya ke sistem baru. Titik ini harus dinyatakan eksplisit ke semua pihak, bukan dilewati diam-diam.

---

## 8. Karantina

Setiap baris yang tidak lolos masuk tabel karantina, bukan dibuang dan bukan dipaksa masuk:

```sql
CREATE TABLE migration_quarantine (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_sheet text   NOT NULL,
  source_row   int    NOT NULL,
  raw          jsonb  NOT NULL,
  reason       text   NOT NULL,   -- 'INVALID_PLATE', 'AXLE_SUM_MISMATCH', 'DUPLICATE_PLATE', ...
  resolved_at  timestamptz,
  resolved_by  bigint REFERENCES users(id),
  resolution   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Migrasi dianggap selesai ketika setiap baris karantina punya `resolved_at` — termasuk yang keputusannya "abaikan, data uji". Yang penting adalah keputusannya tercatat, bukan bahwa semuanya masuk.

---

## 9. Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Volume data jauh lebih besar dari perkiraan | Jadwal meleset | I-01 dan I-02 sebelum menjadwalkan apa pun |
| Banyak pengajuan melanggar V-01 (`D-04`) | Karantina membengkak | Ukur lebih dulu; §3.2 menyiapkan tiga jalur |
| Path foto tidak dapat diurai | Foto yatim | Tinjau manual; jangan dilewati |
| Kuota Drive terlampaui saat mengunduh massal | Migrasi berhenti | Batch dengan jeda; jalankan di luar jam kerja |
| Pengguna menolak login ganda di minggu 3–4 | Verifikasi kosong | Batasi ke 1–2 supplier yang bersedia, bukan semua |
| Format export baru berbeda | Proses hilir patah | I-04 lebih dulu; libatkan pemakainya |
| Sistem lama tetap ditulis setelah minggu 5 | Data bercabang | Cabut izin tulis secara teknis, bukan lewat imbauan |
