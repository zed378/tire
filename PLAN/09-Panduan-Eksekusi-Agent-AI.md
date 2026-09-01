# 09 — Panduan Eksekusi oleh Agent AI

**Prasyarat:** seluruh dokumen sebelumnya, terutama `03` (aturan domain) dan `08` §1.1
**Pembaca:** pemilik sistem (untuk menyiapkan), dan agent AI (sebagai sumber `CLAUDE.md`)

---

## 1. Premis Dokumen Ini

Kode ditulis agent. Yang tidak dapat didelegasikan ada tiga: **memutuskan apa yang benar, membuktikan bahwa hasilnya benar, dan menolak yang tidak benar.**

Dokumen `00`–`07` adalah spesifikasi. Dokumen ini adalah mekanisme yang memastikan spesifikasi itu benar-benar diikuti — bukan dengan mengharapkan agent patuh, melainkan dengan membuat pelanggaran gagal secara otomatis.

Prinsip yang mengikat seluruh dokumen:

> **Apa pun yang hanya dijaga oleh niat baik, akan luntur. Apa pun yang dijaga oleh pipeline, akan bertahan.**

---

## 2. Tiga Kelemahan Agent yang Ditangani

Rancangan di bawah tidak generik. Ia menargetkan tiga cara spesifik pengembangan berbasis agent gagal pada proyek seperti ini.

### 2.1 Aturan yang Hilang Tidak Pernah Gagal

`D-04` di sistem berjalan adalah aturan validasi yang tidak pernah ditulis. Tidak ada error, tidak ada log, tidak ada uji merah — sistem hanya meloloskan data yang salah dengan tenang.

Agent tidak akan menemukan aturan yang tidak disebutkan di mana pun. Ia menulis kode yang lolos uji yang ada, dan aturan yang tidak diuji tidak ada bagi agent.

**Penangkalnya:** setiap aturan validasi hidup sebagai **baris bernomor dalam tabel** di dokumen `03` (`V-01` … `V-nn`). Setiap baris wajib punya satu uji yang merujuk nomornya. CI menghitung: kalau jumlah nomor `V-` di dokumen tidak sama dengan jumlah uji yang merujuk `V-`, pipeline gagal.

```ts
// apps/api/src/kernel/poros/__tests__/validasi.test.ts
describe("V-01: jumlah sub-poros harus sama dengan Jumlah Poros", () => {
  it("menolak 6 Poros dengan steer 1 + drive 1 + free rolling 1", () => {
    expect(() => validasiKonfigurasi({
      jumlahPoros: 6, steer: 1, drive: 1, freeRolling: 1,
    })).toThrow("JUMLAH_POROS_TIDAK_KONSISTEN");
  });
});
```

Uji ditulis **dari dokumen, sebelum implementasi ada**. Kalau uji diturunkan dari kode yang sudah ditulis agent, ia hanya membuktikan agent konsisten dengan dirinya sendiri — bukan dengan spesifikasi.

### 2.2 Konteks Hilang Setiap Sesi

Agent memulai setiap sesi tanpa ingatan sesi sebelumnya. Tanpa konvensi tertulis, sesi ke-20 menulis kode dengan gaya, penamaan, dan pola penanganan error yang berbeda dari sesi ke-1.

**Penangkalnya:** `CLAUDE.md` di akar repo (§4), ditambah lint yang menegakkan hal-hal yang bisa ditegakkan mesin. Konvensi yang hanya tertulis akan dilanggar; konvensi yang di-lint tidak bisa.

### 2.3 Kode yang Benar tapi Tidak Terpahami

Agent condong menghasilkan abstraksi yang rapi dan padat. Enam bulan kemudian, kode itu harus dipahami manusia untuk diperbaiki — dan kepintaran yang menghemat lima baris bisa berbiaya satu jam pemahaman.

**Penangkalnya:** kode membosankan ditulis sebagai **persyaratan**, bukan preferensi. Aturan konkretnya ada di §4.

---

## 3. Dekomposisi Pekerjaan untuk Agent

### 3.1 Ukuran Satu Tugas

Satu tugas agent harus muat dalam satu sesi dan dapat diverifikasi dalam satu duduk. Ukuran yang bekerja:

| Terlalu besar | Tepat | Terlalu kecil |
|---|---|---|
| "Bangun modul QC" | "Implementasikan `POST /qc/{id}/keputusan` sesuai dok `05` §4.3, termasuk transisi status dok `03` §7 dan entri audit dok `04` §6" | "Tambahkan satu field ke form" |

