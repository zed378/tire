# 00 — Analisis Sistem Referensi & Ruang Lingkup Produk

**Sistem referensi:** Commercial 2026 — *Sistem Informasi Pengolahan Data Ban Bus & Truk*
**Platform berjalan:** Google Apps Script Web App (HtmlService) + Google Sheets + Google Drive
**Sumber analisis:** `commercial2026appaudit.md`, penelusuran 1 September 2026, tiga role diuji bergantian
**Status dokumen:** dasar bagi seluruh dokumen `01`–`08`. Tidak bergantung pada keputusan arsitektur target.

> **Batas kepercayaan.** Seluruh temuan berasal dari observasi visual UI, bukan pembacaan source code. Aplikasi berjalan di dalam iframe sandbox Apps Script sehingga pembacaan DOM gagal. Setiap klaim yang tidak terverifikasi ditandai eksplisit dengan **[belum terverifikasi]**. Dokumen ini tidak menebak.

---

## 1. Ringkasan Sistem Referensi

Commercial 2026 adalah aplikasi pendataan ban kendaraan komersial (bus dan truk). Fungsinya mengumpulkan data armada dari supplier, memverifikasinya lewat Quality Control, melengkapinya dengan spesifikasi teknis ban per posisi, lalu menyajikan sebaran pengerjaan per wilayah kepada manajemen.

Aplikasi berbentuk **single-page app dengan satu URL**. Tidak ada routing per halaman, tidak ada breadcrumb, tidak ada sidebar. Seluruh navigasi ditentukan oleh role user yang login, dan menu yang tidak berhak **tidak dirender sama sekali** — bukan di-disable.

### 1.1 Rantai Nilai Inti

```
Supplier              Admin (QC)            Admin (Backend)         PM/PIC/SPV
────────              ──────────            ───────────────         ──────────
Form Pengisian   →    Modul Quality    →    Modul Backend      →    Dashboard
Kendaraan             Control                Tire Specs              Progres Wilayah
                                                                    
Buat SN baru,         Pass QC / Drop QC     Spesifikasi ban         Grafik TB vs LT
konfigurasi poros,    (gerbang tunggal)     per posisi              per provinsi/kota
upload foto/posisi                          (5 field × N posisi)    (read-only)

  Pending QC      →      Pass QC        →     (tanpa status)    →      agregasi
                         Drop QC ✕
```

Empat pihak, tiga tahap, **satu gerbang keputusan**. Modul Backend hanya menerima Serial Number berstatus `Pass QC` — ini terkonfirmasi dari label dropdown `Pilih Data Pass QC` dan dari opsi QC yang berbunyi *"Pass QC (Lanjut Ke Backend)"*.

### 1.2 Inventaris Fitur

| # | Modul | Role | Kapabilitas | Kondisi terobservasi |
|---|---|---|---|---|
| F-01 | Login | publik | Autentikasi User ID + Password, penentuan role | Berfungsi. Error login sudah memakai banner merah, bukan `alert()` |
| F-02 | Login — panel demo | publik | Tiga tombol pintasan login sebagai `supplier1` / `admin1` / `spv1` | Berfungsi. **Harus dihapus di produksi** |
| F-03 | Form Pengisian Kendaraan | Supplier | Input identitas kendaraan, segmentasi, konfigurasi poros, upload foto | Berfungsi, dengan 3 cacat validasi (§2.2) |
| F-04 | Generator Serial Number | sistem | Format `SN{tahun}-{urut 4 digit}`, di-generate sebelum submit | Berfungsi. Perilaku pada race condition **[belum terverifikasi]** |
| F-05 | Kalkulator ban otomatis | sistem | Menurunkan jumlah dan nama posisi ban dari konfigurasi poros | Berfungsi. **Inti domain aplikasi** — lihat §3.1 |
| F-06 | Generator slot foto | sistem | Membuat slot upload dinamis per posisi ban, maks 10 foto/slot | Berfungsi untuk 2 poros. Konfigurasi 3/4/6 poros **[belum terverifikasi]** |
| F-07 | Dashboard & Riwayat QC | Admin | Filter tanggal + status, tiga angka statistik (Pass/Drop/Total) | **Filter tidak berfungsi.** Tabel riwayat tidak dirender meski judul menyebut "Riwayat" |
| F-08 | Eksekusi QC | Admin | Pilih SN, tinjau detail + foto, putuskan Pass/Drop | Berfungsi. Galeri foto **[belum terverifikasi]** — data demo tanpa foto |
| F-09 | Backend Tire Specs | Admin | Revisi header kendaraan + isi 5 field spesifikasi per posisi ban | Berfungsi. Pengisian boleh parsial/bertahap |
| F-10 | User Management | Admin | Tambah user (ID, Nama, Password, Role) dan hapus user | Berfungsi. Tanpa edit, tanpa reset password |
| F-11 | Dashboard Progres Wilayah | PM/SPV | Line chart TB vs LT per kota, filter provinsi | Berfungsi. Filter provinsi berfungsi benar |
| F-12 | Export QC Excel | Admin | Unduh data QC | **Tanpa umpan balik apa pun.** Isi berkas **[belum terverifikasi]** |
| F-13 | Export Backend Excel | Admin | Unduh data spesifikasi ban | **Tanpa umpan balik apa pun.** Isi berkas **[belum terverifikasi]** |

