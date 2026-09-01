# 03 — Aturan Domain & Mesin Konfigurasi Poros

**Prasyarat:** dokumen `00`, `02`
**Sasaran:** memformalkan `K-01` dan `K-02` — bagian sistem yang paling bernilai dan paling rapuh — lalu menutup `D-03`, `D-04`, `D-05`, `D-06`, dan `D-11`.

> **Mengapa dokumen ini terpisah.** Mesin konfigurasi poros adalah satu-satunya bagian sistem yang tidak bisa dibeli, tidak bisa ditiru dari template, dan salahnya tidak akan ketahuan sampai berbulan-bulan kemudian. Sistem berjalan sudah punya rumusnya dengan benar — yang tidak dimilikinya adalah penegakan, spesifikasi tertulis, dan pengujian. Ketiganya ditambahkan di sini.

---

## 1. Peran Mesin dalam Sistem

```
Supplier memilih:  Jumlah Poros + rincian per jenis poros + Single/Double
                             │
                             ▼
                ┌────────────────────────────┐
                │  MESIN KONFIGURASI POROS   │   logika murni, tanpa I/O
                │  derivePositions(configs)  │
                └────────────┬───────────────┘
                             │  menghasilkan N posisi bernama
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
      slot upload      kartu spesifikasi   path penyimpanan
         foto              ban              objek di R2
```

Satu fungsi, tiga konsumen. Inilah alasan `K-02` (konsistensi penamaan) begitu penting: kalau ketiganya menurunkan nama secara terpisah, foto dan spesifikasi akan berhenti berpasangan pada kombinasi poros yang jarang dipakai, dan tidak ada yang menyadarinya.

**Aturan yang mengikat:** tidak ada kode lain di seluruh sistem yang boleh membangun nama posisi ban. Hanya modul `axle` yang boleh.

---

## 2. Spesifikasi Formal

### 2.1 Masukan

```typescript
type AxleType    = 'steer' | 'drive' | 'free_rolling';
type Mounting    = 'single' | 'double';

interface AxleConfig {
  axleType:  AxleType;
  axleCount: number;      // 1..5
  mounting:  Mounting;
}
```

### 2.2 Rumus Jumlah Ban

Tervalidasi terhadap sistem berjalan (dokumen `00`, empat bukti uji):

```
total_ban = Σ  axleCount × (mounting === 'double' ? 4 : 2)
```

### 2.3 Tata Nama Posisi

**Urutan pembangkitan.** Poros dienumerasi menurut urutan tetap `steer → drive → free_rolling`. Dalam satu jenis poros, indeks berjalan `1..axleCount`. Dalam satu poros, ban dienumerasi dari kanan-luar ke kiri-luar:

| Mounting | Urutan ban dalam satu poros |
|---|---|
| `single` | Kanan → Kiri |
| `double` | Kanan Luar → Kanan Dalam → Kiri Dalam → Kiri Luar |

Urutan `double` ini bukan pilihan sembarang — ia menyalin persis apa yang terobservasi di sistem berjalan, sehingga slot foto lama dan baru tetap berpasangan saat migrasi (dokumen `07`).

**Dua bentuk nama, satu sumber.**

| Bentuk | Contoh | Dipakai untuk |
|---|---|---|
| `position_code` | `DRIVE_1_R_OUT` | Mesin: kunci basis data, path R2, kunci API |
| `position_label` | `Drive 1 Kanan Luar` | Manusia: label UI, judul kartu, laporan Excel |

Sistem berjalan hanya punya label berbahasa Indonesia dan memakainya juga sebagai path Drive (`SN_Plat_Drive_1_Kanan_Luar`). Akibatnya setiap perbaikan kalimat di UI berisiko memutus pencocokan foto. Pemisahan kode/label menghapus risiko itu permanen.

Tata bahasa kode:

```
{JENIS}_{INDEKS}_{SISI}[_{KEDALAMAN}]

JENIS      := STEER | DRIVE | FREE
INDEKS     := 1..5
SISI       := R | L
KEDALAMAN  := OUT | IN        (hanya pada mounting = double)
```

---

## 3. Kombinasi yang Sah

Hasil enumerasi program (bukan tulisan tangan) atas seluruh kombinasi yang memenuhi aturan V-01 sampai V-04 di §4.

