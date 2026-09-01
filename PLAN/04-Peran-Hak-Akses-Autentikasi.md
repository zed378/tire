# 04 — Peran, Hak Akses, Autentikasi & Audit

**Prasyarat:** dokumen `02`, `03`
**Menutup:** `B-11`, `B-12`, `D-12`, `D-13`, `D-15`, `D-16`, `D-17`

---

## 1. Masalah yang Diselesaikan

Sistem berjalan membatasi akses dengan cara **tidak merender menu** (`K-07`). Itu pilihan yang benar untuk UI — lebih bersih daripada menu ter-disable. Tapi ia hanya menyembunyikan, tidak menegakkan: siapa pun yang memanggil fungsi server secara langsung melewatinya sepenuhnya.

Tiga temuan yang menegaskan lapisan otorisasi harus dibangun ulang:

| Temuan | Konsekuensi |
|---|---|
| `D-16` — panel login demo dengan tiga tombol tanpa kredensial | Siapa pun yang tahu URL menjadi Admin dengan satu klik |
| `B-11` — kata sandi kemungkinan tersimpan sebagai teks polos di spreadsheet | Siapa pun yang bisa membuka sheet punya semua kredensial |
| `D-17` — state tab bertahan setelah logout–login | State disimpan di luar sesi; batas sesi tidak tegas |

---

## 2. Model Peran

Tiga peran diwarisi dari sistem berjalan, dan **satu ditambahkan**: `operator`. Penambahan itu tidak datang dari kebutuhan produk, melainkan dari keputusan bahwa operasional dipegang orang yang berbeda dari pemilik sistem. Alasan lengkapnya di dokumen `10` §2.

| Nilai enum | Label UI | Cakupan |
|---|---|---|
| `supplier` | Data Supplier | Hanya data yang dibuatnya sendiri |
| `admin` | Admin | Seluruh data operasional + manajemen pengguna |
| `manager` | PM/PIC/SPV | Hanya pelaporan agregat, read-only |
| `operator` | Operator | Pemeliharaan sistem + manajemen pengguna. **Tidak dapat menyentuh data bisnis** |

Pembelahan antara `admin` dan `operator` disengaja dan mengikat: operator memelihara sistem, ia tidak membuat keputusan bisnis di dalamnya. Kalau operator dapat mengubah keputusan QC, jejak audit kehilangan nilainya sebagai bukti — dan bukti itulah alasan utama `D-15` diperbaiki.

### 2.1 Matriks Izin

Diperluas dari matriks observasi dokumen `00` §6. Kolom baru menandai kapabilitas yang belum ada di sistem berjalan.

| Izin | `supplier` | `admin` | `manager` | `operator` | Baru? |
|---|:---:|:---:|:---:|:---:|:---:|
| `submission.create` | ✅ | — | — | — | |
| `submission.read.own` | ✅ | — | — | — | ✅ `D-10` |
| `submission.read.all` | — | ✅ | — | — | |
| `submission.update.own_draft` | ✅ | — | — | — | ✅ |
| `submission.resubmit` | ✅ | — | — | — | ✅ `D-11` |
| `photo.upload.own` | ✅ | — | — | — | |
| `photo.read` | ✅ *(miliknya)* | ✅ | — | — | |
| `qc.review` | — | ✅ | — | **—** | |
| `qc.revert` | — | ✅ | — | **—** | ✅ |
| `tirespec.write` | — | ✅ | — | **—** | |
| `masterdata.manage` | — | ✅ | — | — | ✅ Q-07 |
| `user.manage` | — | ✅ | — | ✅ | |
| `report.view` | — | ✅ | ✅ | — | |
| `report.export` | — | ✅ | ✅ | — | ✅ `D-14` |
| `audit.read` | — | ✅ | — | ✅ | ✅ `D-15` |
| `ops.health.read` | — | — | — | ✅ | ✅ dok `10` |
| `ops.job.retry` | — | — | — | ✅ | ✅ dok `10` |
| `ops.log.search` | — | — | — | ✅ | ✅ dok `10` |
| `ops.orphan.cleanup` | — | — | — | ✅ | ✅ dok `10` |

**Dua hal yang perlu diperhatikan.** Pertama, `report.export` kini diberikan kepada `manager` — dokumen `00` mencatat `D-14`, peran yang seluruh tugasnya pelaporan justru satu-satunya yang tidak bisa mengekspor apa pun. Kedua, baris `qc.*` dan `tirespec.write` sengaja kosong untuk `operator`; itu bukan kelalaian, melainkan inti dari pembelahan peran di atas.

### 2.2 Penegakan Tiga Lapis

| Lapis | Yang dilakukan | Bila gagal |
|---|---|---|
| **Navigasi** | Menu yang tidak berizin tidak dirender (`K-07` dipertahankan) | Pengguna tidak melihatnya |
| **Rute** | Middleware memeriksa izin sebelum handler jalan | `403 FORBIDDEN_ROLE` |
| **Data** | Query menyertakan cakupan pemilik/wilayah | `404 NOT_FOUND` |