**13 fitur, 3 role, 5 halaman.** Ini sistem kecil — dan itu kabar baik: ruang lingkup penulisan ulang terkendali.

### 1.3 Model Data Terobservasi

Diturunkan dari UI, bukan dari skema sesungguhnya. Struktur sheet asli **[belum terverifikasi]**.

```
User (User ID, Nama, Password, Role)
  │ 1 : N
  ▼
Pengajuan Kendaraan ── PK: Serial Number (SN2026-0001)
  ├─ Plat Nomor, Provinsi, Kota
  ├─ Kategori TB/LT, Segmen Utama, Kategori Bus/Truck
  │    └─ tersimpan sebagai satu string gabungan: "TB - Truck (General Cargo)"
  ├─ Merk Kendaraan, Jenis Muatan
  ├─ Jumlah Poros + rincian Steer/Drive/Free Rolling (jumlah + Single/Double)
  ├─ Total Ban (computed)
  ├─ Status QC (Pending/Pass/Drop), Nama Admin QC
  │
  ├── 1 : 2   Foto umum (tampak depan/belakang, tampak samping) — maks 10/slot
  ├── 1 : N   Foto per Posisi Ban — N = Total Ban, maks 10/posisi
  │             Drive path: {SerialNumber}_{PlatNomor}_{Posisi}
  └── 1 : N   Spesifikasi Ban per Posisi — N = Total Ban
                └─ Merk Ban, Pattern, Ukuran, PR, Vulkanisir (Y/N)

Master Wilayah: Provinsi (5) ── 1 : N ── Kota (17)
```

**Kardinalitas kunci:** satu Serial Number = satu plat nomor = satu pengajuan. Jumlah posisi ban **diturunkan sistem**, tidak diinput manual. Nama posisi ban dipakai konsisten di tiga tempat — slot upload supplier, kartu spesifikasi backend, dan path Google Drive.

### 1.4 Master Data Terkunci di Kode

Nilai-nilai berikut terobservasi sebagai daftar tetap di UI, bukan tabel yang bisa dikelola admin. Ini menjadi kandidat kuat untuk dijadikan master data yang dapat diedit.

| Master | Isi terobservasi | Jumlah |
|---|---|---|
| Provinsi | DKI Jakarta, Jawa Barat, Jawa Tengah, Jawa Timur, Banten | 5 |
| Kota | Jakarta Timur/Utara/Barat/Selatan; Bandung, Bekasi, Bogor, Karawang; Semarang, Solo, Kudus; Surabaya, Sidoarjo, Malang; Tangerang, Cilegon, Serang | 17 |
| Kategori TB/LT | TB (Truck & Bus), LT (Light Truck) | 2 |
| Segmen Utama | Bus, Truck | 2 |
| Kategori Bus | Intercity Bus (Bus AKAP), City Bus (Bus Kota) | 2 |
| Kategori Truck | General Cargo, Dump Truck, Tanker, Trailer | 4 |
| Jumlah Poros | 2, 3, 4, 6 | 4 |
| Tipe ban per poros | Single, Double | 2 |
| Role | Data Supplier, Admin, PM/PIC/SPV | 3 |
| Merk Kendaraan | datalist autocomplete — hanya `Hino` yang terkonfirmasi | **[belum terverifikasi]** |
| Merk Ban | teks bebas, tanpa daftar — `Bridgestone` pada data demo | tidak dibatasi |

