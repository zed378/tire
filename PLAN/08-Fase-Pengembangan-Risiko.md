# 08 — Fase Pengembangan, Estimasi & Risiko

**Prasyarat:** seluruh dokumen sebelumnya
**Kendala:** implementasi oleh **agent AI**, verifikasi & keputusan oleh **pemilik sistem**, operasional oleh **orang ketiga**, >1.000 pengajuan/bulan, penulisan ulang penuh

---

## 1. Kenyataan yang Harus Dinyatakan Lebih Dulu

Rencana ini bukan rencana tim, dan bukan pula rencana solo biasa. Kodenya ditulis agent AI; yang manusiawi adalah **memutuskan apa yang benar dan membuktikan bahwa hasilnya benar**. Itu memindahkan letak seluruh risiko.

| Kenyataan | Konsekuensi pada rencana |
|---|---|
| Menulis kode bukan lagi hambatan | Hambatan berpindah ke **verifikasi**. Rencana diukur dengan siklus verifikasi, bukan jam koding |
| Agent menghasilkan kode lebih cepat daripada satu orang bisa memeriksanya | Gerbang CI harus menolak otomatis. Manusia hanya memeriksa yang lolos gerbang |
| Tidak ada tinjauan kode oleh manusia kedua | Uji otomatis bukan jaring pengaman — ia **satu-satunya spesifikasi yang mengikat** |
| Konteks agent hilang setiap sesi | Konvensi harus tertulis di repo (`CLAUDE.md` + hook), bukan diingat |
| Agent mengimplementasikan yang tertulis, bukan yang dimaksud | Ambiguitas spesifikasi menjadi bug yang percaya diri. Dokumen `03` harus enumeratif, bukan naratif |
| **Agent buta terhadap aturan yang tidak ada** | Ini kelemahan paling berbahaya — lihat §1.1 |
| Operasional dipegang orang lain | Setiap tugas operasional harus punya antarmuka, bukan perintah shell (§3, F7) |
| Fase yang terikat pengguna nyata tidak terkompresi | F6 tetap 6 minggu berapa pun cepatnya agent |

### 1.1 Kelemahan yang Menentukan Bentuk Rencana Ini

`D-04` adalah aturan validasi yang **tidak ada**. Jumlah sub-poros tidak pernah dicocokkan dengan Jumlah Poros, dan karena itu tidak ada yang gagal, tidak ada yang error, tidak ada yang tercatat. Sistem berjalan tenang sambil meloloskan data yang salah.

Itu persis bentuk kegagalan yang paling sulit ditangkap dalam pengembangan berbasis agent. Agent menulis kode yang lolos uji yang ada. Aturan yang tidak pernah disebut tidak akan pernah diuji, tidak akan pernah gagal, dan tidak akan pernah terlihat — sampai enam bulan kemudian ada 4.000 pengajuan dengan konfigurasi ban yang mustahil.

**Konsekuensinya mengikat:** setiap aturan validasi harus ada sebagai **baris dalam tabel enumeratif** di dokumen `03`, dan setiap baris harus punya uji yang gagal sebelum implementasi ditulis. Uji ditulis dari dokumen, bukan dari kode. Kalau uji diturunkan dari implementasi agent, ia hanya membuktikan bahwa agent konsisten dengan dirinya sendiri.

Aturan yang mengikat seluruh dokumen ini: **setiap fase menghasilkan sesuatu yang dapat dijalankan, diperlihatkan, dan diverifikasi terhadap daftar penerimaan tertulis.**

---

## 2. Peta Fase

Kolom **Implementasi** adalah pekerjaan yang dikerjakan agent. Kolom **Verifikasi** adalah pekerjaan manusia yang tidak dapat didelegasikan: membaca hasil, menguji manual, memutuskan apakah sesuatu benar. Kolom terakhir yang menentukan kalender.

| Fase | Isi | Implementasi | Verifikasi | Total |
|---|---|---:|---:|---:|
| **F0** | Fondasi, `CLAUDE.md` + hook, gerbang CI, pembuktian | 3 hari | 4 hari | 1,5 mgg |
| **F1** | Autentikasi, pengguna, master data, audit, envelope | 1 mgg | 1,5 mgg | 2,5 mgg |
| **F2** | Pengajuan & mesin konfigurasi poros | 1 mgg | **2 mgg** | 3 mgg |
| **F3** | Foto, unggah, PWA & antrean offline | 1,5 mgg | **2,5 mgg** | 4 mgg |
| **F4** | Quality Control | 0,5 mgg | 1 mgg | 1,5 mgg |
| **F5** | Spesifikasi ban, pelaporan & export | 1 mgg | 1 mgg | 2 mgg |
| **F6** | Migrasi & berjalan paralel | 1 mgg | **5 mgg** | **6 mgg** |
| **F7** | Pengerasan, serah terima operasional, rilis | 1 mgg | 2 mgg | 3 mgg |
| | | **10 mgg** | **19 mgg** | **~24 mgg** |