| Poros | Steer | Drive | Free | Drive mtg | Free mtg | Ban |
|---:|---:|---:|---:|---|---|---:|
| 2 | 1 | 1 | 0 | double | — | 6 |
| 2 | 1 | 1 | 0 | single | — | 4 |
| 3 | 1 | 2 | 0 | double | — | 10 |
| 3 | 1 | 2 | 0 | single | — | 6 |
| 4 | 1 | 1 | 2 | double | double | 14 |
| 4 | 1 | 1 | 2 | double | single | 10 |
| 4 | 1 | 1 | 2 | single | double | 12 |
| 4 | 1 | 1 | 2 | single | single | 8 |
| 4 | 1 | 2 | 1 | double | double | 14 |
| 4 | 1 | 2 | 1 | double | single | 12 |
| 4 | 1 | 2 | 1 | single | double | 10 |
| 4 | 1 | 2 | 1 | single | single | 8 |
| 4 | 2 | 1 | 1 | double | double | 12 |
| 4 | 2 | 1 | 1 | double | single | 10 |
| 4 | 2 | 1 | 1 | single | double | 10 |
| 4 | 2 | 1 | 1 | single | single | 8 |
| 4 | 2 | 2 | 0 | double | — | 12 |
| 4 | 2 | 2 | 0 | single | — | 8 |
| 6 | 1 | 1 | 4 | double | double | 22 |
| 6 | 1 | 1 | 4 | double | single | 14 |
| 6 | 1 | 1 | 4 | single | double | 20 |
| 6 | 1 | 1 | 4 | single | single | 12 |
| 6 | 1 | 2 | 3 | double | double | 22 |
| 6 | 1 | 2 | 3 | double | single | 16 |
| 6 | 1 | 2 | 3 | single | double | 18 |
| 6 | 1 | 2 | 3 | single | single | 12 |
| 6 | 2 | 1 | 3 | double | double | 20 |
| 6 | 2 | 1 | 3 | double | single | 14 |
| 6 | 2 | 1 | 3 | single | double | 18 |
| 6 | 2 | 1 | 3 | single | single | 12 |
| 6 | 2 | 2 | 2 | double | double | 20 |
| 6 | 2 | 2 | 2 | double | single | 16 |
| 6 | 2 | 2 | 2 | single | double | 16 |
| 6 | 2 | 2 | 2 | single | single | 12 |

**34 kombinasi sah. Rentang jumlah ban: 4 sampai 22.**

Rentang ini yang menjadi dasar `ck_total_tires` di dokumen `02` §7. Angka apa pun di luar 4–22 berarti ada bug di mesin, bukan kendaraan yang tidak biasa.

> **Keputusan yang perlu konfirmasi bisnis.** Baris `4 | 2 | 2 | 0` dan `6 | 2 | 2 | 2` mengizinkan **dua poros steer**. Sistem berjalan memang menawarkan pilihan `2 Poros` pada dropdown steer untuk konfigurasi 4 dan 6 poros, jadi ini menyalin perilaku yang ada. Kendaraan berporos kemudi ganda memang nyata (truk berat, crane), tapi perlu dipastikan apakah memang masuk ruang lingkup produk.

### 3.1 Contoh Keluaran

Konfigurasi `2 poros — Steer 1 Single, Drive 1 Double` menghasilkan (diverifikasi identik dengan UI sistem berjalan):

| # | `position_label` | `position_code` |
|---:|---|---|
| 1 | Steer 1 Kanan | `STEER_1_R` |
| 2 | Steer 1 Kiri | `STEER_1_L` |
| 3 | Drive 1 Kanan Luar | `DRIVE_1_R_OUT` |
| 4 | Drive 1 Kanan Dalam | `DRIVE_1_R_IN` |
| 5 | Drive 1 Kiri Dalam | `DRIVE_1_L_IN` |
| 6 | Drive 1 Kiri Luar | `DRIVE_1_L_OUT` |

---

## 4. Matriks Validasi

Setiap aturan ditegakkan di **dua** tempat: klien untuk kenyamanan, server untuk kebenaran. Prinsip dokumen `00` §3.3 poin 3.