Lapis ketiga sengaja mengembalikan `404`, bukan `403`. Menjawab "sumber daya ini ada tapi kamu tidak boleh melihatnya" membocorkan keberadaan Serial Number milik supplier lain.

**Cakupan data ditulis sekali:**

```typescript
// modules/submissions/scope.ts
export function scopeFor(actor: Actor) {
  if (actor.role === 'supplier') return { submittedBy: actor.id, deletedAt: null };
  if (actor.role === 'admin')    return { deletedAt: null };
  if (actor.role === 'manager')  return { deletedAt: null, status: 'passed_qc' as const };
  throw new Error('unreachable');
}
```

Setiap query pengajuan menyebar hasil fungsi ini. Mengulang kondisi cakupan di tiap query adalah cara paling umum kebocoran otorisasi lahir — satu query yang lupa, dan seluruh model runtuh.

---

## 3. Penugasan Wilayah

Menutup `D-13`. Tabel `user_regions` (dokumen `02` §6) mengikat supplier ke provinsi atau kota tertentu.

**Aturan:**
- Pengguna tanpa baris `user_regions` sama sekali → tidak dibatasi wilayah.
- Pengguna dengan baris `province_id` → boleh seluruh kota di provinsi itu.
- Pengguna dengan baris `city_id` → hanya kota itu.
- Baris provinsi dan kota boleh dicampur; hasilnya gabungan (union), bukan irisan.

Ditegakkan sebagai V-12 (dokumen `03` §4) pada saat pembuatan pengajuan, dan sebagai kondisi cakupan saat membaca.

> **Belum diputuskan:** apakah `manager` juga dibatasi wilayah. Kalau organisasi punya PM per region, ini menjadi kebutuhan; kalau hanya ada satu manajemen pusat, tidak perlu. Tabel sudah mendukung keduanya; yang belum ada adalah keputusannya.

---

## 4. Autentikasi

### 4.1 Kata Sandi

| Aspek | Ketentuan |
|---|---|
| Algoritma hash | **Argon2id**, `memoryCost=19456 KiB`, `timeCost=2`, `parallelism=1` |
| Panjang minimum | 10 karakter |
| Aturan komposisi | **Tidak ada.** Panjang lebih menentukan daripada campuran simbol |
| Daftar terlarang | 10.000 kata sandi paling umum, ditolak saat pembuatan/perubahan |
| Riwayat | Tidak boleh sama dengan kata sandi saat ini |
| Kedaluwarsa berkala | **Tidak diterapkan.** Rotasi paksa mendorong pola `Password1`, `Password2` |
| Kata sandi awal | Dibuat sistem, sekali pakai, `must_change_password = true` |

Tidak ada satu pun kata sandi lama yang dimigrasikan. Apa pun bentuk penyimpanannya hari ini, seluruh pengguna menerima kata sandi awal baru saat pindah (dokumen `07` §5).

### 4.2 Sesi

| Aspek | Ketentuan |
|---|---|
| Mekanisme | Cookie sesi `httpOnly`, `Secure`, **`SameSite=Strict`** (diperketat oleh dokumen `13` §2.1) |
| Penyimpanan | Tabel `sessions`, token disimpan sebagai hash |
| Masa berlaku | 12 jam sejak login |
| Perpanjangan | Diperpanjang saat aktif, maksimum 7 hari sejak login pertama |
| Logout | Menandai `revoked_at`, **dan membersihkan seluruh state klien** |
| Logout semua perangkat | Tersedia di halaman profil; mencabut seluruh sesi pengguna |

Masa 12 jam mengikuti pola kerja nyata: satu hari kerja lapangan, tidak lebih. Pembersihan state klien saat logout menutup `D-17` — state tab yang bertahan lintas sesi menandakan batas sesi tidak dihormati.

### 4.3 Perlindungan Login

| Ambang | Tindakan |
|---|---|
| 5 kegagalan dalam 15 menit untuk satu username | Kunci akun 15 menit |
| 20 kegagalan dalam 15 menit dari satu IP | Batasi laju IP tersebut |
| Setiap percobaan | Dicatat ke `login_attempts` |

**Pesan kegagalan selalu sama** — `"User ID atau Password salah."` — baik ketika username tidak ada, kata sandi salah, maupun akun nonaktif. Membedakannya memberi tahu penyerang username mana yang valid.

Pesan ini mempertahankan pola banner yang sudah benar di sistem berjalan (`K-08`), hanya diselaraskan ke envelope error dokumen `05`.

### 4.4 Panel Demo Dihapus

`D-16` adalah temuan paling kritis kalau aplikasi sudah menyentuh data nyata: tiga tombol yang login sebagai Supplier, Admin, atau PM/SPV **tanpa kredensial apa pun**.

Aturan target:
- Tidak ada jalur login apa pun yang melewati verifikasi kata sandi.
- Data demo hanya ada di environment `local` dan `staging`, tidak pernah di `production`.
- Uji otomatis di pipeline: pencarian teks `demoLogin` atau sejenisnya pada bundel produksi harus mengembalikan nol hasil.

---

## 5. Manajemen Pengguna