**24 minggu ≈ 5,5 bulan**, turun dari 35 minggu pada rencana sebelumnya — tapi perhatikan dari mana penghematannya datang dan dari mana tidak.

### 2.1 Apa yang Terkompresi dan Apa yang Tidak

| Terkompresi kuat | Tidak terkompresi sama sekali |
|---|---|
| Menulis komponen UI, rute API, skema Prisma | **F6 berjalan paralel** — terikat kalender supplier nyata, bukan kecepatan koding |
| Menulis uji dari tabel enumeratif | **F3 pengujian lapangan** — antrean offline harus diuji di garasi dengan sinyal buruk, oleh manusia |
| Boilerplate, migrasi, seed | **Keputusan produk** — Q-06, format export, kebijakan retensi |
| Memperbaiki bug yang uji-nya sudah gagal | **Membaca dan memahami kode yang dihasilkan** |

F6 tetap 6 minggu. Tidak ada agent yang bisa mempercepat proses meyakinkan supplier untuk memakai dua sistem sekaligus selama sebulan.

### 2.2 Kalender Sesungguhnya

Yang dihitung di sini adalah ketersediaan **pemilik sistem untuk memverifikasi** — bukan untuk koding.

| Ketersediaan verifikasi | Kalender |
|---|---|
| Penuh waktu | **~5,5 bulan** |
| Paruh waktu (20 jam/minggu) | **~10 bulan** |
| Sampingan (10 jam/minggu) | **~20 bulan** — dan lebih berbahaya dari sebelumnya |

Baris ketiga sekarang lebih berisiko daripada di rencana lama, bukan lebih aman. Dulu, sedikit waktu berarti sedikit kode yang ditulis — proyek melambat tapi tetap benar. Sekarang, agent tetap memproduksi kode dengan kecepatan penuh sementara verifikasi tertinggal. **Yang menumpuk bukan pekerjaan yang belum selesai, melainkan kode yang belum pernah diperiksa siapa pun.** Itu keadaan yang jauh lebih buruk, karena terlihat seperti kemajuan.

Aturan pengaman: **jangan pernah memulai fase berikutnya sebelum daftar penerimaan fase sekarang ditandatangani.** Kalau verifikasi tertinggal, agent berhenti — bukan lanjut.

---

## 3. Rincian Fase

### F0 — Fondasi & Pembuktian (2 minggu)

**Tujuan:** membuktikan tiga hal paling berisiko bekerja, sebelum apa pun dibangun di atasnya.

| Kegiatan | Hasil |
|---|---|
| Repo, TypeScript, Prisma, Docker Compose | `docker compose up` menjalankan aplikasi + Postgres |
| CI: lint, typecheck, uji, migrasi | Pipeline hijau |
| Deploy ke VPS staging + Caddy | URL staging aktif dengan TLS |
| **Spike: mesin konfigurasi poros** | `derivePositions()` lolos 34 kombinasi (dokumen `03` §6) |
| **Spike: unggah presigned ke R2 dari ponsel** | Satu foto terunggah dari perangkat nyata |
| **Spike: Service Worker + antrean IndexedDB** | Satu item bertahan melewati offline lalu terunggah |

**Definition of Done:** ketiga spike berjalan di perangkat nyata, bukan di simulator. Halaman "hello" dapat diakses dari ponsel lewat URL staging.

> Mesin poros diselesaikan di F0, bukan di F2. Ia logika murni tanpa dependensi, jadi bisa dikerjakan lebih awal — dan kalau ada kesalahpahaman soal domain, lebih baik ketahuan di minggu kedua daripada di minggu kesepuluh.

### F1 — Platform Inti (5 minggu)

| Kegiatan | Menutup |
|---|---|
| Skema dasar + migrasi Prisma | dok `02` |
| Autentikasi: Argon2id, sesi, kunci akun | `B-11`, `D-16` |
| Manajemen pengguna lengkap + 4 penjagaan | `D-12` |
| Penugasan wilayah | `D-13` |
| Master data: provinsi, kota, merk | Q-07 |
| **Envelope error + tiga kanal tampilan** | `D-07`, `D-08`, `D-09` |
| Jejak audit | `D-15` |
| Kerangka layout, navigasi per peran | `K-07` |

