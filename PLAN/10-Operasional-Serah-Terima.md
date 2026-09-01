# 10 — Model Operasional & Serah Terima

**Prasyarat:** dokumen `01` (deployment), `04` (peran), `08` (fase)
**Kendala baru:** operasional dijalankan **orang lain**, bukan pemilik sistem, bukan agent

---

## 1. Masalah yang Diselesaikan Dokumen Ini

Dokumen `01`–`09` menganggap satu orang yang sama membangun dan menjalankan sistem. Itu tidak lagi benar. Operator adalah orang ketiga yang:

- tidak menulis kodenya dan tidak akan membacanya
- tidak punya akses `psql`, dan tidak boleh diberi
- harus menyelesaikan sebagian besar masalah **tanpa memanggil pemilik sistem**

Konsekuensinya tegas: **setiap tugas operasional yang tidak punya antarmuka adalah tugas yang akan berakhir sebagai telepon ke pemilik sistem.** Kalau itu terjadi cukup sering, pemisahan peran ini gagal dan pemilik sistem menjadi dukungan tingkat satu selamanya.

Dokumen ini menentukan apa yang harus dibangun agar itu tidak terjadi.

---

## 2. Temuan: Model Peran Kehilangan Satu Orang

Dokumen `04` mendefinisikan tiga peran, diwarisi dari sistem berjalan: `Data Supplier`, `Admin`, `PM/PIC/SPV`.

Tidak satu pun cocok untuk operator.

| Tugas operasional | Peran yang muat hari ini |
|---|---|
| Reset kata sandi pengguna yang lupa | `Admin` — cocok |
| Menonaktifkan akun supplier yang berhenti | `Admin` — cocok |
| Me-retry pekerjaan export yang gagal | **tidak ada** |
| Melihat kedalaman antrean job | **tidak ada** |
| Membersihkan unggahan terlantar | **tidak ada** |
| Melihat log error dengan `requestId` yang dilaporkan pengguna | **tidak ada** |
| Memeriksa status cadangan | **tidak ada** |
| Melihat pemakaian penyimpanan objek | **tidak ada** |

Enam dari delapan tugas tidak punya rumah. Di sistem yang dibangun untuk satu orang, semuanya diselesaikan lewat SSH dan `psql`. Itu tidak dapat diserahkan kepada operator.

### 2.1 Keputusan: Peran Keempat

Ditambahkan ke dokumen `04`:

| Peran | Cakupan |
|---|---|
| `Operator` | Seluruh kapabilitas `Admin`, **ditambah** panel operasional (§3). **Tanpa** kemampuan mengubah data bisnis: tidak dapat memutuskan QC, tidak dapat mengubah spesifikasi ban |

Pembelahan itu disengaja. Operator memelihara sistem; ia tidak membuat keputusan bisnis di dalamnya. Memisahkannya menjaga jejak audit tetap bermakna — kalau operator bisa mengubah keputusan QC, log audit kehilangan nilainya sebagai bukti.

> **Dampak ke dokumen lain:** `02` (enum peran + kolom), `04` (matriks izin), `05` (endpoint panel operasional), `09` (uji izin untuk peran baru).

---

## 3. Panel Operasional

Halaman tersendiri, hanya untuk peran `Operator`. Dibangun di **F7**.

Cakupannya sengaja sempit — panel yang bisa melakukan segalanya adalah panel yang bisa merusak segalanya.

### 3.1 Isi

| Bagian | Menampilkan | Aksi yang tersedia |
|---|---|---|
| **Kesehatan sistem** | Status basis data, penyimpanan objek, kedalaman antrean — dari `/health` | — (hanya baca) |
| **Pekerjaan latar** | Job gagal 7 hari terakhir: jenis, waktu, pesan error, `requestId` | **Retry**, **Batalkan** |
| **Pencarian log** | Cari berdasarkan `requestId` | — (hanya baca) |
| **Unggahan terlantar** | Presigned URL yang tidak pernah diselesaikan | **Bersihkan** |
| **Pengguna** | Daftar pengguna, status aktif, waktu login terakhir | **Reset kata sandi**, **Aktifkan/Nonaktifkan** |
| **Penyimpanan** | Pemakaian R2, tren bulanan, proyeksi | — (hanya baca) |
| **Cadangan** | Waktu cadangan terakhir, hasil verifikasi terakhir | — (hanya baca) |

