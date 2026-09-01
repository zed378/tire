# 01 — Arsitektur & Tumpukan Teknologi

**Prasyarat:** dokumen `00`
**Kendala yang mengikat dokumen ini:**
- **Q-01** — volume di atas 1.000 pengajuan/bulan
- **Q-04** — dikerjakan oleh **satu orang**
- **Q-05** — target: **penulisan ulang menjadi aplikasi web mandiri**

> Dua kendala terakhir saling menarik ke arah berlawanan. Volume besar menggoda ke arah arsitektur yang canggih; pengembang tunggal menuntut yang paling membosankan. Dokumen ini memenangkan yang kedua, dan menunjukkan mengapa volume itu sebenarnya tidak menuntut kecanggihan apa pun.

---

## 1. Volumetrik: Angka yang Menentukan Segalanya

Angka perencanaan: **1.200 pengajuan/bulan**. Rata-rata 8 posisi ban per kendaraan (antara 4 ban pada 2-poros-single dan 22 ban pada 6 poros). Slot foto = 8 posisi + 2 foto umum = 10 slot.

| Besaran | Per bulan | Per tahun | Akumulasi 3 tahun |
|---|---:|---:|---:|
| `submissions` | 1.200 | 14.400 | **43.200** |
| `tire_positions` | 9.600 | 115.200 | **345.600** |
| `tire_specs` | 9.600 | 115.200 | **345.600** |
| `photos` (asumsi 1,5 foto/slot) | 18.000 | 216.000 | **648.000** |
| Penyimpanan foto (400 KB rata-rata) | 7 GB | 84 GB | **252 GB** |
| Penyimpanan foto (skenario maksimum 10/slot) | 47 GB | 562 GB | 1,7 TB |

### 1.1 Ini yang Membunuh Apps Script

Google Sheets punya batas keras **10.000.000 sel per spreadsheet**. Dengan volume di atas:

```
tire_positions   345.600 baris × ~10 kolom  = 3.456.000 sel
photos           648.000 baris ×  ~8 kolom  = 5.184.000 sel
submissions       43.200 baris × ~25 kolom  = 1.080.000 sel
                                             ─────────────
                                               9.720.000 sel  →  97% batas
```

**Batas tertabrak di bulan ke-37.** Dan itu batas keras — jauh sebelumnya, sekitar bulan ke-8 hingga ke-12, aplikasi sudah tidak nyaman dipakai: setiap filter memindai seluruh baris tanpa indeks (`B-04`), dan setiap export atas puluhan ribu baris menabrak batas eksekusi 6 menit (`B-05`).

Ditambah `B-06`: 216.000 unggahan Drive per tahun adalah 592 operasi Drive per hari kerja, di luar pembacaan. Kuota Apps Script tidak dapat dibeli terpisah.

Keputusan tulis-ulang tidak lagi berupa preferensi. Ia adalah konsekuensi aritmetika.

### 1.2 Yang Sama Pentingnya: Volume Ini Kecil untuk Database Sungguhan

648.000 baris foto dan 345.600 baris posisi ban setelah tiga tahun adalah beban yang **tidak berarti** bagi satu instance PostgreSQL. Satu server 4 vCPU / 8 GB menangani ini tanpa berkeringat, bahkan dengan margin sepuluh kali lipat.

Ini penting untuk dinyatakan eksplisit, karena kata "1.000+ per bulan" sering memicu refleks membangun microservice, sharding, dan message broker terdistribusi. Tidak ada satu pun yang dibutuhkan di sini. **Volume yang mematikan Sheets adalah volume yang membosankan bagi Postgres.**

---

## 2. Keputusan Arsitektur: Monolit Modular

### 2.1 Keputusan

**Satu aplikasi, satu proses web, satu proses worker, satu basis data.** Modul dipisahkan sebagai batas di dalam kode — bukan sebagai layanan terpisah di jaringan.

### 2.2 Mengapa Bukan Microservice