Ciri tugas berukuran tepat:

- Menyentuh **satu modul**
- Punya **kriteria penerimaan tertulis** yang bisa dicentang tanpa menafsirkan
- Merujuk **nomor bagian dokumen**, bukan deskripsi bebas
- Menghasilkan uji yang gagal sebelum kode ditulis

### 3.2 Templat Tugas

Dipakai apa adanya untuk setiap tugas yang diberikan ke agent.

```markdown
## Tugas: <ringkas dalam satu baris>

**Modul:** apps/api/src/modul/<nama>
**Spesifikasi yang mengikat:**
- Dokumen 03 §<x> — aturan domain
- Dokumen 05 §<y> — kontrak endpoint
- Dokumen 02 §<z> — tabel yang disentuh

**Aturan validasi yang wajib diimplementasikan:** V-04, V-07, V-11
(setiap nomor wajib punya uji yang merujuknya)

**Kriteria penerimaan:**
- [ ] Uji untuk V-04, V-07, V-11 ada, merujuk nomornya, dan hijau
- [ ] Envelope response sesuai dokumen 05 §2 — tanpa pengecualian
- [ ] Perubahan status mencatat entri audit (dokumen 04 §6)
- [ ] Tidak ada impor lintas modul (dicek lint)
- [ ] `pnpm verify` hijau

**Di luar cakupan:** <daftar eksplisit hal yang TIDAK boleh disentuh>
```

Baris terakhir yang paling sering terlupakan dan paling banyak menyelamatkan. Tanpa batas eksplisit, agent cenderung "sekalian merapikan" berkas yang tidak diminta — dan itulah asal sebagian besar regresi yang sulit dilacak.

### 3.3 Urutan yang Tidak Boleh Dibalik

Untuk setiap tugas, tanpa pengecualian:

```
1. Tulis uji dari dokumen        ← manusia atau agent, tapi dari DOKUMEN
2. Jalankan — pastikan MERAH     ← uji yang langsung hijau adalah uji yang salah
3. Agent menulis implementasi
4. Jalankan — harus HIJAU
5. Manusia membaca diff
6. Merge
```

Langkah 2 sering dilewati dan itu berbahaya. Uji yang hijau sejak awal tidak menguji apa pun — dan tidak ada yang akan menyadarinya.

---

## 4. `CLAUDE.md` dan Lapisan Penegakannya

Implementasi dilakukan lewat **Claude Code di VS Code**. Itu menentukan nama dan mekanisme berkas konvensi.

> **Koreksi penting.** Claude Code membaca `CLAUDE.md`, **bukan** `AGENTS.md`. Kalau repo kelak juga dipakai agent lain yang memakai `AGENTS.md`, buat `CLAUDE.md` yang mengimpornya dengan `@AGENTS.md` di baris pertama, supaya keduanya membaca sumber yang sama tanpa duplikasi.

### 4.1 Tiga Lapisan, Kekuatan Berbeda

Ini pembedaan yang paling menentukan keberhasilan, dan paling sering dilewatkan.

| Lapisan | Berkas | Sifat | Cocok untuk |
|---|---|---|---|
| **Memori** | `CLAUDE.md` | Konteks, **bukan konfigurasi yang ditegakkan**. Dibaca dan biasanya diikuti, tanpa jaminan | Konvensi, arsitektur, gaya |
| **Aturan terlingkup** | `.claude/rules/*.md` | Sama seperti di atas, tapi hanya dimuat saat menyentuh berkas yang cocok | Aturan spesifik backend/frontend/migrasi |
| **Hook** | `.claude/settings.json` | **Skrip yang berjalan pada peristiwa siklus hidup, terlepas dari keputusan agent** | Larangan mutlak |

Aturan yang biayanya tinggi kalau dilanggar **tidak boleh berhenti di lapisan bahasa alami**. `D-04` adalah bukti hidupnya: aturan yang tidak ada tidak akan pernah gagal, tidak akan pernah tercatat, dan tidak akan pernah terlihat. Aturan seperti larangan `alert()` dan larangan `prisma migrate dev` naik ke lapisan hook, bukan tinggal sebagai imbauan.

### 4.2 Batas Ukuran

