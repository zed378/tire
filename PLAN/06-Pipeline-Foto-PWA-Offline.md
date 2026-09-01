# 06 — Pipeline Foto, PWA & Mode Offline

**Prasyarat:** dokumen `01`, `02`, `05`
**Menutup:** `B-06`, `B-08`, dan menetapkan kebijakan yang menahan skenario penyimpanan maksimum

---

## 1. Mengapa Dokumen Ini Ada

Aktivitas inti sistem ini adalah memotret ban di enam sampai dua puluh dua posisi pada sebuah truk. Itu terjadi di pool, garasi, dan bahu jalan — bukan di meja kantor. Karena itu foto adalah **jalur kritis produk**, bukan lampiran.

Dokumen `00` mencatat `B-08` sebagai batas paling menentukan: selama aplikasi hidup di iframe sandbox Apps Script, Service Worker tidak dapat didaftarkan, sehingga mode offline mustahil ditambahkan berapa pun usaha yang dikeluarkan. Keputusan tulis-ulang menghapus batas itu. Dokumen ini memakai kebebasan tersebut — dengan jujur soal apa yang masih tidak bisa dijanjikan.

---

## 2. Alur di Lapangan

```
Petugas tiba di kendaraan
        │
        ├─ Buka aplikasi (tershell PWA, ikon di home screen)
        ├─ Isi identitas kendaraan + konfigurasi poros
        │      └─► mesin poros membangkitkan N slot foto bernama
        │
        ├─ Untuk tiap slot: ambil foto dari kamera
        │      ├─ kompresi di perangkat
        │      ├─ masuk antrean lokal (IndexedDB)
        │      └─ tandai "menunggu unggah"
        │
        ├─ Sinyal ada?  ──ya──► unggah langsung ke R2
        │                └─tidak─► tetap di antrean, coba lagi otomatis
        │
        └─ Kirim pengajuan
               └─ hanya diizinkan bila seluruh foto sudah terunggah
```

Poin terakhir adalah keputusan produk yang perlu dinyatakan tegas: **pengiriman menunggu foto selesai terunggah.** Alternatifnya — mengirim pengajuan lalu foto menyusul — menciptakan pengajuan setengah jadi yang muncul di antrean QC tanpa bukti, dan admin tidak punya cara membedakannya dari pengajuan yang memang tanpa foto.

Sebagai gantinya, layar menampilkan progres per slot dan tombol kirim tetap nonaktif dengan penjelasan: *"3 dari 6 foto menunggu sinyal."*

---

## 3. Kompresi di Perangkat

Foto langsung dari kamera ponsel modern berukuran 3–8 MB. Mengunggah 15 foto sebesar itu lewat 4G lapangan adalah 60–120 MB per kendaraan — tidak dapat diterima, baik bagi kuota petugas maupun bagi biaya penyimpanan.

| Parameter | Nilai | Alasan |
|---|---|---|
| Sisi terpanjang | 1.600 px | Cukup membaca merk, pattern, dan kondisi tapak |
| Format | WebP, kualitas 0,78 | ~30% lebih kecil dari JPEG pada kualitas setara |
| Fallback | JPEG kualitas 0,82 | Untuk peramban lawas |
| Target ukuran | 300–500 KB | Dasar perhitungan penyimpanan dokumen `01` §1 |
| Batas keras | 5 MB | Ditolak `413 FILE_TOO_LARGE` |

Kompresi memakai `createImageBitmap` + `OffscreenCanvas` di Web Worker, sehingga UI tidak membeku saat memproses.

### 3.1 EXIF: Keputusan yang Perlu Diambil

Metadata EXIF berisi waktu pengambilan dan sering berisi koordinat GPS.

| Opsi | Yang didapat | Yang hilang |
|---|---|---|
| **Buang seluruh EXIF** | Privasi maksimum, ukuran lebih kecil | Tidak ada bukti kapan dan di mana foto diambil |
| **Simpan waktu, buang GPS** | Bukti waktu, tanpa pelacakan lokasi | Tidak bisa memverifikasi foto diambil di lokasi kendaraan |
| **Simpan waktu dan GPS** | Bukti terkuat | Merekam pergerakan petugas; menyentuh UU PDP |