Menutup `D-12`. Sistem berjalan hanya punya tambah dan hapus — tanpa edit, tanpa reset kata sandi, tanpa nonaktif.

| Aksi | Ketentuan |
|---|---|
| Tambah | Username, nama, peran, wilayah (opsional). Kata sandi awal dibuat sistem |
| Ubah | Nama, peran, wilayah, status aktif. Username **tidak dapat diubah** |
| Reset kata sandi | Membuat kata sandi sekali pakai + `must_change_password`; seluruh sesi dicabut |
| Nonaktifkan | `is_active = false`. Tidak bisa login; datanya tetap utuh |
| Hapus | **Soft delete** (`deleted_at`). Pengajuan yang pernah dibuatnya tetap ada dan tetap merujuk |

**Empat penjagaan yang wajib:**

1. Admin tidak dapat menghapus atau menonaktifkan dirinya sendiri.
2. Admin terakhir yang aktif tidak dapat dihapus, dinonaktifkan, atau diturunkan perannya. Diperiksa dalam transaksi yang sama, bukan sebelumnya.
3. Menurunkan peran seseorang langsung mencabut seluruh sesinya.
4. Penghapusan memakai dialog konfirmasi yang mengharuskan pengetikan ulang username — bukan `confirm()` bawaan peramban.

Penjagaan 2 penting karena `uq_users_username_active` mengizinkan username dipakai ulang setelah penghapusan; tanpa penjagaan itu, satu klik dapat mengunci semua orang keluar dari sistem secara permanen.

---

## 6. Jejak Audit

Menutup `D-15` dan `B-12`. Riwayat versi Google Sheets tidak menjawab pertanyaan yang sesungguhnya penting: *siapa mengubah status pengajuan ini, kapan, dari apa ke apa, dan atas dasar apa.*

### 6.1 Yang Dicatat

| Kategori | Aksi |
|---|---|
| Pengajuan | `submission.created`, `submission.submitted`, `submission.status_changed`, `submission.deleted` |
| QC | `qc.decided`, `qc.reverted` |
| Spesifikasi ban | `tirespec.updated` |
| Foto | `photo.uploaded`, `photo.deleted` |
| Pengguna | `user.created`, `user.updated`, `user.role_changed`, `user.password_reset`, `user.deactivated`, `user.deleted` |
| Master data | `masterdata.created`, `masterdata.updated`, `masterdata.deactivated` |
| Autentikasi | `auth.login_failed`, `auth.locked`, `auth.sessions_revoked` |

Login yang berhasil tidak masuk `audit_logs` — volumenya tinggi dan nilainya rendah. Kolom `users.last_login_at` dan tabel `login_attempts` sudah cukup.

### 6.2 Aturan Pencatatan

1. **Ditulis dalam transaksi yang sama dengan perubahannya.** Bukan setelah commit, bukan sebagai job asinkron. Perubahan yang berhasil tanpa jejak audit adalah bug.
2. `before` dan `after` berisi **hanya kolom yang berubah**, sebagai JSONB.
3. `password_hash`, token, dan kolom rahasia lain **tidak pernah masuk** `before`/`after` — bahkan dalam bentuk hash.
4. `audit_logs` bersifat append-only. Tidak ada kode aplikasi yang boleh `UPDATE` atau `DELETE` di sana; peran basis data aplikasi hanya diberi `INSERT` dan `SELECT`.
5. Setiap baris membawa `request_id` yang sama dengan yang ditampilkan ke pengguna saat terjadi error (dokumen `05`).

### 6.3 Yang Dilihat Admin

Halaman audit menampilkan riwayat per entitas — dibuka dari detail pengajuan sebagai "Riwayat Perubahan". Ini juga menutup `D-02` secara tidak langsung: kartu QC yang berjudul "Riwayat" akhirnya punya riwayat sungguhan untuk ditampilkan.

Retensi 24 bulan, selaras retensi foto (dokumen `00` §4). Partisi tahunan (dokumen `02` §10) membuat pembuangan menjadi `DROP TABLE`.

---

## 7. Ringkasan Perubahan

| Dari sistem berjalan | Menjadi | Menutup |
|---|---|---|
| Kata sandi kemungkinan teks polos | Argon2id + kebijakan panjang | `B-11` |
| Panel login demo tanpa kredensial | Dihapus, diuji di pipeline | `D-16` |
| Tanpa batas percobaan login | Kunci akun + batas laju IP | — |
| State bertahan lintas sesi | Logout membersihkan seluruh state klien | `D-17` |
| Pembatasan hanya dengan menyembunyikan menu | Tiga lapis: navigasi, rute, data | `K-07` diperkuat |
| Supplier melihat data siapa pun *(bila dipanggil langsung)* | Cakupan pemilik ditegakkan server | — |
| Tanpa penugasan wilayah | `user_regions` + V-12 | `D-13` |
| Hanya tambah & hapus pengguna | Ubah, reset, nonaktif, soft delete, 4 penjagaan | `D-12` |
| Tanpa jejak audit | `audit_logs` append-only, dalam transaksi | `D-15`, `B-12` |
| `manager` tanpa export | `report.export` diberikan | `D-14` |