Sasaran **di bawah 200 baris** untuk `CLAUDE.md`. Berkas yang lebih panjang memakan konteks dan justru menurunkan kepatuhan — instruksi panjang diikuti sebagian. Karena itu isi di bawah sengaja dipangkas ke hal yang berlaku di **setiap** sesi; sisanya turun ke `.claude/rules/` yang dimuat hanya saat relevan.

Jangan salin dokumen `PLAN/` ke dalam `CLAUDE.md`. Cukup tunjuk ke sana.

### 4.3 Isi `CLAUDE.md`

```markdown
# Commercial 2026 — Sistem Pendataan Ban Bus & Truk

Spesifikasi lengkap ada di `PLAN/`. Dokumen itu mengikat: kalau kode dan
dokumen berbeda, dokumen yang benar. Jangan menyalin isi `PLAN/` ke sini.

## Perintah
- `pnpm verify`   — lint + typecheck + uji + boundary. Wajib hijau sebelum selesai.
- `pnpm test:poros` — uji mesin konfigurasi poros saja.
- `pnpm db:migrate` — migrasi. JANGAN pakai `prisma migrate dev`.

## Sebelum menulis kode apa pun
1. Baca bagian `PLAN/` yang disebut di tugas.
2. Kalau tugas tidak menyebut dokumen, BERHENTI dan minta klarifikasi.
3. Kalau dokumen ambigu, BERHENTI dan tanyakan. Jangan menebak.

## Aturan mutlak
- JANGAN PERNAH menulis `alert()`, `confirm()`, atau `prompt()`. Sistem lama
  memakainya; itulah cacat D-08 yang sedang diperbaiki.
- Setiap handler yang dipanggil klien mengembalikan envelope `PLAN/05` §2,
  termasuk saat error.
- Setiap aturan validasi ditegakkan di server. Validasi klien hanya kenyamanan.
- Skema validasi ditulis SEKALI di `packages/kontrak`, diimpor kedua sisi.
  Jangan pernah menduplikasi aturan validasi.
- `kernel/` tidak boleh mengimpor apa pun dari `modul/`.
- Modul hanya memanggil service layer modul lain, tidak pernah repository-nya.
- Data bisnis tidak pernah dihapus keras. Gunakan `deleted_at`.
- Setiap perubahan status menulis entri audit: pelaku, waktu, nilai sebelum
  dan sesudah.
- Kredensial, token, dan connection string hanya lewat variabel lingkungan.

## Gaya
- Tulis kode membosankan. Kejelasan mengalahkan keringkasan, selalu.
- Jangan membuat abstraksi untuk dua pemanggil. Tiga baris mirip lebih baik
  daripada satu abstraksi prematur.
- Nama Bahasa Indonesia untuk konsep domain (`pengajuan`, `posisi_ban`,
  `poros`); Bahasa Inggris untuk istilah teknis (`repository`, `handler`).
- Semua teks yang dilihat pengguna Bahasa Indonesia, termasuk pesan error.
- TypeScript `strict`. Dilarang `any`. Dilarang `@ts-ignore`.

## Selesai berarti
`pnpm verify` hijau. Jangan menonaktifkan aturan lint untuk membuatnya hijau.
```

### 4.4 Aturan Terlingkup

Dimuat hanya saat menyentuh berkas yang cocok, sehingga tidak membebani konteks setiap sesi.

| Berkas | `paths` | Isi |
|---|---|---|
| `.claude/rules/uji.md` | `**/*.test.ts` | Uji ditulis dari `PLAN/`, bukan dari implementasi. Setiap aturan `V-nn` dokumen `03` punya uji yang menyebut nomornya di `describe`. `kernel/poros` wajib 100% cakupan cabang. Uji yang langsung hijau harus dicurigai — pastikan ia merah dulu |
| `.claude/rules/migrasi.md` | `apps/api/prisma/**` | Migrasi tidak destruktif. Kolom tidak dihapus, hanya ditandai usang. Setiap migrasi diuji di staging sebelum produksi |
| `.claude/rules/api.md` | `apps/api/src/**/*.ts` | Envelope dokumen `05`. Otorisasi di setiap rute, bukan hanya di UI. `requestId` di setiap log |
| `.claude/rules/web.md` | `apps/web/src/**/*.tsx` | shadcn/ui, bukan komponen buatan sendiri. Tiga kanal error dokumen `05` §6. State loading di setiap tombol submit |

### 4.5 Hook: Lapisan yang Tidak Bisa Diabaikan

