# 13 — Pengerasan Autentikasi

**Prasyarat:** `04` (model peran, dasar autentikasi), `01` (SPA terpisah dari API)
**Menutup:** `B-11`, `D-16`, dan menyelesaikan kontradiksi antara dokumen `01` dan `04`
**Menambah:** MFA, manajemen perangkat, step-up, CSRF, header keamanan

---

## 1. Kontradiksi yang Harus Diselesaikan Lebih Dulu

Dua dokumen mengatakan hal berbeda tentang mekanisme sesi:

| Dokumen | Menyatakan |
|---|---|
| `01` §4.1 | JWT akses pendek + refresh token cookie `httpOnly` |
| `04` §4.2 | Cookie sesi `httpOnly` + tabel `sessions`, token disimpan sebagai hash |

Keduanya tidak dapat berlaku bersamaan, dan pilihannya menentukan seberapa keras sistem ini dapat dikeraskan.

### 1.1 Keputusan: Sesi Opaque di Server, Bukan JWT

**Dokumen `04` yang benar. Referensi JWT di dokumen `01` dicabut.**

| Kriteria | JWT | Sesi opaque |
|---|---|---|
| Pencabutan seketika | ❌ Token tetap sah sampai kedaluwarsa | ✅ Hapus baris, selesai |
| Turunkan peran → cabut akses | ❌ Tertunda sampai token berikutnya | ✅ Seketika |
| Daftar perangkat aktif | Perlu tabel terpisah | ✅ Sudah ada |
| Ukuran cookie | Besar, membawa klaim | Kecil, hanya pengenal |
| Skala tanpa state | ✅ | ❌ Perlu query basis data |
| Kebocoran token | Tidak dapat dihentikan | Dapat dihentikan seketika |

Satu-satunya keunggulan JWT adalah baris kelima, dan itu **tidak relevan di sini**: satu proses API, satu basis data, populasi pengguna kecil. Yang ditukar adalah kemampuan mencabut akses seketika — kemampuan yang justru menjadi inti dari "hardened".

Dokumen `04` §5 sudah mensyaratkan "menurunkan peran seseorang langsung mencabut seluruh sesinya". **Dengan JWT, persyaratan itu tidak dapat dipenuhi.** Kontradiksinya sudah ada di blueprint sejak awal; dokumen ini menyelesaikannya ke arah yang lebih aman.

---

## 2. Konsekuensi SPA Terpisah: CSRF Menjadi Nyata

Keputusan Vite SPA + API Fastify terpisah (dokumen `01` §4.2) memindahkan autentikasi ke lintas origin. Ini menciptakan permukaan serang yang tidak ada pada aplikasi satu origin, dan blueprint belum menanganinya.

```
https://app.commercial2026.id     →  SPA statis (Caddy)
https://api.commercial2026.id     →  Fastify
```

| Ancaman | Penanganan |
|---|---|
| CSRF — situs lain memicu request dengan cookie pengguna | `SameSite=Strict` + token CSRF sinkronisasi ganda |
| CORS terlalu longgar | Origin **daftar putih eksplisit**. Tidak pernah `*`, tidak pernah pantulan header `Origin` |
| Kredensial lintas origin | `credentials: 'include'` di klien, `Access-Control-Allow-Credentials: true` di server |
| XSS mencuri token | Cookie `httpOnly` — JavaScript tidak dapat membacanya. **Token tidak pernah disimpan di `localStorage`** |

### 2.1 Konfigurasi Cookie

```
Set-Cookie: sid=<128-bit acak>;
            HttpOnly;
            Secure;
            SameSite=Strict;
            Path=/;
            Domain=commercial2026.id;
            Max-Age=43200
```

`SameSite=Strict`, bukan `Lax` seperti tertulis di dokumen `04` §4.2. `Lax` mengizinkan cookie ikut pada navigasi tingkat atas dari situs lain; `Strict` tidak. Tidak ada alur di sistem ini yang menuntut kelonggaran itu — tidak ada login lewat tautan surel, tidak ada OAuth pihak ketiga.

**Yang disimpan di basis data adalah hash, bukan token.** Kebocoran dump basis data tidak boleh memberi penyerang sesi yang dapat langsung dipakai:

```sql
ALTER TABLE sessions
  ADD COLUMN token_hash    bytea NOT NULL,   -- SHA-256 dari nilai cookie
  ADD COLUMN ip_address    inet,
  ADD COLUMN user_agent    text,
  ADD COLUMN device_label  text,
  ADD COLUMN mfa_satisfied boolean NOT NULL DEFAULT false,
  ADD COLUMN last_seen_at  timestamptz NOT NULL DEFAULT now();
```

### 2.2 Token CSRF Sinkronisasi Ganda

`SameSite=Strict` sudah menutup hampir seluruh CSRF, tapi pertahanan berlapis menuntut lapisan kedua yang tidak bergantung pada perilaku peramban:

1. Saat login, server menetapkan cookie kedua `csrf` — **tanpa** `httpOnly`, sehingga dapat dibaca JavaScript.
2. Setiap request yang mengubah state mengirim nilainya di header `X-CSRF-Token`.
3. Server menolak `403 CSRF_MISMATCH` kalau header tidak cocok dengan cookie.

Penyerang lintas origin tidak dapat membaca cookie `csrf` (dihalangi same-origin policy), sehingga tidak dapat menyusun header yang cocok.

---

## 3. Multi-Factor Authentication

### 3.1 Cakupan: Wajib untuk Sebagian, Opsional untuk Sisanya

MFA wajib untuk seluruh pengguna terdengar paling aman, dan biasanya berakhir dengan supplier lapangan yang tidak dapat masuk karena ponselnya berganti.

| Peran | MFA | Alasan |
|---|---|---|
| `admin` | **Wajib** | Memutuskan QC, mengelola pengguna. Akun paling bernilai |
| `operator` | **Wajib** | Akses panel operasional dan log |
| `manager` | Opsional, dianjurkan | Hanya baca, tapi melihat data agregat seluruh pelanggan |
| `supplier` | Opsional | Puluhan pengguna lapangan; pemaksaan menciptakan beban dukungan yang nyata |

Peran yang wajib MFA tidak dapat menyelesaikan login tanpa mendaftarkannya. Login pertama memaksa pendaftaran sebelum apa pun dapat diakses.

### 3.2 Metode: TOTP, Bukan SMS

| Metode | Putusan |
|---|---|
| **TOTP** (Google Authenticator, Authy) | ✅ **Dipilih.** Tanpa biaya, tanpa pihak ketiga, tahan SIM swap, berfungsi offline |
| SMS OTP | ❌ Rentan SIM swap, berbiaya, bergantung sinyal — buruk untuk pengguna lapangan |
| WhatsApp OTP | ❌ Masalah yang sama, ditambah ketergantungan pada penyedia berbayar |
| Passkey / WebAuthn | ⏸ Terkuat, tapi menuntut perangkat modern. Ditinjau setelah profil perangkat pengguna diketahui |

TOTP bekerja tanpa sinyal — pertimbangan yang menentukan, karena pekerjaan inti terjadi di garasi dan pool.

```sql
CREATE TABLE user_mfa (
  user_id       bigint PRIMARY KEY REFERENCES users(id),
  secret_enc    bytea NOT NULL,           -- dienkripsi, kunci di env
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mfa_recovery_codes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id),
  code_hash    bytea NOT NULL,            -- Argon2id, seperti kata sandi
  used_at      timestamptz
);
```

**Rahasia TOTP dienkripsi, tidak di-hash.** Server harus dapat membacanya untuk memverifikasi kode. Kuncinya berada di variabel lingkungan, tidak pernah di repositori — larangan yang sudah tertulis di `CLAUDE.md` (dokumen `09` §4.3).

### 3.3 Aturan Verifikasi

| Aspek | Ketentuan |
|---|---|
| Jendela toleransi | ±1 langkah (±30 detik). Lebih longgar memperlebar serangan brute force |
| Anti-replay | Kode yang sudah dipakai ditolak dalam jendelanya |
| Laju | 5 percobaan per 15 menit, lalu kunci seperti kata sandi |
| Kode pemulihan | 10 kode sekali pakai, ditampilkan sekali saat pendaftaran |
| Reset MFA | Hanya oleh `admin` lain, **tercatat di audit**, dan mencabut seluruh sesi |

Baris terakhir adalah lubang klasik: reset MFA yang dapat dilakukan sendiri lewat surel mengubah MFA menjadi teater keamanan, karena penyerang yang menguasai surel dapat melewatinya.