> Cakupan wilayah saat ini **hanya Jawa**. Kalau bisnis akan menyentuh Sumatera, Kalimantan, atau Sulawesi, master wilayah harus jadi tabel yang dapat dikelola, bukan konstanta. Ini keputusan produk, bukan keputusan teknis.

---

## 2. Analisis Gap: Apps Script + Sheets → Aplikasi Web

### 2.1 Batas Platform yang Mengikat

Batas-batas ini bukan bug yang bisa diperbaiki di dalam Apps Script. Ia melekat pada platform, dan menentukan apakah penulisan ulang diperlukan.

| # | Batas | Konsekuensi nyata untuk sistem ini |
|---|---|---|
| B-01 | `google.script.run` bukan HTTP | Tidak ada status code yang bisa dibaca client. Kontrak error harus disimulasikan lewat envelope (lihat §2.2, D-08) |
| B-02 | `ContentService` selalu membalas `200 OK` | Tidak ada cara mengembalikan `400`/`403`/`500` yang sebenarnya, bahkan lewat `doGet`/`doPost` |
| B-03 | Sheets bukan database transaksional | Tidak ada `BEGIN`/`COMMIT`, tidak ada foreign key, tidak ada unique constraint. Generator Serial Number rawan tabrakan saat dua supplier submit bersamaan |
| B-04 | Tidak ada indeks | Pencarian dan filter memindai seluruh baris. Melambat linier terhadap jumlah pengajuan |
| B-05 | Batas eksekusi 6 menit per invocation | Export Excel atas ribuan baris, atau upload puluhan foto sekaligus, akan timeout |
| B-06 | Kuota harian Apps Script & Drive | Upload foto adalah operasi Drive. Volume tinggi menabrak kuota, dan kuota tidak bisa dibeli terpisah |
| B-07 | Iframe sandbox | Tidak ada URL per halaman, tidak bisa di-bookmark, tombol Back browser tidak berfungsi, tidak bisa share tautan ke satu SN |
| B-08 | Service Worker tidak dapat didaftarkan dari dalam sandbox | **PWA dan mode offline mustahil.** Padahal pengambilan foto ban terjadi di lapangan/garasi yang sinyalnya buruk |
| B-09 | Satu URL deploy, tanpa environment | Tidak ada pemisahan dev/staging/produksi. Setiap perubahan langsung menyentuh data nyata |
| B-10 | Tidak ada test runner | Tidak ada pengujian otomatis. Terbukti pada penelusuran: kegagalan `alert()` tidak tertangkap tooling QA |
| B-11 | Password di spreadsheet | Kredensial kemungkinan tersimpan sebagai teks polos, dapat dibaca siapa pun yang punya akses ke sheet **[belum terverifikasi]** |
| B-12 | Tidak ada audit trail | Riwayat versi Sheets bukan jejak audit aplikatif; tidak menjawab "siapa mengubah status SN ini, kapan, dari apa ke apa" |

**B-08 adalah yang paling menentukan.** Aktivitas inti sistem ini — memotret ban di enam sampai sepuluh posisi pada sebuah truk — dilakukan di lokasi fisik, bukan di meja kantor. Selama aplikasi hidup di dalam sandbox Apps Script, kemampuan offline tidak akan pernah bisa ditambahkan, berapa pun usaha yang dikeluarkan.

### 2.2 Cacat Fungsional yang Ditemukan

Berbeda dengan §2.1, semuanya **bisa** diperbaiki tanpa ganti platform. Diberi kode `D-xx` agar dapat dirujuk dari dokumen fase.