**Rekomendasi: opsi kedua.** Simpan `captured_at` ke kolom yang sudah ada di tabel `photos`, buang sisanya. Alasannya: nilai utama foto adalah membuktikan *kondisi ban*, bukan *keberadaan petugas*. Merekam koordinat setiap petugas sepanjang hari kerja adalah pengumpulan data pribadi yang memerlukan dasar hukum, pemberitahuan, dan kebijakan retensi tersendiri — beban yang besar untuk manfaat yang belum diminta siapa pun.

> **Perlu konfirmasi (terkait Q-10).** Kalau kontrak dengan pelanggan armada menuntut bukti lokasi, opsi ketiga menjadi kebutuhan — dan menyeret serta kewajiban persetujuan pengguna, kebijakan privasi, serta batas retensi yang eksplisit.

**Peringatan yang harus diketahui sejak awal:** `captured_at` berasal dari jam perangkat, yang dapat diubah pengguna. Ia bukti lemah, bukan bukti kuat. Jangan pernah dipakai sebagai satu-satunya dasar sengketa.

---

## 4. Antrean Offline

### 4.1 Rancangan

Antrean disimpan di **IndexedDB**, bukan di Cache API, karena isinya adalah pekerjaan yang belum selesai — bukan salinan sumber daya.

```
Antrean unggah (IndexedDB)
├─ id, submissionLocalId, positionCode
├─ blob (foto terkompresi)
├─ checksum sha256
├─ attempts, lastError, nextAttemptAt
└─ status: pending | uploading | done | failed
```

Pemroses antrean berjalan saat: aplikasi dibuka, koneksi kembali (`online`), tab menjadi terlihat, dan setiap 30 detik selama ada antrean. Percobaan ulang memakai backoff eksponensial dengan jitter, maksimum 8 kali, lalu ditandai `failed` dan **ditampilkan ke pengguna** — tidak pernah dibuang diam-diam.

`checksum_sha256` (dokumen `02` §8.3) membuat pengiriman ulang bersifat idempoten: foto yang sama tidak pernah menghasilkan dua baris.

### 4.2 Background Sync Tidak Diandalkan

Background Sync API tidak tersedia di Safari iOS, dan sebagian besar petugas lapangan Indonesia memakai Android — tapi tidak semua. Antrean karena itu **tidak bergantung padanya**: ia berjalan dari kode aplikasi biasa saat aplikasi terbuka. Background Sync dipakai kalau tersedia, sebagai bonus, bukan sebagai fondasi.

Konsekuensi yang harus dikatakan jujur kepada pengguna: **foto terunggah saat aplikasi dibuka dan ada sinyal.** Bukan secara ajaib di latar belakang. Layar antrean menampilkan kalimat itu apa adanya.

### 4.3 Batas Jujur di iOS

| Batas | Dampak |
|---|---|
| Penyimpanan situs dibersihkan setelah ~7 hari tanpa dibuka | **Antrean bisa hilang** |
| Tidak ada Background Sync | Antrean hanya jalan saat aplikasi terbuka |
| Tidak ada Web Push di luar PWA terpasang | Notifikasi terbatas |
| Kuota penyimpanan lebih ketat | Antrean besar bisa ditolak |

Penanganan: peringatan tegas di layar antrean bila ada foto tertunda lebih dari 48 jam, dan tombol "unggah sekarang" yang menonjol. Ini tidak menghapus risikonya — hanya membuatnya terlihat.

**Kalau petugas lapangan mayoritas memakai iPhone, PWA bukan pilihan yang tepat dan aplikasi native perlu dipertimbangkan.** Ini pertanyaan yang belum terjawab dan sebaiknya diselesaikan sebelum Fase 3 (dokumen `08`).

---

## 5. Service Worker

| Sumber daya | Strategi |
|---|---|
| Shell aplikasi (HTML, JS, CSS) | Precache, `stale-while-revalidate` |
| Master data (provinsi, kota, merk) | `stale-while-revalidate`, TTL 24 jam |
| Daftar pengajuan | `network-first`, fallback cache |
| **Foto** | **Tidak di-cache** |
| **Endpoint autentikasi** | **Tidak pernah di-cache** |

Foto tidak di-cache karena dua alasan: ukurannya cepat memenuhi kuota, dan ia berisi data armada pelanggan yang tidak seharusnya bertahan di perangkat setelah pekerjaan selesai.

**Aturan keamanan yang mengikat:**