Repo referensi (`zed378/hris`) memuat blueprint microservice yang lengkap di dokumen `01`–`09`, lalu **membatalkannya sendiri di dokumen `12`** ketika kendala tim kecil dimasukkan. Alasannya berlaku persis untuk kasus ini.

| Yang dibeli microservice | Relevansinya di sini |
|---|---|
| Penskalaan independen per domain | Tidak relevan. Tidak ada modul yang bebannya berbeda ordo dari modul lain |
| Deploy independen per tim | Tidak relevan. Satu orang, tidak ada koordinasi antar tim |
| Isolasi kegagalan | Sebagian relevan — bisa dicapai lebih murah lewat pemisahan worker |
| Kebebasan memilih bahasa per layanan | Tidak relevan, dan justru merugikan bagi satu orang |

| Yang dibayar microservice | Biaya bagi satu orang |
|---|---|
| Konsistensi lintas layanan (saga, outbox, idempotensi) | Berat. Menggantikan satu `BEGIN…COMMIT` |
| Pipeline deploy per layanan | Berlipat sesuai jumlah layanan |
| Tracing terdistribusi untuk debug satu request | Wajib, bukan opsional |
| Kontrak versi antar layanan | Beban permanen |

Bagi satu orang, seluruh biaya di atas dibayar penuh dan hampir tidak ada manfaat yang diterima. Monolit modular menyelesaikan ini dengan transaksi database biasa.

### 2.3 Modular, Bukan Sekadar Monolit

Yang membuatnya bisa dipecah nanti kalau memang perlu:

```
src/
├── modules/
│   ├── auth/          ── sesi, kata sandi, kunci akun
│   ├── users/         ── CRUD pengguna, penugasan wilayah
│   ├── masterdata/    ── provinsi, kota, merk kendaraan, merk ban
│   ├── submissions/   ── pengajuan kendaraan
│   ├── axle/          ── ⭐ mesin konfigurasi poros (dok 03)
│   ├── photos/        ── unggah, kompresi, siklus hidup
│   ├── qc/            ── verifikasi, keputusan, komentar
│   ├── tirespecs/     ── spesifikasi ban per posisi
│   ├── reporting/     ── dashboard, agregasi, export
│   └── audit/         ── jejak audit
├── shared/            ── db, error, logger, validasi, storage
└── app/               ── rute HTTP & halaman
```

**Empat aturan yang menjaga batas tetap nyata:**

1. Satu modul hanya boleh mengimpor modul lain lewat berkas `index.ts`-nya. Tidak ada `import` menembus ke berkas dalam.
2. Satu modul hanya boleh menulis ke tabel miliknya sendiri. Membaca lintas modul dilakukan lewat fungsi yang diekspor, bukan lewat query langsung.
3. `modules/axle/` tidak boleh mengimpor modul mana pun. Ia adalah logika murni tanpa I/O.
4. Aturan 1–3 ditegakkan oleh linter (`eslint-plugin-boundaries`), bukan oleh disiplin. Disiplin habis di minggu ketiga.

Aturan 3 yang paling penting. Mesin konfigurasi poros (`K-01`, `K-02`) adalah inti domain produk; menjaganya bebas I/O membuatnya dapat diuji habis-habisan tanpa database. Dokumen `03` membahasnya sendiri.

---

## 3. Katalog Modul

Diturunkan dari pemetaan di dokumen `00` §3.2.

| Modul | Tanggung jawab | Tabel yang dimiliki | Menutup |
|---|---|---|---|
| `auth` | Login, sesi, kata sandi, kunci akun | `sessions`, `login_attempts` | `B-11`, `D-16` |
| `users` | Pengguna, role, penugasan wilayah | `users`, `user_regions` | `D-12`, `D-13` |
| `masterdata` | Wilayah, merk kendaraan, merk ban | `provinces`, `cities`, `vehicle_brands`, `tire_brands` | Q-07 |
| `submissions` | Pengajuan, Serial Number, status | `submissions`, `axle_configs`, `serial_counters` | `D-05`, `D-06`, `D-10` |
| `axle` | Derivasi posisi ban (logika murni) | `tire_positions` | `K-01`, `K-02`, `D-03`, `D-04` |
| `photos` | Unggah, penyimpanan, siklus hidup | `photos` | — |
| `qc` | Verifikasi, keputusan, komentar | `qc_reviews`, `qc_comments` | `D-01`, `D-02`, `D-11` |
| `tirespecs` | Spesifikasi per posisi ban | `tire_specs` | — |
| `reporting` | Dashboard, agregasi, export | *(hanya membaca)* | `D-09`, `D-14` |
| `audit` | Jejak perubahan | `audit_logs` | `D-15` |