| # | Cacat | Bukti dari penelusuran | Dampak |
|---|---|---|---|
| D-01 | Filter QC (tanggal & status) tidak terhubung ke data | Filter `01/01/2020`–`12/31/2020` + `Drop QC` tetap menampilkan angka 1/0/1 dan SN Pass bertanggal 2026 | Tinggi — modul QC tidak dapat dipakai begitu data bertambah |
| D-02 | Judul "Riwayat" tanpa tabel riwayat | Kartu hanya berisi filter dan tiga angka | Sedang — Admin tidak punya daftar kerja |
| D-03 | Segmen Utama tidak mengikuti Kategori TB/LT | Dengan `LT (Light Truck)`, opsi Segmen tetap `Bus` dan `Truck` | Sedang — memungkinkan kombinasi tak masuk akal |
| D-04 | Jumlah sub-poros tidak divalidasi terhadap Jumlah Poros | `Jumlah Poros = 6` dengan Steer 1 + Drive 1 + Free Rolling 1 (=3) tetap diterima, menampilkan 10 Ban | **Tinggi — data ban yang salah mengalir ke seluruh hilir** |
| D-05 | Plat Nomor menerima karakter non-alfanumerik | Input `b 1234 abc!` → `B1234ABC!`. Spasi dihapus dan huruf dikapitalkan, tapi `!` lolos | Tinggi — merusak path Drive dan pencocokan duplikat |
| D-06 | Tidak ada pengecekan duplikat plat nomor | **[belum terverifikasi]** — tidak diuji karena akan membuat record | Tinggi jika benar |
| D-07 | Validasi memakai atribut `required` HTML5 | Tooltip `"Please fill out this field."` berbahasa Inggris di UI berbahasa Indonesia; dapat di-bypass | Sedang |
| D-08 | Seluruh error handling memakai `alert()` | Dikonfirmasi pemilik sistem. Klik `Submit Keputusan QC` tanpa status tidak meninggalkan jejak apa pun | **Tinggi — kegagalan tidak dapat di-log, di-monitor, atau diuji** |
| D-09 | Tombol Export tanpa umpan balik | Kedua tombol diklik; tidak ada spinner, notifikasi, maupun perubahan tampilan | Sedang |
| D-10 | Supplier buta terhadap status pengajuannya | Tidak ada daftar riwayat, tidak ada notifikasi Pass/Drop | **Tinggi — memaksa koordinasi manual di luar sistem** |
| D-11 | Tidak ada alur "kembalikan untuk revisi" | QC hanya Pass atau Drop | Tinggi — foto buram berarti seluruh pengajuan gugur |
| D-12 | User Management tanpa edit & reset password | Satu-satunya aksi baris adalah hapus | Sedang |
| D-13 | Tidak ada pembatasan supplier terhadap wilayah | Tidak ada field wilayah pada user | Sedang |
| D-14 | PM/SPV tanpa export | Role pelaporan justru tidak bisa mengekspor apa pun | Sedang |
| D-15 | Tidak ada jejak audit | Tidak terlihat di UI mana pun | Tinggi |
| D-16 | Panel login demo aktif | Tiga tombol yang login tanpa kredensial | **Kritis jika sudah dipakai produksi** |
| D-17 | State tab bertahan lintas sesi logout–login | Tab terakhir tetap aktif setelah login ulang | Rendah — tapi menandakan state disimpan di luar sesi |

**D-04 dan D-05 adalah yang paling merusak.** Keduanya membiarkan data cacat masuk ke hulu, lalu mengalir ke slot foto, kartu spesifikasi, path Drive, dan agregasi dashboard. Tidak ada satu pun gerbang di hilir yang bisa menangkapnya, karena QC memverifikasi foto — bukan konsistensi konfigurasi poros.

### 2.3 Yang Harus Dipertahankan

Bagian ini sama pentingnya dengan daftar cacat. Sistem berjalan sudah memutuskan sejumlah hal dengan benar, dan penulisan ulang yang membuangnya akan menghasilkan produk yang lebih buruk.