**Definition of Done:** admin dapat login, membuat ketiga jenis pengguna, mengelola master data, dan melihat jejak audit atas semuanya. Pencarian `alert(` mengembalikan nol hasil. Setiap error menampilkan `requestId` yang cocok dengan Sentry.

Envelope error dibangun di F1, bukan di akhir. Membangunnya belakangan berarti membongkar setiap handler yang sudah ditulis.

### F2 — Pengajuan & Mesin Poros (5 minggu)

| Kegiatan | Menutup |
|---|---|
| Tabel `submissions`, `axle_configs`, `tire_positions` | dok `02` |
| Generator Serial Number atomik, 5 digit | `B-03` |
| Formulir pengajuan lengkap | `F-03` |
| Validasi V-01 s.d. V-11 | `D-03`, `D-04`, `D-05`, `D-06` |
| Mesin status + transisi | `D-11` |
| Daftar pengajuan supplier | `D-10` |
| Simpan draf | baru |

**Definition of Done:** supplier dapat membuat, menyimpan draf, dan mengirim pengajuan. Konfigurasi poros yang tidak konsisten **ditolak dengan pesan yang menjelaskan angkanya**. Plat duplikat ditolak. Supplier melihat daftar pengajuannya sendiri, dan tidak dapat melihat milik orang lain bahkan lewat permintaan langsung.

### F3 — Foto, PWA & Offline (6 minggu)

Fase terpanjang dan paling berisiko.

| Kegiatan | Menutup |
|---|---|
| Kompresi di perangkat, penanganan EXIF | dok `06` §3 |
| Presign → unggah → confirm | dok `05` §7 |
| Slot foto dinamis per posisi ban | `F-06`, `K-02` |
| Antrean IndexedDB + percobaan ulang | `B-08` |
| Service Worker + manifest + strategi cache | dok `06` §5 |
| Job pembersih objek yatim | — |
| Uji di perangkat nyata, termasuk iOS | dok `06` §4.3 |

**Definition of Done:** satu kendaraan dapat difoto lengkap dalam kondisi pesawat, lalu terunggah utuh saat sinyal kembali. Diuji pada minimal satu Android kelas menengah **dan** satu iPhone.

> Kalau uji iOS menunjukkan antrean hilang dalam kondisi pemakaian nyata, keputusan PWA harus ditinjau ulang di sini — bukan setelah rilis.

### F4 — Quality Control (4 minggu)

| Kegiatan | Menutup |
|---|---|
| Antrean kerja QC dengan filter yang berfungsi | **`D-01`**, **`D-02`** |
| Galeri foto per posisi + komentar | `F-08` |
| Keputusan: pass / drop / **revision** | **`D-11`** |
| Batalkan keputusan | baru |
| Riwayat QC per pengajuan | audit |
| Alur kirim ulang oleh supplier | `D-11` |

**Definition of Done:** admin dapat menyaring antrean berdasarkan status dan tanggal — **dan hasilnya benar-benar berubah**. Pengajuan dapat dikembalikan untuk revisi dengan alasan tertulis, supplier melihat alasan itu, memperbaiki, dan mengirim ulang.

### F5 — Spesifikasi Ban, Pelaporan & Export (4 minggu)

| Kegiatan | Menutup |
|---|---|
| Formulir spesifikasi per posisi + indikator kelengkapan | `F-09` |
| Salin spesifikasi ke posisi lain | baru |
| Penegakan `passed_qc` di server | dok `03` §7.3 |
| Dashboard wilayah + materialized view | `F-11` |
| Filter tanggal & kategori di dashboard | baru |
| Export Excel asinkron dengan progres | `D-09` |
| Export untuk peran manager | **`D-14`** |

**Definition of Done:** export menghasilkan berkas dengan umpan balik status di setiap tahap. Dashboard menampilkan angka yang cocok dengan hitungan manual atas data uji.

### F6 — Migrasi & Berjalan Paralel (6 minggu)

Mengikuti dokumen `07` sepenuhnya.

| Minggu | Kegiatan |
|---|---|
| 1 | Inventarisasi I-01 s.d. I-04 |
| 2 | Skrip migrasi + karantina, dijalankan ke staging |
| 3 | Migrasi foto berbatch, verifikasi jumlah |
| 4–5 | Berjalan paralel dengan 1–2 supplier, bandingkan harian |
| 6 | Selesaikan karantina, penuhi daftar prasyarat cutover |

**Definition of Done:** seluruh butir prasyarat dokumen `07` §7 tercentang. Nol selisih tak terjelaskan selama 5 hari kerja berturut-turut.