---

## 4. Tumpukan Teknologi

### 4.1 Ringkasan

| Lapisan | Pilihan | Alasan singkat |
|---|---|---|
| Bahasa | **TypeScript** | Satu bahasa untuk klien dan server — penting mutlak bagi satu orang |
| Frontend | **Vite + React 19** | SPA murni. Build cepat, konfigurasi transparan, tanpa lapisan framework di atas React |
| Backend | **Node.js 22 + Fastify** | Proses API terpisah. Ringan, validasi skema bawaan, tanpa dekorator |
| Kontrak bersama | **paket `packages/kontrak`** | Skema Zod + tipe diimpor oleh klien dan server dari satu sumber |
| Basis data | **PostgreSQL 16+** | Transaksi, constraint, indeks, JSONB, dan tipe enum sungguhan |
| Akses data | **Prisma** | Migrasi bernomor, tipe otomatis, skema terbaca sebagai dokumentasi |
| Validasi | **Zod** | Satu skema dipakai di klien dan server. Menutup `D-07` secara struktural |
| Penyimpanan objek | **Cloudflare R2** | Kompatibel S3, **tanpa biaya egress** — menentukan saat menyajikan 648.000 foto |
| Antrean pekerjaan | **pg-boss** | Antrean di atas PostgreSQL. Tidak perlu menjalankan Redis |
| Autentikasi | **Sesi opaque di server** (cookie `httpOnly` + tabel `sessions`), hash Argon2id | Rinci di `04`, dikeraskan di `13`. **JWT ditolak** — lihat `13` §1.1: hanya sesi server yang dapat dicabut seketika. Pustaka: `@fastify/cookie` + `@node-rs/argon2` |
| UI | **Tailwind + shadcn/ui** | Komponen dimiliki sendiri, bukan dependensi yang bisa hilang |
| State server (klien) | **TanStack Query** | Cache, retry, invalidasi — menggantikan apa yang di framework fullstack gratis |
| Routing (klien) | **TanStack Router** atau React Router | Menutup `B-07`: URL per halaman, dapat di-bookmark, tombol Back berfungsi |
| Formulir | **React Hook Form** + `zodResolver` | Menyambung langsung ke skema Zod bersama |
| Grafik | **Recharts** | Memadai untuk kebutuhan dashboard (`F-11`) |
| Export Excel | **ExcelJS** | Berjalan di worker, bukan di request |
| Log | **Pino** → berkas + Better Stack | JSON terstruktur sejak hari pertama |
| Error tracking | **Sentry** | Menutup `D-08` pada tingkat operasional |
| Uji | **Vitest** + **Playwright** | Unit untuk `axle`, end-to-end untuk alur QC |
| Hosting | **VPS Singapura + Docker Compose** | Lihat §5 |
| TLS & proxy | **Caddy** | Sertifikat otomatis, konfigurasi lima baris |

### 4.2 Pembenaran atas Pilihan yang Bisa Diperdebatkan

**pg-boss, bukan Redis + BullMQ.**
Sistem ini butuh antrean untuk tiga hal: pemrosesan foto, export Excel, dan pengiriman notifikasi. Ketiganya berjalan puluhan sampai ratusan kali per hari — bukan ribuan per detik. pg-boss menjalankan antrean di dalam PostgreSQL yang sudah ada, sehingga **tidak ada komponen infrastruktur tambahan yang harus dipantau, di-backup, dan dipulihkan saat mati**. Bagi satu orang, setiap komponen yang tidak dijalankan adalah kemenangan. Redis dipertimbangkan lagi kalau throughput job melampaui ~50/detik, dan itu tidak akan terjadi pada volume ini.