| # | Yang dipertahankan | Alasan |
|---|---|---|
| K-01 | **Derivasi posisi ban dari konfigurasi poros** | Inti domain. Rumus tervalidasi: `(steer × 2) + (drive × [4 jika Double, 2 jika Single]) + (free rolling × idem)`. Supplier tidak pernah mengetik jumlah ban — sistem yang menurunkannya. Pertahankan mutlak |
| K-02 | **Konvensi penamaan posisi ban** | `Steer 1 Kanan`, `Drive 1 Kanan Luar`, `Drive 1 Kiri Dalam`. Dipakai identik di tiga tempat. Konsistensi ini yang membuat foto dan spesifikasi bisa dipasangkan |
| K-03 | **Gerbang QC tunggal** | Hanya SN berstatus `Pass QC` yang masuk modul Backend. Sederhana, jelas, dan sudah dipahami pengguna |
| K-04 | **Segmentasi TB/LT sebagai sumbu analitik utama** | Seluruh dashboard manajemen dibangun di atas pembelahan ini |
| K-05 | **Format Serial Number `SN{tahun}-{urut}`** | Sudah dipakai sebagai identitas lintas modul dan di path Drive. Mengubahnya memutus data lama |
| K-06 | **Foto per posisi ban, maks 10 per slot** | Ini bukti kerja utama sistem. Batas 10 sudah tepat |
| K-07 | **Pembatasan role dengan tidak merender menu** | Lebih aman daripada menampilkan menu ter-disable. Pertahankan polanya, tapi tambahkan penegakan di sisi server |
| K-08 | **Banner merah yang bisa ditutup** | Pola di halaman login (`"User ID atau Password salah!"`) sudah benar. Jadikan standar untuk seluruh error tingkat halaman |
| K-09 | **Export Excel** | Format kerja nyata pengguna. Apa pun platform targetnya, Excel harus tetap ada |
| K-10 | **Bahasa Indonesia sebagai bahasa UI** | Termasuk seluruh pesan error — justru inilah yang belum konsisten hari ini |

---

## 3. Posisi Produk Target

### 3.1 Inti Produk yang Tidak Boleh Kabur

Sistem ini mudah disalahpahami sebagai "aplikasi pendataan armada". Bukan. Inti nilainya sempit dan spesifik:

> **Mengubah konfigurasi poros sebuah kendaraan menjadi sekumpulan posisi ban bernama, lalu mengikat bukti foto dan spesifikasi teknis ke tiap posisi itu, dengan satu gerbang verifikasi manusia di tengahnya.**

Segala sesuatu yang tidak melayani kalimat itu adalah kandidat untuk ditunda. Ini penting untuk menahan godaan menambahkan manajemen armada, penjadwalan servis, atau pelacakan usia ban di fase awal — semuanya masuk akal secara bisnis, tapi tidak satu pun mendesak sebelum inti di atas benar-benar kokoh.

### 3.2 Pemetaan Modul Referensi → Modul Target

| Modul referensi | Modul target | Perubahan yang direncanakan |
|---|---|---|
| Login + panel demo | **Autentikasi** | Password di-hash, sesi bertoken, panel demo dihapus, kebijakan password, kunci setelah gagal berulang |
| Form Pengisian Kendaraan | **Pengajuan Kendaraan** | + validasi poros (D-04), regex plat (D-05), cek duplikat (D-06), simpan draf, riwayat pengajuan supplier (D-10) |
| Kalkulator ban + generator slot | **Mesin Konfigurasi Poros** | Dipertahankan utuh (K-01, K-02), dipindah ke server sebagai satu sumber kebenaran, ditutup uji otomatis |
| Modul QC | **Verifikasi** | + filter yang berfungsi (D-01), tabel antrean kerja (D-02), status `Perlu Revisi` (D-11), galeri foto yang layak, komentar per foto |
| Modul Backend Tire Specs | **Spesifikasi Ban** | + master merk/ukuran ban, salin-ke-semua-posisi, penanda kelengkapan |
| User Management | **Manajemen Pengguna** | + edit, reset password, aktif/nonaktif, penugasan wilayah (D-13), larangan hapus admin terakhir |
| Dashboard PM/SPV | **Pelaporan** | + filter tanggal & kategori, tabel pendamping grafik, export (D-14) |
| Export Excel | **Export** | Umpan balik status (D-09), pemrosesan asinkron untuk volume besar |
| *(tidak ada)* | **Jejak Audit** | Modul baru (D-15). Prasyarat kepercayaan pada data QC |
| *(tidak ada)* | **Master Data** | Modul baru. Provinsi/kota/merk menjadi data yang dikelola, bukan konstanta |