| # | Aturan | Menutup | Ditegakkan di |
|---|---|---|---|
| V-01 | `axleCount` total (steer + drive + free rolling) **harus sama** dengan `Jumlah Poros` yang dipilih | **D-04** | Zod + trigger `trg_axle_sum` |
| V-02 | Poros steer selalu `mounting = single` | `K-01` | Zod + `ck_steer_single` |
| V-03 | Poros steer dan drive wajib ada, minimal 1 | — | Zod |
| V-04 | Free rolling hanya boleh ada bila `Jumlah Poros` ∈ {4, 6} | — | Zod |
| V-05 | `Jumlah Poros` ∈ {2, 3, 4, 6} | — | Zod + `ck_axle_count` |
| V-06 | `total_tires` hasil mesin harus sama dengan yang tersimpan | integritas | Dihitung ulang di server; klien tidak pernah dipercaya |
| V-07 | Plat nomor cocok `^[A-Z0-9]{4,11}$` | **D-05** | Zod + `ck_plate_format` |
| V-08 | Kendaraan belum punya pemeriksaan berstatus `pending_qc`, `needs_revision`, atau `passed_qc` | **D-06** | `uq_locking_inspection` (dok `11` §5.4) |
| V-09 | `LT` tidak boleh bersegmen `bus` | **D-03** | Zod + `ck_lt_not_bus` |
| V-10 | `sub_segment` harus milik `segment` yang dipilih | — | Zod |
| V-11 | Kota harus milik provinsi yang dipilih | — | Zod + FK |
| V-12 | Kota harus termasuk wilayah penugasan supplier (bila ada) | `D-13` | Server |
| V-13 | Maksimal 10 foto per slot | `K-06` | `trg_photo_limit` |
| V-14 | Alasan wajib diisi saat keputusan `drop` atau `revision` | **D-11** | Zod + `ck_notes_required` |

### 4.1 Catatan atas V-07 — Plat Nomor

Sistem berjalan menghapus spasi dan mengapitalkan huruf, tapi meloloskan `!` (`b 1234 abc!` → `B1234ABC!`). Regex `^[A-Z0-9]{4,11}$` menutupnya.

Regex ini sengaja **tidak** memvalidasi struktur plat Indonesia (`[A-Z]{1,2}[0-9]{1,4}[A-Z]{1,3}`). Alasannya: plat khusus, plat dinas, plat sementara, dan kendaraan impor tidak selalu mengikuti pola itu, dan menolak kendaraan sah di lapangan jauh lebih merugikan daripada menerima plat yang aneh. Yang dicegah adalah karakter yang merusak path penyimpanan dan pencocokan duplikat — bukan bentuk platnya.

**Normalisasi sebelum validasi:** buang seluruh whitespace, kapitalkan, lalu uji regex. Simpan bentuk ternormalisasi, bukan bentuk asli ketikan.

### 4.2 Catatan atas V-09 — LT dan Bus

`D-03` menemukan `Segmen Utama` tidak berubah mengikuti `Kategori TB/LT`. Aturan yang diusulkan:

| Kategori | Segmen yang diizinkan |
|---|---|
| `TB` (Truck & Bus) | `bus`, `truck` |
| `LT` (Light Truck) | `truck` saja |

Ini mengikuti arti harfiah singkatannya. **Perlu konfirmasi:** apakah ada kendaraan yang secara bisnis dikategorikan `LT` tapi berbentuk bus kecil (mis. mikrobus, elf penumpang)? Kalau ada, `LT` perlu segmen ketiga — bukan dipaksa menjadi `truck`. Sampai dijawab, `ck_lt_not_bus` tetap dipasang, karena menolak data ambigu lebih murah daripada membersihkannya nanti.

---

## 5. Implementasi Rujukan

Logika murni, tanpa I/O, tanpa impor modul lain. Sesuai aturan 3 di dokumen `01` §2.3.

```typescript
// modules/axle/derive.ts
const AXLE_ORDER: AxleType[] = ['steer', 'drive', 'free_rolling'];

const LABEL: Record<AxleType, string> = {
  steer: 'Steer', drive: 'Drive', free_rolling: 'Free Rolling',
};
const CODE: Record<AxleType, string> = {
  steer: 'STEER', drive: 'DRIVE', free_rolling: 'FREE',
};

const SEQ = {
  double: [['right','outer'],['right','inner'],['left','inner'],['left','outer']],
  single: [['right', null], ['left', null]],
} as const;

export interface TirePosition {
  positionCode: string; positionLabel: string;
  axleType: AxleType; axleIndex: number;
  side: 'left' | 'right'; depth: 'inner' | 'outer' | null;
  sortOrder: number;
}

export function derivePositions(configs: AxleConfig[]): TirePosition[] {
  const out: TirePosition[] = [];
  let sortOrder = 0;

  for (const axleType of AXLE_ORDER) {
    const cfg = configs.find(c => c.axleType === axleType);
    if (!cfg) continue;

    for (let axleIndex = 1; axleIndex <= cfg.axleCount; axleIndex++) {
      for (const [side, depth] of SEQ[cfg.mounting]) {
        out.push({
          positionCode: [CODE[axleType], axleIndex, side === 'right' ? 'R' : 'L',
                         depth && (depth === 'outer' ? 'OUT' : 'IN')].filter(Boolean).join('_'),
          positionLabel: [LABEL[axleType], axleIndex, side === 'right' ? 'Kanan' : 'Kiri',
                          depth && (depth === 'outer' ? 'Luar' : 'Dalam')].filter(Boolean).join(' '),
          axleType, axleIndex, side, depth, sortOrder: sortOrder++,
        });
      }
    }
  }
  return out;
}

export function totalTires(configs: AxleConfig[]): number {
  return configs.reduce((n, c) => n + c.axleCount * (c.mounting === 'double' ? 4 : 2), 0);
}
```