**Cloudflare R2, bukan S3 atau Google Drive.**
Google Drive harus ditinggalkan: ia tidak punya URL bertanda tangan yang berumur pendek, tidak punya aturan siklus hidup, dan kuotanya terikat akun (`B-06`). Di antara penyimpanan objek, R2 dipilih karena **egress gratis**. Foto ban dilihat berulang kali oleh QC, dan pada 252 GB tersimpan, biaya egress S3 mudah melampaui biaya penyimpanannya sendiri.

**Vite SPA + Fastify terpisah, bukan framework fullstack.**
Ini keputusan pemilik sistem, dan konsekuensinya perlu dinyatakan terbuka. Framework fullstack seperti Next.js akan menyatukan UI dan API dalam satu deployable, sehingga menghemat konfigurasi CORS dan satu pipeline deploy — keuntungan nyata bagi satu orang.

Yang ditukar dengan itu, dan mengapa pertukarannya masuk akal di sini:

| Yang hilang | Yang didapat |
|---|---|
| Satu deployable | **Batas klien–server yang jelas dan tidak bisa bocor.** Tidak ada godaan memanggil basis data dari komponen UI |
| Konfigurasi CORS gratis | Backend yang **tidak terikat pada React.** Kalau kelak ada aplikasi native atau integrasi pihak ketiga, API sudah siap |
| SSR untuk dashboard | Build klien yang sepenuhnya statis — dapat disajikan Caddy langsung, tanpa proses Node kedua |
| — | **PWA yang lebih mudah dikendalikan.** Service Worker pada SPA statis jauh lebih sederhana daripada di framework dengan SSR (dokumen `06`) |

Kehilangan "berbagi skema Zod tanpa paket bersama" **dipulihkan penuh** oleh `packages/kontrak` di monorepo pnpm. Skema tetap ditulis sekali dan diimpor kedua sisi; yang bertambah hanya satu berkas `package.json`. `D-07` tetap tertutup secara struktural.

Biaya sesungguhnya dari keputusan ini adalah **CORS, penanganan cookie lintas origin, dan satu entri deploy tambahan** — dibayar sekali di awal, lalu selesai. Itu harga yang wajar.

**Fastify, bukan NestJS atau Express.**
Express tidak punya validasi skema bawaan dan tipenya lemah. NestJS memberi struktur yang bagus untuk tim, tapi menuntut pemahaman dekorator, modul, dan injeksi dependensi — beban belajar yang tidak terbayar untuk satu orang dengan sepuluh modul. Fastify menyatu langsung dengan Zod lewat `fastify-type-provider-zod`, sehingga rute menjadi bertipe otomatis dari skema yang sama dengan formulir di klien.

**Wilayah Singapura, bukan Eropa atau Amerika.**
Seluruh pengguna berada di Indonesia dan sebagian besar bekerja dari perangkat seluler di lapangan. Latensi Jakarta→Singapura sekitar 15–30 ms; Jakarta→Frankfurt sekitar 180–220 ms. Pada alur unggah foto yang berkali-kali bolak-balik, selisih ini terasa langsung. Penyedia yang memadai: DigitalOcean, Vultr, Linode, atau AWS Lightsail di `ap-southeast-1`.

### 4.3 Yang Sengaja Tidak Dipakai

| Tidak dipakai | Alasan |
|---|---|
| Kubernetes | Docker Compose cukup sampai jauh melampaui volume ini |
| Message broker (Kafka, RabbitMQ) | Tidak ada layanan lain untuk diajak bicara |
| Microservice | §2.2 |
| GraphQL | Satu klien, kebutuhan query dapat diprediksi |
| Redis | pg-boss menghapus kebutuhannya |
| Server-side rendering untuk halaman formulir | Formulir bersifat interaktif; SSR hanya menambah kerumitan |
| Multitenancy | Q-06 belum dijawab. Jangan bangun sebelum ada tenant kedua yang nyata |
| Deteksi liveness wajah / anti-mock GPS | Tidak ada indikasi kebutuhan; sangat mahal untuk dibangun |
| Aplikasi native | PWA lebih dulu — lihat dokumen `06` untuk batas jujurnya |