### 3.2 Aturan yang Mengikat Panel

1. **Setiap aksi tercatat di `log_audit`** dengan pelaku, waktu, dan objek yang disentuh. Panel operasional tidak dikecualikan dari audit — justru ia yang paling perlu.
2. **Tidak ada aksi yang menghapus data bisnis.** "Bersihkan unggahan terlantar" hanya menyentuh objek yang tidak pernah punya baris `foto` yang selesai.
3. **Tidak ada eksekusi SQL bebas.** Panel yang bisa menjalankan query sembarang sama saja dengan memberi akses `psql`, hanya lebih berbahaya karena terasa aman.
4. **Setiap aksi punya konfirmasi dua langkah** — dan konfirmasinya adalah dialog aplikasi, bukan `confirm()` (larangan `CLAUDE.md`).

### 3.3 Kenapa `requestId` Menjadi Poros Dukungan

Dokumen `05` mewajibkan setiap error `500` menampilkan `requestId` ke pengguna. Dengan operator terpisah, field itu berubah dari fitur bagus menjadi **tulang punggung alur dukungan**:

```
Pengguna: "gagal, kodenya req_20260901_143022_a91f"
     │
Operator: tempel di Pencarian Log
     │
     ├─ ketemu penyebab yang dikenali  →  selesai sendiri
     └─ tidak dikenali                 →  eskalasi ke pemilik sistem,
                                          dengan requestId + log lengkap
```

Tanpa itu, setiap laporan masalah dimulai dari "coba jelaskan lagi apa yang Anda lakukan" — dan berakhir di pemilik sistem.

---

## 4. Runbook

Deliverable F7. Ditulis untuk seseorang yang **tidak dapat membaca kode**, dan diuji dengan cara operator menjalankannya sendiri tanpa bantuan.

### 4.1 Isi Minimum

| Bagian | Menjawab |
|---|---|
| Peta sistem satu halaman | Apa saja komponennya, apa fungsinya, apa yang terjadi kalau salah satu mati |
| Sepuluh masalah tersering | Gejala → penyebab → langkah → kapan eskalasi |
| Cara membaca peringatan | Setiap jenis peringatan, artinya, dan apakah mendesak |
| Prosedur pemulihan cadangan | Langkah demi langkah, sudah pernah dilatih |
| Matriks eskalasi | Apa yang ditangani sendiri, apa yang naik, siapa dihubungi, seberapa mendesak |
| Kontak & akses | Akun apa yang dimiliki operator, apa yang tidak |

### 4.2 Masalah yang Sudah Dapat Diperkirakan

Diturunkan dari risiko di dokumen `01` dan `08`. Runbook ditulis mulai dari daftar ini.

| Gejala | Penyebab paling mungkin | Tindakan operator | Eskalasi bila |
|---|---|---|---|
| Supplier melapor unggah foto gagal terus | Sinyal buruk, atau kuota R2 | Cek panel penyimpanan; minta pengguna coba di area bersinyal | Kuota mendekati batas |
| Export tidak pernah selesai | Job gagal atau antrean macet | Panel pekerjaan latar → Retry | Retry gagal dua kali |
| Pengguna tidak bisa login | Lupa kata sandi, atau akun nonaktif | Panel pengguna → Reset kata sandi | Reset tidak menolong |
| Aplikasi lambat untuk semua orang | Antrean menumpuk, atau basis data terbebani | Cek kesehatan sistem | Kedalaman antrean naik terus > 30 menit |
| Peringatan tingkat error naik | Bug baru setelah deploy | Catat `requestId`, eskalasi | **Selalu** |
| Foto lama tidak dapat dibuka | Objek hilang atau kebijakan siklus hidup salah | Catat `pengajuanId`, eskalasi | **Selalu** — ini kehilangan bukti kerja |