1. Token sesi tidak pernah masuk Cache API maupun IndexedDB. Cookie `httpOnly` (dokumen `04` §4.2) tidak dapat disentuh JavaScript — itu memang tujuannya.
2. Cache diberi nama bersufiks ID pengguna. Logout menghapus seluruh cache milik pengguna itu. Perangkat bersama di pool adalah skenario nyata.
3. Service Worker adalah kode istimewa. Ia hanya boleh diperbarui lewat pipeline deploy, tidak pernah dari sumber lain.

### 5.1 Pembaruan Aplikasi

Service Worker yang basi menyajikan versi lama yang bisa berbicara dengan API versi baru. Penanganannya:

- Setiap build membawa `APP_VERSION`; setiap response API membawa header `X-App-Version`.
- Klien membandingkannya. Bila berbeda mayor, tampilkan spanduk: *"Versi baru tersedia. Muat ulang untuk melanjutkan."*
- Pemuatan ulang **ditahan selama antrean masih berisi** — memuat ulang di tengah unggahan berisiko kehilangan pekerjaan.

---

## 6. Siklus Hidup Penyimpanan

Menutup `B-06` sekaligus menahan skenario biaya terburuk.

| Kebijakan | Nilai | Alasan |
|---|---|---|
| Batas foto per slot | 10 (`K-06`) | Dipertahankan dari sistem berjalan |
| **Batas foto per pengajuan** | **30** | **Baru.** Menahan skenario maksimum |
| Retensi | 24 bulan sejak `passed_qc` | Dokumen `00` §4 |
| Kelas penyimpanan | Standar 6 bulan → Infrequent Access setelahnya | Foto lama jarang dibuka |
| Versioning | Aktif, 90 hari untuk objek terhapus | Perlindungan penghapusan tak sengaja |

**Batas 30 foto per pengajuan adalah penambahan yang penting.** Dokumen `01` §1 menghitung dua skenario: 1,5 foto per slot menghasilkan 84 GB/tahun; 10 foto per slot menghasilkan **562 GB/tahun** — hampir tujuh kali lipat. Batas 10 per slot saja tidak menahan apa pun ketika sebuah kendaraan 6-poros punya 22 posisi.

Tiga puluh foto sudah lebih dari cukup: dua foto umum ditambah satu foto untuk tiap posisi pada kendaraan terbesar berjumlah 24. Angka ini perlu dikonfirmasi terhadap praktik lapangan sebelum dikunci.

### 6.1 Penghapusan

Menghapus foto adalah `deleted_at` pada baris `photos`, **bukan** penghapusan objek R2. Prinsip dokumen `00` §3.3 poin 5: foto adalah bukti kerja yang mungkin dipersoalkan berbulan-bulan kemudian.

Objek dihapus dari R2 hanya oleh job retensi, setelah masa 24 bulan lewat, dan hanya untuk pengajuan yang sudah final.

---

## 7. Anggaran Kinerja

Ditegakkan di CI; build gagal bila terlampaui.

| Metrik | Anggaran |
|---|---|
| JS awal (terkompresi) | ≤ 180 KB |
| Largest Contentful Paint pada 4G | ≤ 2,5 detik |
| Interaksi ke respons berikutnya | ≤ 200 ms |
| Waktu kompresi satu foto | ≤ 800 ms pada perangkat kelas menengah |
| Waktu unggah satu foto pada 4G | ≤ 8 detik (dokumen `00` §4) |

Perangkat uji acuan bukan ponsel kelas atas. Petugas lapangan memakai perangkat kelas menengah berusia dua sampai tiga tahun, dan itu yang harus dijadikan patokan.

---

## 8. Ringkasan Keputusan

| Keputusan | Nilai | Status |
|---|---|---|
| PWA, bukan native | Ya, dengan batas iOS yang dinyatakan terbuka | Perlu ditinjau ulang bila mayoritas pengguna iPhone |
| Unggah langsung ke R2 | Ya, lewat presigned URL | Ditetapkan |
| Kompresi di perangkat | 1.600 px, WebP q0,78 | Ditetapkan |
| EXIF | Simpan waktu, buang GPS | **Perlu konfirmasi** (Q-10) |
| Antrean offline | IndexedDB, tidak bergantung Background Sync | Ditetapkan |
| Kirim menunggu foto selesai | Ya | Ditetapkan |
| Batas foto per pengajuan | 30 | **Perlu konfirmasi lapangan** |
| Cache foto di perangkat | Tidak | Ditetapkan |
| Retensi | 24 bulan | **Perlu konfirmasi** (Q-10) |