### 4.4 Node.js atau Python — Alasan Memilih Node

Pemilihan diserahkan ke dokumen ini. Keduanya sanggup; perbedaannya bukan kemampuan, melainkan **berapa banyak hal yang harus dipikirkan satu orang sekaligus**.

| Kriteria | Node.js + TypeScript | Python (FastAPI) |
|---|---|---|
| Bahasa sama dengan frontend | **Ya** | Tidak — dua bahasa, dua toolchain, dua gaya uji |
| Berbagi skema validasi dengan klien | **Ya** — Zod ditulis sekali | Tidak — Pydantic di server, Zod di klien, ditulis dua kali |
| Berbagi tipe kontrak API | **Ya** — otomatis | Perlu generator OpenAPI → TypeScript |
| Kualitas ORM & migrasi | Prisma — sangat baik | SQLAlchemy + Alembic — sangat baik, lebih verbose |
| Pemrosesan gambar | `sharp` — cepat, matang | Pillow — matang, sedikit lebih lambat |
| Penulisan Excel | ExcelJS — memadai | openpyxl / XlsxWriter — **lebih unggul** |
| Analisis citra ban di masa depan | Lemah | **Jauh lebih kuat** |
| Beban kognitif untuk satu orang | **Lebih ringan** | Lebih berat |

**Keputusan: Node.js + TypeScript.**

Alasan penentunya bukan performa, melainkan `D-07` dan prinsip dokumen `00` §3.3 nomor 3 — setiap aturan validasi ditegakkan dua kali, di klien untuk kenyamanan dan di server untuk kebenaran. Ditulis dua kali dalam dua bahasa berbeda, kedua salinan itu **pasti** menyimpang seiring waktu. Itu bukan risiko teoretis; itu yang selalu terjadi, dan pengembang tunggal tidak punya tinjauan kode yang bisa menangkapnya.

```ts
// packages/kontrak/src/pengajuan.ts — satu sumber kebenaran
export const skemaPengajuan = z.object({
  platNomor: z.string()
    .regex(/^[A-Z]{1,2}\d{1,4}[A-Z]{0,3}$/, "Format plat nomor tidak valid."),
  provinsiId: z.string().uuid("Provinsi wajib dipilih."),
  kotaId:     z.string().uuid("Kota wajib dipilih."),
  kategoriKendaraan: z.enum(["TB", "LT"]),
  konfigurasiPoros:  skemaKonfigurasiPoros,   // menutup D-04
});
export type Pengajuan = z.infer<typeof skemaPengajuan>;
```

Berkas ini diimpor oleh formulir React (lewat `zodResolver`) **dan** oleh rute Fastify. Penyimpangan antara validasi klien dan server menjadi mustahil secara struktural, bukan sekadar tidak disarankan. `D-05` dan `D-07` tertutup oleh satu regex yang hanya ada di satu tempat.

> **Kapan Python akan jadi pilihan yang benar:** kalau ada rencana konkret dalam 12 bulan untuk menganalisis foto ban secara otomatis — mengukur kedalaman tapak, mendeteksi keausan tidak rata, membaca kode DOT. Ekosistem visi komputer Python tidak tertandingi, dan keunggulan itu akan melampaui seluruh baris di tabel atas. Kalau itu bukan rencana, keunggulannya tidak terpakai sama sekali.
>
> Kalaupun kebutuhan itu muncul kelak, jalan keluarnya tidak menuntut penulisan ulang: pemrosesan citra dijalankan sebagai worker Python terpisah yang membaca antrean pg-boss yang sama. Batas modul di §2.3 yang memungkinkannya.

### 4.5 Struktur Repositori

Monorepo pnpm. Tanpa Nx atau Turborepo di awal — belum ada yang perlu diorkestrasi.