### F7 — Pengerasan & Rilis (3 minggu)

| Kegiatan |
|---|
| Uji beban pada volume tahun ke-3 (43.200 pengajuan, 648.000 foto) |
| Uji pemulihan backup ke staging, dicatat |
| Sentry, uptime, peringatan (dokumen `01` §6) |
| Anggaran kinerja ditegakkan di CI (dokumen `06` §7) |
| Uji Playwright untuk seluruh alur utama |
| Panduan pengguna per peran + runbook operasional |
| Cutover; sistem lama menjadi read-only |

**Definition of Done:** sistem melayani seluruh pengguna. Sistem lama read-only, tidak dihapus.

---

## 4. Yang Sengaja Tidak Dibangun

| Tidak dibangun | Kapan ditinjau ulang |
|---|---|
| Multitenancy | Saat ada perusahaan kedua yang nyata (Q-06) |
| Aplikasi native | Bila uji iOS di F3 gagal, atau mayoritas pengguna iPhone |
| Notifikasi push | Setelah rilis; supplier sudah melihat status di daftar (`D-10`) |
| Peran kustom / matriks izin dinamis | Saat peran keempat benar-benar diminta |
| Pelacakan usia & rotasi ban | Modul terpisah, setelah inti kokoh |
| Integrasi ERP / API publik | Saat ada yang memintanya |
| Deteksi lokasi palsu, liveness wajah | Tidak ada indikasi kebutuhan |
| Impor Excel massal | Setelah rilis, bila pola kerja menuntutnya |
| Aplikasi analitik terpisah | Dashboard yang ada sudah menjawab pertanyaan hari ini |

Daftar ini sama pentingnya dengan peta fase. Bagi satu orang, hal yang membunuh proyek biasanya bukan yang sulit — melainkan yang menumpuk.

---

## 5. Risk Register

| # | Risiko | Kemungkinan | Dampak | Penanganan |
|---|---|---|---|---|
| R-01 | **Kode terakumulasi lebih cepat daripada diverifikasi** | **Tinggi** | **Fatal** | Aturan §2.2: fase tidak dimulai sebelum daftar penerimaan fase sebelumnya ditandatangani |
| R-02 | Sistem lama menabrak batas Sheets sebelum pengganti siap | Sedang | Tinggi | Ukur pemakaian sel bulanan; arsipkan tahun lama ke spreadsheet terpisah sebagai penahan sementara |
| R-03 | Antrean offline iOS terbukti tidak andal (F3) | Sedang | Tinggi | Diuji di F3 oleh manusia di lapangan, bukan oleh agent di CI; jalur mundur ke native diakui terbuka |
| R-04 | Volume data migrasi jauh lebih besar dari perkiraan | Sedang | Sedang | I-01/I-02 di awal F6; F6 dapat diperpanjang tanpa mengganggu fase lain |
| R-05 | Data lama banyak melanggar V-01 (`D-04`) | **Tinggi** | Sedang | Diukur di F6 minggu 1; tiga jalur penanganan sudah disiapkan (dok `07` §3.2) |
| R-06 | Pengguna menolak berjalan paralel | Sedang | Sedang | Batasi ke 1–2 supplier yang bersedia; jangan paksa semua |
| R-07 | Format export baru memutus proses kerja hilir | Sedang | Sedang | I-04 di awal F6; libatkan pemakainya sebelum mengunci format |
| R-08 | Cakupan melebar di tengah jalan | **Tinggi** | Tinggi | §4 adalah kontrak. Permintaan baru masuk daftar, bukan masuk fase berjalan |
| R-09 | **Agent menghilangkan aturan validasi tanpa ada yang gagal** | **Tinggi** | **Fatal** | §1.1. Uji ditulis dari dokumen `03` sebelum implementasi. Uji mutasi pada modul `axle` |
| R-10 | **Agent menyimpang dari konvensi lintas sesi** | **Tinggi** | Sedang | `CLAUDE.md` + hook + lint boundary + gerbang CI (dok `09`) |
| R-11 | Panel demo (`D-16`) tetap aktif di produksi | Rendah | **Fatal** | Uji pipeline; tidak bergantung ingatan |
| R-12 | Bug pada mesin poros baru ketahuan setelah ratusan pengajuan | Rendah | Tinggi | Cakupan 100% cabang + uji enumerasi 34 kombinasi + uji snapshot label |
| R-13 | **Kode berjalan benar tapi tidak dipahami siapa pun** | **Tinggi** | Tinggi | Larangan kepintaran yang tidak perlu di `CLAUDE.md`; kode membosankan adalah persyaratan, bukan selera |
| R-14 | **Operator tidak dapat menyelesaikan insiden tanpa pemilik sistem** | **Tinggi** | Tinggi | Setiap tugas operasional punya antarmuka (dok `10`); runbook adalah deliverable F7 |
| R-15 | **Agent menulis rahasia/kredensial ke repo** | Sedang | **Fatal** | Pemindai rahasia di pre-commit dan CI; tidak bergantung pada perilaku agent |
| R-16 | Agent memakai pustaka yang tidak ada atau versinya salah | Sedang | Rendah | `pnpm-lock.yaml` dikunci; CI gagal kalau lockfile berubah tanpa disengaja |