Sepuluh modul. Tiga di antaranya baru; tujuh adalah penulisan ulang atas yang sudah ada.

### 3.3 Prinsip yang Mengikat Seluruh Blueprint

1. **Konfigurasi poros adalah satu-satunya sumber kebenaran jumlah ban.** Tidak ada jalur lain yang boleh menetapkan jumlah atau nama posisi ban. Klien boleh menghitung untuk pratinjau; server yang memutuskan.
2. **Setiap kegagalan harus terlihat, tercatat, dan dapat diuji.** Konsekuensi langsung dari D-08. Tidak ada lagi kegagalan senyap.
3. **Validasi di klien adalah kenyamanan; validasi di server adalah kebenaran.** Setiap aturan ditegakkan dua kali.
4. **Status hanya berubah lewat transisi yang didefinisikan.** Bukan dengan menulis kolom status secara bebas.
5. **Bukti foto tidak pernah dihapus.** Penghapusan record adalah penonaktifan, bukan pemusnahan. Foto adalah bukti kerja yang mungkin dipersoalkan berbulan-bulan kemudian.
6. **Setiap perubahan status mencatat pelaku, waktu, dan nilai sebelum–sesudah.**
7. **Bahasa Indonesia untuk seluruh teks yang dilihat pengguna**, termasuk pesan error dan validasi.
8. **Supplier hanya melihat datanya sendiri.** Ditegakkan di server, bukan dengan menyembunyikan menu.

---

## 4. Kebutuhan Non-Fungsional

Angka di bawah adalah **usulan awal**, bukan hasil pengukuran — sistem berjalan tidak punya instrumentasi apa pun. Semuanya perlu dikonfirmasi terhadap volumetrik nyata (§5, Q-01).

| Aspek | Target usulan | Alasan |
|---|---|---|
| Waktu muat halaman pertama | ≤ 3 detik pada 4G | Pengguna lapangan, bukan kantor |
| Respons aksi (submit, keputusan QC) | ≤ 1,5 detik p95 | |
| Upload foto | ≤ 8 detik per posisi pada 4G, dengan progres terlihat | Kompresi sisi klien wajib |
| Ketersediaan | 99,5% jam kerja (07.00–19.00 WIB) | Bukan sistem 24/7 |
| Kapasitas serentak | 30 supplier aktif bersamaan **[perlu konfirmasi]** | |
| Volume data tahun pertama | 10.000 pengajuan, ~70.000 posisi ban, ~200.000 foto **[perlu konfirmasi]** | Menentukan pilihan penyimpanan |
| Retensi foto | Minimal 24 bulan | Bukti kerja; angka final menunggu ketentuan kontrak |
| RPO / RTO | RPO 1 jam / RTO 4 jam | |
| Cakupan uji otomatis pada mesin konfigurasi poros | 100% cabang | K-01 adalah inti domain; tidak boleh regresi |
| Dukungan peramban | Chrome & Safari mobile 2 versi terakhir | Perangkat lapangan mendominasi |
| Aksesibilitas | Kontras teks memenuhi WCAG AA | Dipakai di garasi dengan pencahayaan buruk |

---

## 5. Pertanyaan Terbuka

Harus dijawab sebelum dokumen `01` (arsitektur) dan `05` (fase) dapat diselesaikan. Diurutkan menurut besarnya dampak terhadap keputusan.

| # | Pertanyaan | Mengapa menentukan |
|---|---|---|
| Q-01 | Berapa pengajuan per bulan, berapa supplier aktif, berapa foto per pengajuan? | Menentukan apakah Apps Script masih memadai atau sudah harus ditinggalkan |
| Q-02 | Apakah aplikasi sudah dipakai produksi, atau masih pilot? | Menentukan apakah dibutuhkan migrasi data dan berjalan paralel |
| Q-03 | Berapa banyak data nyata yang sudah ada di spreadsheet hari ini? | Menentukan strategi migrasi (dokumen `07`) |
| Q-04 | Berapa orang yang akan membangun, dan berapa lama waktunya? | Menentukan arsitektur target dan peta fase |
| Q-05 | Apakah pengambilan foto terjadi di lokasi bersinyal buruk? | Menentukan apakah kemampuan offline wajib — dan karenanya apakah B-08 mematikan Apps Script |
| Q-06 | Apakah akan melayani lebih dari satu perusahaan/tenant? | Menentukan apakah multitenancy masuk sejak awal |
| Q-07 | Apakah cakupan wilayah akan melampaui Jawa? | Menentukan apakah master wilayah harus dapat dikelola |
| Q-08 | Apakah supplier perlu melihat status pengajuannya sendiri (D-10)? | Fitur baru terbesar; mengubah ruang lingkup modul supplier |
| Q-09 | Apa isi sesungguhnya berkas Export Excel? | Belum terverifikasi; menentukan kontrak pelaporan |
| Q-10 | Apakah ada ketentuan retensi atau kerahasiaan atas foto armada pelanggan? | Menentukan kebijakan penyimpanan dan akses |