```
commercial2026/
├── packages/
│   └── kontrak/            skema Zod, tipe, kode error, konstanta domain
│                           ← diimpor oleh api DAN web. Tidak boleh
│                             mengimpor apa pun dari keduanya
├── apps/
│   ├── api/                Fastify
│   │   ├── src/
│   │   │   ├── kernel/     poros/ audit/ otorisasi/ envelope/ berkas/
│   │   │   ├── modul/      auth/ pengajuan/ qc/ spesifikasi/
│   │   │   │               users/ master/ pelaporan/ export/
│   │   │   └── worker/     pemroses job pg-boss (entrypoint terpisah)
│   │   └── prisma/         schema.prisma + migrasi bernomor
│   └── web/                Vite + React
│       └── src/
│           ├── fitur/      satu folder per modul, cermin sisi api
│           ├── komponen/   shadcn/ui + komponen bersama
│           └── lib/        klien api, penangan envelope, toast & banner
└── docker-compose.yml      postgres + minio untuk pengembangan lokal
```

Folder `apps/api/src/modul/` sengaja mencerminkan katalog modul di §3. Kalau sebuah modul kelak dipisah menjadi layanan tersendiri, folder itulah yang dipindahkan — dan `packages/kontrak` sudah berisi kontraknya.

**Aturan impor yang ditegakkan lint di CI:**

| Dari | Boleh mengimpor |
|---|---|
| `packages/kontrak` | tidak ada apa pun dari `apps/` |
| `apps/web` | `packages/kontrak` |
| `apps/api` | `packages/kontrak` |
| `modul/*` | `kernel/*`, `packages/kontrak`, dan service layer modul lain |
| `kernel/*` | **tidak boleh mengimpor `modul/*` sama sekali** |

Baris terakhir yang paling penting. `kernel/poros` adalah inti domain (`K-01`, `K-02`) dan harus tetap berupa fungsi murni tanpa ketergantungan, supaya dapat diuji menyeluruh tanpa basis data — dokumen `00` §4 menuntut cakupan 100% cabang atasnya.

---

## 5. Topologi Deployment

```
                     Internet
                        │
                   ┌────▼────┐
                   │  Caddy  │  TLS otomatis
                   └────┬────┘
        ┌───────────────┴───────────────┐
        │       VPS (Singapura)         │
        │  4 vCPU / 8 GB / 160 GB SSD   │
        │                               │
        │  ┌─────────┐  ┌────────────┐  │
        │  │   api   │  │   worker   │  │  proses terpisah,
        │  │ Fastify │  │  pg-boss   │  │  image sama
        │  └────┬────┘  └──────┬─────┘  │
        │       │                       │
        │  ┌────┴──────────────────┐    │  build statis Vite,
        │  │  web/ (dist statis)   │    │  disajikan Caddy —
        │  │  disajikan oleh Caddy │    │  bukan proses Node
        │  └───────────────────────┘    │
        │       └───────┬──────┘        │
        │         ┌─────▼──────┐        │
        │         │ PostgreSQL │        │
        │         └─────┬──────┘        │
        └───────────────┼───────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
    ┌─────▼──────┐            ┌────────▼────────┐
    │ Cloudflare │            │  Backup harian  │
    │     R2     │◄───────────│  pg_dump → R2   │
    │   (foto)   │            └─────────────────┘
    └────────────┘
```

**Mengapa `worker` dipisah dari `web`.** Export Excel atas 43.000 pengajuan dan pemrosesan ratusan foto tidak boleh berbagi event loop dengan request pengguna. Ini isolasi kegagalan yang sesungguhnya dibutuhkan sistem ini — dan diperoleh dengan satu entri tambahan di `docker-compose.yml`, bukan dengan memecah menjadi layanan jaringan.

### 5.1 Environment

| Environment | Tempat | Data | Tujuan |
|---|---|---|---|
| `local` | Laptop, Docker Compose | Seed sintetis | Pengembangan harian |
| `staging` | VPS kecil (2 vCPU / 4 GB) | Salinan produksi yang disamarkan | Uji migrasi & rilis |
| `production` | VPS utama | Data nyata | — |