**Invarian yang harus selalu benar:** `derivePositions(c).length === totalTires(c)`. Ini properti yang diuji terhadap seluruh 34 kombinasi di §6.

---

## 6. Strategi Pengujian

Dokumen `00` §4 menetapkan cakupan **100% cabang** untuk modul ini. Alasannya: mesin ini tidak punya umpan balik alami. Kalau salah menghasilkan posisi pada konfigurasi 6-poros yang jarang, tidak ada yang mengeluh sampai berbulan-bulan kemudian — dan saat itu sudah ada ratusan pengajuan dengan foto yang salah label.

| Jenis uji | Isi |
|---|---|
| **Uji regresi terhadap sistem berjalan** | Empat bukti dari dokumen `00` §1.2 dijadikan kasus uji tetap: (2 poros, D1 double)=6; (2 poros, D1 single)=4; (3 poros, D2 double)=10; (4 poros, D1+F1 double)=10. Sudah dijalankan dan lolos |
| **Uji enumerasi** | Seluruh 34 kombinasi §3 diuji: jumlah ban benar, jumlah posisi = jumlah ban, seluruh kode unik, seluruh `sortOrder` berurutan tanpa celah |
| **Uji properti** | Untuk konfigurasi acak yang sah: `derivePositions(c).length === totalTires(c)`, dan tidak ada dua posisi berkode sama |
| **Uji snapshot label** | Keluaran untuk konfigurasi 2-poros dibandingkan dengan tabel §3.1 secara harfiah. Ini yang menahan perubahan label tak sengaja |
| **Uji penolakan** | Setiap aturan V-01…V-05 diuji dengan masukan yang melanggarnya, memastikan ditolak — bukan diterima diam-diam seperti `D-04` hari ini |

---

## 7. Mesin Status Pengajuan

Menutup `D-11` dan prinsip `00` §3.3 poin 4.

```
                  ┌─────────┐
                  │  draft  │  supplier menyimpan sebagian
                  └────┬────┘
                 kirim │
                       ▼
                ┌──────────────┐
        ┌──────►│  pending_qc  │◄─────────┐
        │       └──────┬───────┘          │
        │              │                  │ kirim ulang
        │      ┌───────┼───────┐          │
        │      │       │       │          │
        │   pass    revision  drop        │
        │      │       │       │          │
        │      ▼       ▼       ▼          │
        │ ┌─────────┐ ┌──────────────┐ ┌─────────────┐
        │ │passed_qc│ │needs_revision├─┘ │ dropped_qc │
        │ └────┬────┘ └──────────────┘   └────────────┘
        │      │                              (final)
        │      │ spesifikasi ban diisi
        │      ▼
        │  (tetap passed_qc — kelengkapan spec
        │   adalah turunan, bukan status)
        └── QC ulang hanya bila admin membatalkan keputusan
```

### 7.1 Tabel Transisi

| Dari | Ke | Pemicu | Role | Syarat |
|---|---|---|---|---|
| — | `draft` | Simpan draf | Supplier | — |
| `draft` | `pending_qc` | Kirim pengajuan | Supplier (pemilik) | V-01…V-11 lolos |
| `pending_qc` | `passed_qc` | Keputusan `pass` | Admin | — |
| `pending_qc` | `needs_revision` | Keputusan `revision` | Admin | Alasan ≥ 10 karakter (V-14) |
| `pending_qc` | `dropped_qc` | Keputusan `drop` | Admin | Alasan ≥ 10 karakter (V-14) |
| `needs_revision` | `pending_qc` | Kirim ulang | Supplier (pemilik) | V-01…V-11 lolos |
| `passed_qc` | `pending_qc` | Batalkan keputusan | Admin | Belum ada spesifikasi ban terisi |
| `dropped_qc` | — | *(final)* | — | — |