Empat larangan yang biayanya terlalu tinggi untuk dibiarkan di lapisan bahasa alami. Dipasang sebagai `PreToolUse` hook di `.claude/settings.json`, dan berjalan terlepas dari apa yang diputuskan agent.

| Yang diblokir | Alasan |
|---|---|
| Penulisan berkas yang mengandung `alert(`, `confirm(`, `prompt(` | `D-08`. Ini cacat yang sedang diperbaiki; membiarkannya masuk lagi mengalahkan tujuan proyek |
| `prisma migrate dev` | Menghapus dan membuat ulang basis data. Fatal kalau tersasar ke koneksi yang salah |
| `git push --force` ke `main` | Tidak ada pengulas kedua yang bisa memulihkannya |
| Penulisan ke `.env*` | Kredensial tidak boleh ditulis agent |

> Hook adalah satu-satunya lapisan yang benar-benar menegakkan. `CLAUDE.md` dan `.claude/rules/` membentuk perilaku, tapi bukan pagar keras — persis seperti gerbang CI di §5 yang menjadi pengulas kode sesungguhnya.

---

## 5. Gerbang CI

Inilah pengulas kode yang sesungguhnya. Setiap gerbang menutup satu cara spesifik proyek ini bisa rusak.

| # | Gerbang | Yang dicegah | Gagal berarti |
|---|---|---|---|
| G-01 | `tsc --noEmit`, strict | Tipe longgar | Blokir |
| G-02 | ESLint + `eslint-plugin-boundaries` | Batas modul luntur (R-07 dok `01`) | Blokir |
| G-03 | **Grep `alert(`, `confirm(`, `prompt(` → harus nol** | `D-08` diwarisi ke sistem baru | Blokir |
| G-04 | **Hitung `V-nn` di dok `03` == jumlah uji yang merujuknya** | §2.1 — aturan hilang | Blokir |
| G-05 | Cakupan cabang `kernel/poros` == 100% | `K-01` regresi diam-diam | Blokir |
| G-06 | Cakupan baris keseluruhan ≥ 70% | Uji ditinggalkan saat terburu-buru | Blokir |
| G-07 | Uji mutasi pada `kernel/poros`, skor ≥ 85% | Uji yang ada tapi tidak menguji apa-apa | Blokir |
| G-08 | Pemindai rahasia (gitleaks) | R-15 — kredensial masuk repo | Blokir |
| G-09 | Migrasi Prisma berjalan bersih di basis data kosong **dan** salinan staging | Migrasi rusak menyentuh produksi | Blokir |
| G-10 | **Grep panel demo / kredensial hardcoded → harus nol** | `D-16` aktif di produksi | Blokir |
| G-11 | Uji end-to-end alur QC (Playwright) | Regresi lintas modul | Blokir |
| G-12 | Anggaran ukuran bundel klien | PWA melambat di 4G | Peringatan |
| G-13 | `pnpm-lock.yaml` tidak berubah tanpa perubahan `package.json` | R-16 | Peringatan |

**G-04 dan G-07 adalah yang paling penting dan paling sering absen di proyek biasa.**

G-04 memaksa dokumen dan uji tetap sinkron. Menambahkan aturan validasi ke dokumen `03` tanpa menulis ujinya akan **menggagalkan pipeline** — sehingga aturan tidak bisa hilang diam-diam seperti `D-04`.

G-07 menangkap uji yang ada tapi kosong. Agent sangat mampu menulis uji yang selalu lolos. Uji mutasi mengubah operator di kode (`>` jadi `>=`, `&&` jadi `||`) lalu memeriksa apakah ada uji yang gagal. Kalau tidak ada yang gagal, uji itu tidak menguji apa pun. Pada `kernel/poros` — inti domain yang menentukan seluruh data hilir — ini bukan kemewahan.

### 5.1 Perintah Tunggal

Satu perintah yang menjalankan semuanya secara lokal, sehingga tidak ada alasan untuk mendorong kode yang belum diperiksa.

```json
{
  "scripts": {
    "verify": "pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm check:larangan && pnpm check:aturan"
  }
}
```

`check:larangan` menjalankan G-03 dan G-10. `check:aturan` menjalankan G-04. Keduanya skrip pendek — belasan baris — dan keduanya menutup cacat yang terbukti nyata di sistem berjalan.

---

## 6. Yang Tidak Boleh Didelegasikan ke Agent

Enam hal. Bukan karena agent tidak mampu, melainkan karena kesalahan di sini tidak akan tertangkap gerbang mana pun.