Ini menutup `B-09`. Sistem berjalan hari ini tidak punya pemisahan apa pun — setiap perubahan langsung menyentuh data nyata.

### 5.2 Backup

| Apa | Frekuensi | Retensi | Tempat |
|---|---|---|---|
| `pg_dump` penuh | Harian, 02.00 WIB | 30 hari | R2, bucket terpisah |
| WAL archiving | Kontinu | 7 hari | R2 |
| Foto | Versioning aktif di R2 | 90 hari untuk versi terhapus | R2 |

**Backup yang belum pernah dipulihkan bukan backup.** Uji pemulihan ke staging wajib dijalankan sebulan sekali dan dicatat tanggalnya. Ini satu-satunya cara mengetahui RTO 4 jam (dokumen `00` §4) benar-benar tercapai.

---

## 6. Observability Minimum

Bukan kemewahan. `D-08` membuktikan sistem berjalan hari ini punya kegagalan yang **sama sekali tidak terlihat oleh siapa pun** — tidak oleh pengguna, tidak oleh pengembang, tidak oleh tooling QA.

| Pilar | Alat | Yang dicatat |
|---|---|---|
| Log | Pino → JSON | Setiap request: `requestId`, `userId`, `role`, rute, status, durasi |
| Error | Sentry | Setiap exception, dengan `requestId` yang sama seperti yang ditampilkan ke pengguna |
| Uptime | Better Stack / UptimeRobot | `GET /api/health` tiap menit |
| Metrik bisnis | Tabel `daily_metrics`, diisi job harian | Pengajuan/hari, rasio Pass/Drop, foto terunggah, durasi antrean |

**Empat peringatan yang benar-benar mengirim notifikasi** (sisanya cukup di dashboard):
- Health check gagal 3 kali berturut-turut
- Antrean job tertunda > 15 menit
- Tingkat error 5xx > 1% selama 5 menit
- Job backup harian gagal

---

## 7. Estimasi Biaya Bulanan

| Komponen | Perkiraan (USD/bln) |
|---|---:|
| VPS produksi (4 vCPU / 8 GB, Singapura) | 24 |
| VPS staging (2 vCPU / 4 GB) | 12 |
| Cloudflare R2 — penyimpanan (tahun 1, rata-rata ~42 GB) | 1 |
| Cloudflare R2 — egress | **0** |
| Domain + email transaksional (Resend) | 2 |
| Sentry (tier gratis memadai di awal) | 0 |
| Better Stack (tier gratis) | 0 |
| **Total tahun 1** | **~39** |
| **Total tahun 3** (R2 ~252 GB, VPS naik kelas) | **~65** |

Biaya penyimpanan tumbuh linier terhadap foto dan tetap kecil. Yang perlu diawasi bukan biayanya, melainkan **skenario maksimum 10 foto per slot** (§1) yang melipatgandakannya tujuh kali. Dokumen `06` menetapkan kebijakan batas foto untuk menahan ini.

---

## 8. Kapan Meninggalkan Arsitektur Ini

Monolit modular bukan janji seumur hidup. Ia dipertahankan sampai salah satu pemicu berikut benar-benar terjadi — **bukan saat diantisipasi akan terjadi**:

| Pemicu | Tindakan |
|---|---|
| Satu instance Postgres konsisten > 70% CPU pada jam sibuk | Naikkan kelas VPS dulu. Pisahkan basis data belakangan |
| Job antrean > 50/detik berkelanjutan | Pindahkan antrean ke Redis + BullMQ |
| Tim tumbuh menjadi ≥ 5 orang dengan kepemilikan modul yang jelas | Pertimbangkan memecah modul pertama |
| Tenant kedua yang membutuhkan isolasi data keras | Kerjakan multitenancy (Q-06), bukan pemecahan layanan |
| Waktu deploy > 15 menit | Optimalkan build sebelum memecah apa pun |

Kalau tidak satu pun terjadi dalam tiga tahun — dan berdasarkan §1.2 kemungkinan besar memang tidak — maka arsitektur ini sudah benar sejak awal.