---

## 6. Indeks Dokumen Blueprint

**Keputusan yang sudah diambil dan mengikat seluruh dokumen berikutnya:**

| Pertanyaan | Jawaban |
|---|---|
| Q-01 — volume | Di atas 1.000 pengajuan/bulan |
| Q-04 — tim | Satu pengembang |
| Q-05 — target | Penulisan ulang menjadi aplikasi web mandiri |

| Dok | Judul | Isi |
|---|---|---|
| `00` | Analisis Sistem Referensi & Ruang Lingkup | Dokumen ini |
| `01` | Arsitektur & Tumpukan Teknologi | Volumetrik, monolit modular, tumpukan, deployment, biaya |
| `02` | Pemodelan Basis Data | DDL PostgreSQL, constraint, trigger, indeks, kamus istilah |
| `03` | Aturan Domain & Mesin Konfigurasi Poros | Formalisasi `K-01`/`K-02`, 34 kombinasi sah, matriks validasi, mesin status |
| `04` | Peran, Hak Akses, Autentikasi & Audit | Matriks izin, penegakan tiga lapis, kebijakan sesi & kata sandi |
| `05` | Kontrak API & Penanganan Error | Envelope, peta status code, katalog endpoint, protokol unggah |
| `06` | Pipeline Foto, PWA & Mode Offline | Kompresi, antrean offline, siklus hidup penyimpanan |
| `07` | Strategi Migrasi Data | Inventarisasi, pemetaan, migrasi foto, berjalan paralel, karantina |
| `08` | Fase Pengembangan, Estimasi & Risiko | 8 fase / 24 minggu, DoD, risk register, metrik |
| `09` | Panduan Eksekusi oleh Agent AI | `CLAUDE.md`, aturan terlingkup, hook, dekomposisi tugas, 13 gerbang CI |
| `10` | Model Operasional & Serah Terima | Peran `Operator`, panel operasional, runbook, kriteria serah terima |
| `11` | Identitas Kendaraan & Keunikan | Pemisahan kendaraan dari pemeriksaan, normalisasi plat, deduplikasi |
| `12` | Antrean, Outbox & Notifikasi | Outbox transaksional, katalog peristiwa, kanal, 8 pekerjaan antrean |
| `13` | Pengerasan Autentikasi | Sesi opaque, MFA/TOTP, step-up, CSRF, header keamanan, audit auth |

**Pertanyaan yang masih terbuka** dan diperlukan sebelum fase terkait dimulai: Q-02, Q-03, Q-09 (dijawab oleh inventarisasi di dokumen `07` §1); Q-06 (multitenancy, ditunda); Q-07 (sudah diakomodasi lewat master data); Q-08 (sudah diputuskan dibangun, dokumen `03` §8); Q-10 (retensi & privasi foto, dokumen `06` §3.1).

---

## Lampiran A — Peta Kode Rujukan

Agar dokumen lanjutan dapat merujuk temuan tanpa mengulang narasinya:

- **`F-xx`** — fitur pada sistem referensi (§1.2)
- **`B-xx`** — batas platform yang tidak dapat dihindari di Apps Script (§2.1)
- **`D-xx`** — cacat fungsional yang harus diperbaiki (§2.2)
- **`K-xx`** — keputusan sistem referensi yang dipertahankan (§2.3)
- **`Q-xx`** — pertanyaan terbuka yang memblokir dokumen lain (§5)