Tiga baris layak diberi perhatian khusus.

**R-01 adalah risiko nomor satu proyek ini**, menggantikan "pengembang tunggal berhenti" dari rencana lama. Risiko lama bersifat mendadak dan terlihat. Risiko baru bersifat diam-diam: setiap minggu tampak produktif, sampai ada bug produksi di bagian kode yang tidak pernah dibaca siapa pun.

**R-09 adalah R-01 dalam bentuk paling spesifik.** `D-04` di sistem berjalan membuktikan aturan yang hilang bisa bertahan berbulan-bulan tanpa terdeteksi. Satu-satunya penawarnya adalah uji yang diturunkan dari dokumen, ditulis sebelum kodenya ada.

**R-13 tidak ada di rencana mana pun sebelum ini.** Agent cenderung menghasilkan solusi yang benar tapi padat — abstraksi yang tidak perlu, kepintaran yang menghemat lima baris dengan biaya satu jam pemahaman. Enam bulan kemudian, kode itu harus dipahami manusia untuk diperbaiki. Kode membosankan adalah persyaratan yang ditulis eksplisit di `CLAUDE.md`.

---

## 6. Metrik

### 6.1 Selama Pembangunan

| Metrik | Target |
|---|---|
| Cakupan cabang modul `axle` | 100% |
| Cakupan baris keseluruhan | ≥ 70% |
| Pipeline CI | Hijau di setiap commit ke `main` |
| Waktu build + uji | ≤ 5 menit |
| Migrasi Prisma yang gagal di staging | 0 |

### 6.2 Setelah Rilis

| Metrik | Target | Dibandingkan sistem lama |
|---|---|---|
| Tingkat error 5xx | < 0,5% | Tidak terukur — tidak ada instrumentasi |
| p95 waktu respons | < 1,5 detik | Tidak terukur |
| Kegagalan unggah foto | < 2% | Tidak terukur |
| Antrean offline yang hilang | 0 | Tidak berlaku — fitur ini tidak ada |
| Pengajuan yang ditolak karena data tidak konsisten | Terpantau | Tidak ada — data cacat lolos diam-diam (`D-04`) |
| Waktu supplier mengetahui hasil QC | < 1 menit | Tidak terukur — tidak ada notifikasi apa pun (`D-10`) |

Kolom kanan menunjukkan hal yang mudah terlewat: sebagian besar target ini tidak dapat dibandingkan dengan sistem berjalan, karena sistem berjalan tidak mengukur apa pun. Kemampuan mengetahui apa yang sedang terjadi adalah salah satu hasil terbesar dari penulisan ulang ini — dan itu sepenuhnya berasal dari `D-08` yang ditutup di F1.

---

## 7. Urutan Pengerjaan Kalau Waktu Menyempit

Kalau kalender terpaksa dipotong, urutan pengorbanan yang paling tidak merusak:

1. **F5 sebagian** — dashboard bisa dirilis tanpa filter tanggal dan tanpa export manager, ditambahkan setelahnya.
2. **Simpan draf (F2)** — nyaman, tapi bukan penghalang.
3. **Batalkan keputusan QC (F4)** — jarang dipakai.
4. **Salin spesifikasi antarposisi (F5)** — penghemat waktu, bukan kebutuhan.

**Yang tidak boleh dipotong dalam keadaan apa pun:**

- Envelope error dan tiga kanal tampilan (F1) — memotongnya berarti mewarisi `D-08` ke sistem baru
- Validasi V-01 dan V-07 (F2) — `D-04` dan `D-05` adalah cacat paling merusak yang ditemukan
- Antrean offline (F3) — inilah alasan tulis ulang ini masuk akal
- Uji mesin poros (F0) — satu-satunya perlindungan atas inti domain
- Berjalan paralel (F6) — satu-satunya cara mengetahui migrasi benar