**Transisi yang sengaja tidak ada:**
- `dropped_qc` → apa pun. Ditolak berarti selesai. Kalau supplier ingin mengajukan ulang, ia membuat pemeriksaan baru — dan `uq_locking_inspection` mengizinkannya karena indeks itu mengecualikan `dropped_qc`.
- **V-08 diperiksa pada transisi `draft → pending_qc`, bukan saat draf disimpan.** Draf boleh dibuat atas kendaraan yang terkunci; ia hanya tidak dapat dikirim. Alasannya di dokumen `11` §5.6: draf yang mengunci berarti draf terlantar mengunci plat selamanya.
- `passed_qc` → `dropped_qc` langsung. Membatalkan keputusan harus kembali ke `pending_qc` lebih dulu, sehingga tercatat sebagai dua peristiwa terpisah di `qc_reviews`.
- Apa pun → `draft`. Draf hanya ada sebelum pengiriman pertama.

### 7.2 Aturan Penegakan

1. **Perubahan status hanya lewat satu fungsi**, `transitionSubmission(id, to, actor, reason)`. Tidak ada `UPDATE submissions SET status = …` di tempat lain mana pun di kode.
2. Fungsi itu menjalankan seluruhnya dalam satu transaksi: verifikasi transisi sah → verifikasi role berwenang → `UPDATE` → sisip `qc_reviews` → sisip `audit_logs`.
3. Transisi yang tidak sah mengembalikan `409 INVALID_STATE_TRANSITION` (dokumen `05`), bukan diam-diam tidak melakukan apa-apa.
4. **`SELECT … FOR UPDATE`** pada baris pengajuan sebelum transisi. Dua admin yang menekan keputusan bersamaan tidak boleh menghasilkan dua baris `qc_reviews` dengan `status_before` yang sama.

### 7.3 Dampak pada Modul Backend Tire Specs

Sistem berjalan menggerbangi modul Backend dengan menyaring dropdown hanya berisi SN `Pass QC`. Itu penyaringan tampilan, bukan penegakan — permintaan yang dibuat langsung ke server tetap lolos.

Target menegakkannya di server: setiap penulisan `tire_specs` memverifikasi `submissions.status = 'passed_qc'`, dan menolak dengan `409 INVALID_STATE_TRANSITION` bila tidak.

---

## 8. Visibilitas Supplier

Menutup `D-10` — gap terbesar dari sisi produk. Hari ini supplier mengirim data lalu buta sepenuhnya, sehingga koordinasi Pass/Drop terpaksa terjadi lewat WhatsApp atau telepon.

**Yang dilihat supplier:**

| Elemen | Isi |
|---|---|
| Daftar pengajuan sendiri | SN, plat nomor, tanggal kirim, status berbadge warna |
| Filter | Status, rentang tanggal |
| Detail pengajuan | Seluruh data yang ia kirim + foto yang ia unggah |
| Alasan penolakan/revisi | Teks `qc_reviews.notes` + komentar per foto |
| Aksi pada `needs_revision` | Perbaiki data/foto lalu kirim ulang |

**Yang tidak dilihat supplier:** pengajuan supplier lain (ditegakkan server, bukan disembunyikan UI), spesifikasi ban hasil isian admin, identitas admin QC, dan dashboard wilayah.

Aturan cakupan data: setiap query pengajuan oleh role `supplier` menyertakan `WHERE submitted_by = :actorId`. Ditulis sebagai satu helper yang dipakai seluruh modul, bukan diulang di tiap query — pengulangan adalah tempat kebocoran otorisasi lahir.

---

## 9. Ringkasan Cacat yang Ditutup Dokumen Ini

| Cacat | Cara ditutup |
|---|---|
| `D-03` — LT bisa bersegmen Bus | V-09 + `ck_lt_not_bus`, dengan pertanyaan bisnis terbuka di §4.2 |
| `D-04` — sub-poros tidak dijumlahkan | V-01 + trigger `trg_axle_sum` yang deferred |
| `D-05` — plat menerima karakter aneh | V-07 + `ck_plate_format`, dengan alasan sengaja tidak ketat di §4.1 |
| `D-06` — duplikat plat | V-08 + `uq_locking_inspection` |
| `D-11` — tidak ada alur revisi | Status `needs_revision` + V-14 + §7 |
| `D-10` — supplier buta status | §8 |
| `K-01`, `K-02` | §2, §5, §6 — diformalkan, diimplementasikan, diuji |