---

## 4. Step-Up: MFA Ulang untuk Aksi Berbahaya

Sesi 12 jam berarti perangkat yang tidak terkunci di garasi memberi akses selama 12 jam. Untuk sebagian aksi, itu terlalu longgar.

| Aksi | Perlu MFA ulang |
|---|---|
| Mengubah peran pengguna | ✅ |
| Menghapus atau menonaktifkan pengguna | ✅ |
| Reset MFA pengguna lain | ✅ |
| Mengubah kata sandi sendiri | ✅ |
| Aksi panel operasional yang mengubah state | ✅ |
| Keputusan QC | ❌ Terlalu sering; gesekan melebihi manfaat |
| Mengisi spesifikasi ban | ❌ |

Verifikasi ulang berlaku 15 menit. Ditandai pada baris sesi:

```sql
ALTER TABLE sessions ADD COLUMN elevated_until timestamptz;
```

Server menolak `403 STEP_UP_REQUIRED` bila aksi menuntut elevasi dan `elevated_until` sudah lewat. Klien menanggapinya dengan meminta kode TOTP, bukan dengan melempar pengguna keluar.

---

## 5. Manajemen Perangkat & Sesi

Halaman profil menampilkan seluruh sesi aktif — bagian yang mengubah keamanan dari sesuatu yang dijanjikan menjadi sesuatu yang dapat diperiksa pengguna sendiri.

| Kolom | Contoh |
|---|---|
| Perangkat | `Chrome di Android` |
| Lokasi perkiraan | `Bekasi, Jawa Barat` (dari IP) |
| Terakhir aktif | `3 menit lalu` |
| Aksi | **Akhiri sesi ini** |

Login dari perangkat yang belum pernah terlihat memancarkan `user.login_from_new_device` (dokumen `12` §5) — surel yang tidak dapat dimatikan. Ini pertahanan paling murah terhadap kredensial yang bocor: pengguna sendiri yang mendeteksinya.

**Sidik perangkat memakai kombinasi user agent + subnet IP, bukan sidik jari peramban.** Sidik jari yang lebih canggih menghasilkan positif palsu setiap pembaruan peramban, dan pengguna belajar mengabaikan peringatannya.

---

## 6. Pembatasan Laju di Luar Login

Dokumen `04` §4.3 membatasi laju login. Endpoint lain sama pentingnya:

| Endpoint | Batas | Alasan |
|---|---|---|
| `POST /auth/login` | 5 / 15 mnt / akun; 20 / 15 mnt / IP | dokumen `04` |
| `POST /auth/mfa/verify` | 5 / 15 mnt / akun | Brute force kode 6 digit |
| `POST /auth/password/reset` | 3 / jam / akun | Enumerasi akun |
| `GET /vehicles/search` | 60 / mnt / pengguna | **Enumerasi armada** — lihat `Q-12` |
| Presigned URL unggah | 100 / mnt / pengguna | Penyalahgunaan penyimpanan |
| Seluruh endpoint | 300 / mnt / pengguna | Jaring pengaman |

Baris `vehicles/search` yang paling mudah terlewat. Endpoint pencarian kendaraan (dokumen `11` §6) mengubah sistem menjadi alat yang dapat menjawab "apakah plat X terdaftar" — dan tanpa pembatasan laju, seluruh basis data armada pelanggan dapat dipetakan dari luar.

---

## 7. Header Keamanan

Disajikan Caddy untuk SPA, dan Fastify untuk API.

| Header | Nilai | Menutup |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' https://<r2-domain> data:; connect-src 'self' https://api.commercial2026.id https://<r2-domain>; object-src 'none'; frame-ancestors 'none'; base-uri 'self'` | XSS, injeksi |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Penurunan ke HTTP |
| `X-Content-Type-Options` | `nosniff` | Kebingungan tipe MIME |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Kebocoran URL |
| `Permissions-Policy` | `camera=(self), geolocation=(), microphone=()` | Kamera diizinkan (unggah foto); sisanya ditolak |

`frame-ancestors 'none'` layak dicatat: sistem berjalan hidup **di dalam** iframe sandbox Apps Script (`B-07`). Sistem target menolak dimuat dalam frame mana pun.