Dua baris terakhir selalu naik. Bug baru dan kehilangan bukti bukan wilayah operator, dan menebak di situ lebih berbahaya daripada menunggu.

---

## 5. Batas Akses

| Akses | Operator | Alasan |
|---|---|---|
| Panel operasional | **Ya** | Ini rumahnya |
| Dasbor pelacakan error (Sentry) | **Ya**, hanya baca | Perlu melihat konteks error |
| Monitoring uptime | **Ya** | Perlu tahu sistem hidup |
| SSH ke VPS | **Tidak** | Tidak ada tugas yang menuntutnya setelah §3 dibangun |
| Akses basis data langsung | **Tidak** | Satu `UPDATE` keliru tidak dapat dibatalkan |
| Konsol penyimpanan objek | **Tidak** | Penghapusan objek = kehilangan bukti kerja |
| Repositori kode & pipeline deploy | **Tidak** | Bukan perannya |

Baris yang perlu dijaga adalah **SSH**. Godaannya besar saat ada insiden yang belum tercakup panel. Tapi begitu SSH diberikan sekali, ia tidak pernah ditarik kembali, dan panel berhenti dikembangkan karena selalu ada jalan pintas. Kalau muncul tugas yang menuntut SSH, **tugas itulah yang menjadi permintaan fitur panel berikutnya**.

---

## 6. Serah Terima

Bagian dari F7. Sistem tidak dinyatakan rilis sebelum seluruh baris ini terpenuhi.

| # | Butir | Kriteria selesai |
|---|---|---|
| S-01 | Panel operasional berjalan di produksi | Seluruh bagian §3.1 berfungsi |
| S-02 | Runbook selesai | §4.1 lengkap |
| S-03 | Akun operator dibuat dengan peran `Operator` | Batas §5 diverifikasi — SSH benar-benar tidak bisa |
| S-04 | Peringatan mengarah ke operator | Bukan ke pemilik sistem sebagai penerima utama |
| S-05 | **Latihan pemulihan cadangan** | Operator memulihkan ke staging **sendiri**, tanpa bantuan |
| S-06 | **Simulasi lima masalah tersering** | Operator menyelesaikan lima skenario §4.2 tanpa bantuan |
| S-07 | Jalur eskalasi disepakati | Tertulis, dengan waktu respons |
| S-08 | Masa dampingan 2 minggu | Pemilik sistem memantau tanpa mengambil alih |

**S-05 dan S-06 adalah pengujian sesungguhnya atas dokumen ini.** Runbook yang belum pernah dijalankan orang lain adalah runbook yang belum diketahui benar atau tidaknya — dan itu baru akan ketahuan pada malam terjadi insiden nyata.

---

## 7. Risiko

| # | Risiko | Kemungkinan | Dampak | Penanganan |
|---|---|---|---|---|
| O-01 | Pemilik sistem tetap jadi dukungan tingkat satu | **Tinggi** | Tinggi | Panel §3 dibangun **sebelum** rilis, bukan setelah keluhan menumpuk |
| O-02 | Operator diberi SSH saat insiden pertama | **Tinggi** | Tinggi | §5. Insiden yang menuntutnya menjadi permintaan fitur panel |
| O-03 | Runbook usang setelah beberapa rilis | Tinggi | Sedang | Perubahan alur operasional wajib memperbarui runbook di PR yang sama |
| O-04 | Operator berganti orang | Sedang | Sedang | S-05/S-06 diulang untuk setiap operator baru |
| O-05 | Panel operasional dipakai mengubah data bisnis | Sedang | Tinggi | Peran `Operator` tidak punya izinnya (§2.1); diuji di `09` G-11 |
| O-06 | Peringatan terlalu berisik lalu diabaikan | **Tinggi** | Tinggi | Mulai dari sedikit peringatan bernilai tinggi; tambah hanya setelah terbukti perlu |

O-06 sering diremehkan. Operator yang menerima empat puluh peringatan sehari akan berhenti membaca semuanya dalam dua minggu — termasuk yang penting. Lebih baik tiga peringatan yang selalu berarti sesuatu daripada tiga puluh yang kadang berarti.