| # | Pekerjaan | Alasan |
|---|---|---|
| N-01 | **Menjawab Q-06 (multitenancy) dan pertanyaan terbuka lain di dok `00` §5** | Keputusan produk. Agent akan memilih salah satu dengan percaya diri, dan pilihannya mengunci skema |
| N-02 | **Menulis tabel aturan validasi di dok `03`** | Ini spesifikasi sumber. Agent menurunkan uji darinya; kalau agent juga yang menulisnya, tidak ada sumber kebenaran independen |
| N-03 | **Memverifikasi migrasi data (dok `07`)** | Membandingkan data lama dan baru butuh pengetahuan bisnis tentang mana selisih yang wajar |
| N-04 | **Pengujian lapangan antrean offline** | Harus dilakukan manusia, di garasi, dengan sinyal buruk, di perangkat nyata |
| N-05 | **Menerima atau menolak hasil fase** | Ini keseluruhan peran pemilik sistem dalam proyek ini |
| N-06 | **Keputusan menyentuh produksi** | Deploy dan migrasi produksi disetujui manusia, tanpa pengecualian |

---

## 7. Kesalahan Berulang yang Perlu Diantisipasi

Diamati sebagai pola umum; ditulis agar dikenali cepat saat membaca diff.

| Pola | Tampak seperti | Cara menangkap |
|---|---|---|
| Menangkap error lalu menelannya | `catch { return null }` | Lint melarang `catch` kosong; G-11 |
| Menonaktifkan lint alih-alih memperbaiki | `// eslint-disable-next-line` bertambah | Grep di CI; setiap penambahan harus dijelaskan |
| Melonggarkan uji agar hijau | Assertion diubah, bukan kode | Baca diff berkas uji **lebih teliti** daripada diff kode |
| Menduplikasi aturan validasi | Regex plat nomor muncul di dua tempat | Grep pola; `packages/kontrak` satu-satunya rumah |
| Menyentuh berkas di luar cakupan | Diff jauh lebih besar dari tugasnya | Bagian "Di luar cakupan" di templat §3.2 |
| Menciptakan pustaka yang tidak ada | Impor gagal saat build | G-01 |
| Melewatkan entri audit | Status berubah tanpa jejak | Uji: setiap transisi status memeriksa `log_audit` bertambah |

Baris ketiga layak digarisbawahi. **Diff pada berkas uji harus dibaca lebih teliti daripada diff pada kode.** Kode yang salah akan gagal di uji; uji yang salah tidak akan gagal di mana pun.

---

## 8. Ritme Kerja per Fase

```
Awal fase
  └─ Manusia: tulis daftar tugas dari dokumen PLAN, dengan kriteria penerimaan
  └─ Manusia: tulis tabel aturan validasi kalau fase ini menambahkannya (N-02)

Per tugas
  └─ Uji ditulis dari dokumen  →  merah
  └─ Agent implementasi        →  hijau
  └─ pnpm verify               →  hijau
  └─ Manusia baca diff         →  merge

Akhir fase
  └─ Manusia: jalankan daftar penerimaan fase secara manual di staging
  └─ Manusia: tanda tangani
  └─ Baru fase berikutnya dimulai        ← aturan pengaman dok 08 §2.2
```

Baris terakhir adalah satu-satunya perlindungan terhadap R-01. Tanpanya, kode menumpuk lebih cepat daripada bisa diperiksa, dan proyek terlihat maju sampai bug pertama muncul di bagian yang tidak pernah dibaca siapa pun.

---

## 9. Deliverable Dokumen Ini

| Berkas | Kapan dibuat | Isi |
|---|---|---|
| `CLAUDE.md` + `.claude/rules/` + `.claude/settings.json` | F0 | §4, apa adanya |
| `.github/workflows/verify.yml` | F0 | Gerbang G-01 … G-13 |
| `scripts/check-larangan.ts` | F0 | G-03, G-10 |
| `scripts/check-aturan.ts` | F0 | G-04 |
| `TUGAS/` | tiap fase | Satu berkas markdown per tugas, templat §3.2 |
| `PENERIMAAN/` | tiap fase | Daftar penerimaan yang ditandatangani manusia |

Seluruhnya dibuat di **F0, sebelum baris kode fitur pertama ditulis**. Gerbang yang dipasang setelah ada kode akan menemukan ratusan pelanggaran sekaligus, dan pada titik itu godaan untuk melonggarkannya hampir tak tertahankan.