CSP tanpa `unsafe-inline` menuntut Vite dikonfigurasi tanpa gaya dan skrip inline. Ini lebih mudah dilakukan sejak awal daripada diperbaiki setelah ratusan komponen ditulis — dan karena itu masuk **F0**, bukan F7.

---

## 8. Perlindungan Kredensial

| Aspek | Ketentuan |
|---|---|
| Hash kata sandi | Argon2id sesuai dokumen `04` §4.1 |
| Rahasia TOTP | Terenkripsi, kunci di variabel lingkungan |
| Token sesi | Hanya hash yang disimpan |
| Kode pemulihan | Argon2id, seperti kata sandi |
| Kredensial di kode | **Diblokir hook** (dokumen `09` §4.5) |
| Kata sandi bocor | Dicek terhadap Have I Been Pwned lewat *k-anonymity* saat pembuatan |
| Log | **Tidak pernah** memuat kata sandi, token, atau rahasia TOTP — termasuk pada log error |

Baris terakhir menuntut penyaring pada `pino`. Objek request yang di-log secara utuh adalah cara paling umum kredensial berakhir di berkas log — dan log dikirim ke pihak ketiga (dokumen `01` §8).

---

## 9. Audit Autentikasi

Peristiwa berikut masuk `audit_log` (dokumen `04` §6), dan **tidak dapat dimatikan**:

| Peristiwa | Dicatat |
|---|---|
| Login berhasil | pengguna, IP, perangkat, MFA terpenuhi? |
| Login gagal | username yang dicoba, IP, alasan |
| Akun terkunci | pengguna, ambang yang terlampaui |
| MFA didaftarkan / diatur ulang | pengguna, oleh siapa |
| Kode pemulihan dipakai | pengguna, sisa kode |
| Step-up berhasil / gagal | pengguna, aksi yang dituju |
| Sesi dicabut | pengguna, oleh siapa, alasan |
| Peran diubah | pengguna, dari, ke, oleh siapa |
| Kata sandi diubah / direset | pengguna, oleh siapa |

Operator dapat membaca log ini (`audit.read`, dokumen `04` §2.1) tapi tidak dapat mengubahnya. `audit_log` tidak menerima `UPDATE` maupun `DELETE` dari peran mana pun — ditegakkan lewat pencabutan hak di tingkat PostgreSQL, bukan lewat konvensi aplikasi.

---

## 10. Dampak ke Dokumen Lain

| Dokumen | Perubahan |
|---|---|
| `01` | **Baris JWT dicabut.** Sesi opaque di server, sesuai §1.1 |
| `02` | `user_mfa`, `mfa_recovery_codes`. Kolom baru pada `sessions`. Pencabutan hak `UPDATE`/`DELETE` atas `audit_log` |
| `04` | `SameSite=Lax` → `Strict`. Bagian MFA, step-up, manajemen perangkat |
| `05` | Kode error `CSRF_MISMATCH`, `MFA_REQUIRED`, `STEP_UP_REQUIRED`, `RATE_LIMITED` |
| `08` | F1 bertambah MFA + CSRF + header. Perkirakan **+1 minggu** implementasi dan verifikasi |
| `09` | Uji baru: CSRF ditolak, MFA dipaksa untuk admin, step-up kedaluwarsa, laju terbatas |
| `12` | `user.login_from_new_device` termasuk yang tidak dapat dimatikan |

---

## 11. Ringkasan Keputusan

| # | Keputusan | Status |
|---|---|---|
| A-01 | Sesi opaque di server, **bukan JWT** | Mengikat — menyelesaikan kontradiksi `01` vs `04` |
| A-02 | `SameSite=Strict` + token CSRF sinkronisasi ganda | Mengikat |
| A-03 | TOTP wajib untuk `admin` dan `operator`, opsional untuk sisanya | Dianjurkan |
| A-04 | Step-up 15 menit untuk aksi berbahaya | Dianjurkan |
| A-05 | Manajemen perangkat + peringatan perangkat baru | Dianjurkan |
| A-06 | Pembatasan laju mencakup `vehicles/search` | Mengikat — konsekuensi dokumen `11` |
| A-07 | CSP tanpa `unsafe-inline` sejak F0 | Mengikat |
| A-08 | `audit_log` tanpa `UPDATE`/`DELETE` di tingkat basis data | Mengikat |
| A-09 | Passkey/WebAuthn ditinjau ulang setelah profil perangkat diketahui | Ditunda |
