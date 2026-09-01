# 05 — Kontrak API & Penanganan Error

**Prasyarat:** dokumen `01`, `02`, `03`, `04`
**Menutup:** `D-07`, `D-08`, `D-09`, dan menyelesaikan Bagian 14 audit

---

## 1. Pembalikan atas Bagian 14 Audit

Bagian 14 audit menyimpulkan bahwa "HTTP response" untuk sistem ini terpaksa berarti **envelope bergaya HTTP** — struktur data yang meniru kontrak HTTP, karena Apps Script tidak mampu menghasilkan status code sungguhan:

| Batas | Konsekuensi di Apps Script |
|---|---|
| `B-01` — `google.script.run` bukan HTTP | Tidak ada status code yang bisa dibaca klien |
| `B-02` — `ContentService` selalu membalas `200 OK` | Tidak ada cara mengembalikan `400`/`403`/`500` |

**Keputusan tulis-ulang menghapus keduanya.** Dengan API Fastify yang berdiri sendiri, `403 FORBIDDEN_ROLE` adalah HTTP 403 yang sesungguhnya — terbaca oleh peramban, oleh Sentry, oleh monitoring uptime, dan oleh uji otomatis tanpa perantara apa pun. Envelope pada dokumen ini karena itu **melengkapi** status code HTTP, bukan menggantikannya seperti yang terpaksa dilakukan di Apps Script (`B-01`, `B-02`).

Karena itu dokumen ini mengambil seluruh isi Bagian 14 audit — peta status code, kanal tampilan error, kriteria penerimaan — dan **menaikkannya dari simulasi menjadi kontrak nyata**. Rancangan aslinya tetap benar; yang berubah adalah ia tidak lagi perlu berpura-pura.

---

## 2. Bentuk Response

Setiap endpoint mengembalikan salah satu dari dua bentuk. Tidak ada bentuk ketiga.

```jsonc
// SUKSES — HTTP 200 atau 201
{
  "ok": true,
  "data": { "serialNumber": "SN2026-00002", "id": 1042 },
  "requestId": "req_20260901_143022_a91f"
}

// GAGAL VALIDASI — HTTP 422
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Beberapa isian belum lengkap atau tidak valid.",
  "errors": [
    { "field": "plateNumber", "code": "INVALID_FORMAT", "message": "Plat nomor hanya boleh berisi huruf dan angka." },
    { "field": "cityId",      "code": "REQUIRED",       "message": "Kota wajib dipilih." },
    { "field": "axleConfigs", "code": "AXLE_SUM_MISMATCH",
      "message": "Rincian poros berjumlah 3, sedangkan Jumlah Poros yang dipilih adalah 6." }
  ],
  "requestId": "req_20260901_143022_a91f"
}

// GAGAL SISTEM — HTTP 500
{
  "ok": false,
  "code": "INTERNAL_ERROR",
  "message": "Terjadi kesalahan pada sistem. Silakan coba lagi atau laporkan kode berikut ke admin.",
  "requestId": "req_20260901_143022_a91f"
}
```

| Field | Ada saat | Keterangan |
|---|---|---|
| `ok` | selalu | Penanda cepat |
| `data` | `ok: true` | Payload |
| `code` | `ok: false` | `SCREAMING_SNAKE_CASE`, dapat dibaca mesin |
| `message` | `ok: false` | **Bahasa Indonesia**, siap ditampilkan apa adanya |
| `errors` | hanya `VALIDATION_ERROR` | Error per field |
| `requestId` | selalu | Tali penghubung UI ↔ log ↔ Sentry ↔ `audit_logs` |

Field `status` yang ada di rancangan audit **dihapus dari body**. Status code kini ada di tempat semestinya — di header HTTP — dan menduplikasinya di body hanya menciptakan dua sumber kebenaran yang bisa berselisih.

Contoh `AXLE_SUM_MISMATCH` di atas adalah `D-04` yang akhirnya bersuara. Hari ini, konfigurasi itu diterima diam-diam dan menghasilkan 10 slot ban yang salah.

---

## 3. Peta Status Code

| HTTP | `code` | Dipakai saat | Kanal tampilan |
|---:|---|---|---|
| 200 | — | Aksi berhasil | Toast hijau |
| 201 | — | Sumber daya dibuat | Toast hijau + tampilkan Serial Number |
| 400 | `BAD_REQUEST` | Payload rusak / tidak dapat diurai | Banner |
| 401 | `INVALID_CREDENTIALS` | Login gagal | Banner di kartu login |
| 401 | `SESSION_EXPIRED` | Sesi habis atau dicabut | Banner + alihkan ke login |
| 403 | `FORBIDDEN_ROLE` | Peran tidak berwenang (dok `04` §2.2) | Banner |
| 404 | `NOT_FOUND` | Tidak ada, **atau di luar cakupan pengguna** | Banner |
| 409 | `DUPLICATE_PLATE` | `uq_locking_inspection` (V-08) | Inline di field Plat Nomor. Pesan menyebut Serial Number dan status yang mengunci, mis. *"Kendaraan ini sedang dalam pemeriksaan SN2026-0042 (Menunggu QC)."* |
| 409 | `DUPLICATE_USERNAME` | Username sudah dipakai | Inline di field User ID |
| 409 | `INVALID_STATE_TRANSITION` | Transisi status tak sah (dok `03` §7.1) | Banner |
| 409 | `CONCURRENT_MODIFICATION` | Data diubah orang lain sejak dimuat | Banner + tawaran muat ulang |
| 413 | `FILE_TOO_LARGE` | Foto melebihi batas | Inline di slot unggah |
| 415 | `UNSUPPORTED_FILE_TYPE` | Berkas bukan gambar yang didukung | Inline di slot unggah |
| 422 | `VALIDATION_ERROR` | Satu atau lebih field tidak valid | Inline per field + banner ringkasan |
| 423 | `ACCOUNT_LOCKED` | Terkunci karena percobaan berulang (dok `04` §4.3) | Banner di kartu login |
| 429 | `RATE_LIMITED` | Batas laju terlampaui | Banner |
| 500 | `INTERNAL_ERROR` | Exception tak terduga | Banner + `requestId` |
| 503 | `SERVICE_UNAVAILABLE` | Basis data atau R2 tidak dapat dijangkau | Banner + saran coba lagi |

`404` untuk sumber daya di luar cakupan adalah keputusan sadar, bukan kelalaian — alasannya di dokumen `04` §2.2.

---

## 4. Aturan Sisi Server

1. **Satu pembungkus untuk semua handler.** Tidak ada rute yang menulis `try/catch`-nya sendiri; pembungkus menangkap semuanya, memetakan ke `code`, dan membentuk envelope.
2. **Exception mentah tidak pernah sampai ke peramban.** Stack trace masuk Pino dan Sentry bersama `requestId`; pengguna hanya menerima kalimat ramah dan `requestId` itu.
3. **`requestId` dibuat di awal request** dan mengalir ke seluruh log, ke `audit_logs.request_id`, dan ke response — sukses maupun gagal.
4. **Seluruh validasi dijalankan di server dengan skema Zod yang sama seperti di klien.** Ini menutup `D-07` secara struktural: bukan karena disiplin, tapi karena hanya ada satu skema.
5. **Seluruh error validasi dikumpulkan sekaligus.** Zod melakukannya secara bawaan. Berhenti di error pertama memaksa pengguna mengirim berulang kali — pada formulir supplier yang punya belasan field, itu menyiksa.
6. **Error basis data diterjemahkan, bukan dibocorkan.** Pelanggaran constraint punya pemetaan tetap:

| Constraint | Menjadi |
|---|---|
| `uq_locking_inspection` | `409 DUPLICATE_PLATE` |
| `uq_users_username_active` | `409 DUPLICATE_USERNAME` |
| `ck_plate_format` | `422` + error field `plateNumber` |
| `ck_lt_not_bus` | `422` + error field `segment` |
| `AXLE_SUM_MISMATCH` (trigger) | `422` + error field `axleConfigs` |
| `PHOTO_LIMIT_EXCEEDED` (trigger) | `422` + error field slot terkait |
| Lainnya | `500 INTERNAL_ERROR` |

Baris terakhir penting: constraint yang belum dipetakan menjadi `500`, bukan pesan basis data yang bocor ke pengguna.

---

## 5. Aturan Sisi Klien

### 5.1 Tiga Kanal, Dipilih Berdasarkan Jenis Error

| Kanal | Untuk | Perilaku |
|---|---|---|
| **Inline di bawah field** | `422`, `409` duplikat, `413`, `415` | Teks merah + border merah. Hilang saat field diubah |
| **Banner di atas konten** | Seluruh error tingkat halaman | Kotak merah dengan tombol tutup. **Memakai ulang komponen yang sudah benar** di sistem berjalan (`K-08`) |
| **Toast** | Sukses `200`/`201` | Kotak hijau, hilang otomatis setelah 4 detik |

Pola banner login (`"User ID atau Password salah!"`) adalah satu-satunya penanganan error yang sudah benar di sistem berjalan. Ia dinaikkan menjadi standar, bukan diganti.

### 5.2 Aturan Wajib

1. **`alert()`, `confirm()`, dan `prompt()` tidak ada di seluruh kode.** Diperiksa lint, bukan diingat.
2. **`novalidate` pada setiap `<form>`.** Ini menghapus tooltip `"Please fill out this field."` berbahasa Inggris (`D-07`) dan menyerahkan seluruh validasi ke skema Zod yang sama dengan server.
3. **Tombol masuk state loading** — nonaktif + spinner — selama request berjalan. Menutup double-submit sekaligus memberi tahu pengguna sistem sedang bekerja.
4. **Gulir dan fokus otomatis** ke field pertama yang error.
5. **Tombol export tidak boleh bisu** (`D-09`). Alurnya: klik → toast "Menyiapkan berkas…" → job selesai → toast dengan tautan unduh.
6. **Kegagalan jaringan menjadi banner `503`**, bukan kegagalan senyap.
7. **`requestId` ditampilkan pada setiap error `500`** dalam teks kecil yang dapat disalin, dengan kalimat "sebutkan kode ini saat melapor".

---

## 6. Katalog Endpoint

Ringkasan; bukan spesifikasi OpenAPI lengkap.

### Autentikasi
| Metode | Rute | Peran |
|---|---|---|
| `POST` | `/api/auth/login` | publik |
| `POST` | `/api/auth/logout` | terautentikasi |
| `POST` | `/api/auth/change-password` | terautentikasi |
| `GET` | `/api/auth/me` | terautentikasi |

### Pengajuan
| Metode | Rute | Peran |
|---|---|---|
| `GET` | `/api/submissions` | semua *(dicakup peran)* |
| `POST` | `/api/submissions` | supplier |
| `GET` | `/api/submissions/:sn` | semua *(dicakup)* |
| `PATCH` | `/api/submissions/:sn` | supplier *(draft/revisi)* |
| `POST` | `/api/submissions/:sn/submit` | supplier |
| `POST` | `/api/submissions/preview-positions` | supplier |

`preview-positions` menjalankan `derivePositions()` di server dan mengembalikan daftar posisi ban. Klien boleh menghitung sendiri untuk responsivitas, tapi **server yang memutuskan** (V-06). Ini yang menjaga `K-01` tetap punya satu sumber kebenaran.

### Foto
| Metode | Rute | Peran |
|---|---|---|
| `POST` | `/api/submissions/:sn/photos/presign` | supplier |
| `POST` | `/api/submissions/:sn/photos/confirm` | supplier |
| `DELETE` | `/api/photos/:id` | supplier *(miliknya)*, admin |

### QC
| Metode | Rute | Peran |
|---|---|---|
| `GET` | `/api/qc/queue` | admin |
| `GET` | `/api/qc/stats` | admin |
| `POST` | `/api/qc/:sn/decide` | admin |
| `POST` | `/api/qc/:sn/revert` | admin |

`/api/qc/queue` adalah tabel antrean kerja yang menutup `D-02`, dengan filter yang benar-benar diteruskan ke query — menutup `D-01`.

### Spesifikasi Ban, Pelaporan, Master Data, Pengguna, Audit
| Metode | Rute | Peran |
|---|---|---|
| `GET` / `PUT` | `/api/submissions/:sn/tire-specs` | admin |
| `GET` | `/api/reports/region-progress` | admin, manager |
| `POST` | `/api/reports/export` | admin, manager |
| `GET` | `/api/exports/:jobId` | pemilik job |
| `GET`/`POST`/`PATCH` | `/api/masterdata/{provinces,cities,vehicle-brands,tire-brands}` | admin |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/users` | admin |
| `POST` | `/api/users/:id/reset-password` | admin |
| `GET` | `/api/audit` | admin |
| `GET` | `/api/health` | publik |

---

## 7. Protokol Unggah Foto

Foto **tidak pernah** melewati server aplikasi. Pada 18.000 foto per bulan, memproksikannya membuang bandwidth dan memori tanpa memberi apa pun.

```
Klien                    Server                     Cloudflare R2
  │                        │                              │
  │─ presign ─────────────►│                              │
  │  (slot, ukuran, mime,  │  validasi: kepemilikan,       │
  │   checksum sha256)     │  status, batas 10/slot,      │
  │                        │  ukuran, tipe                │
  │◄─ URL + storageKey ────│                              │
  │                        │                              │
  │─ PUT langsung ────────────────────────────────────────►│
  │                        │                              │
  │─ confirm ─────────────►│                              │
  │                        │─ HEAD verifikasi objek ──────►│
  │                        │  sisip baris `photos`         │
  │◄─ 201 + photoId ───────│                              │
```

| Aturan | Nilai |
|---|---|
| Ukuran maksimum per berkas | 5 MB *(setelah kompresi klien; lihat dokumen `06`)* |
| Tipe yang diterima | `image/webp`, `image/jpeg` |
| Masa berlaku URL presign | 10 menit |
| Batas per slot | 10 (`K-06`, ditegakkan `trg_photo_limit`) |
| Deduplikasi | `checksum_sha256` — unggahan ulang dari antrean offline tidak menghasilkan duplikat |

Objek yang terunggah ke R2 tapi tidak pernah dikonfirmasi menjadi sampah. Job pembersih harian menghapus objek yang lebih tua dari 24 jam dan tidak punya baris `photos` yang cocok.

---

## 8. Pekerjaan Latar

Dijalankan proses `worker` (dokumen `01` §5), bukan di dalam request.

| Job | Pemicu | Alasan diasinkronkan |
|---|---|---|
| `export.excel` | `POST /api/reports/export` | Puluhan ribu baris; melampaui anggaran waktu request |
| `photo.postprocess` | Setelah `confirm` | Pembuatan thumbnail |
| `photo.gc` | Harian | Objek R2 yatim |
| `mv.refresh` | Tiap 10 menit | `mv_region_progress` |
| `metrics.daily` | Harian | Isi `daily_metrics` |
| `backup.pgdump` | Harian 02.00 WIB | Dokumen `01` §5.2 |

**Kontrak export** menutup `D-09` sepenuhnya:

```
POST /api/reports/export  →  202 { jobId, statusUrl }
GET  /api/exports/:jobId  →  200 { status: 'queued' | 'running' | 'done' | 'failed',
                                   downloadUrl?, error? }
```

Klien melakukan polling tiap 2 detik dan menampilkan progres. Bandingkan dengan sistem berjalan, yang mengklik tombol export lalu tidak memberikan apa pun — tidak spinner, tidak notifikasi, tidak tab baru.

---

## 9. Kriteria Penerimaan

Diadaptasi dari Bagian 14.8 audit, disesuaikan karena HTTP kini nyata.

- [ ] `alert(`, `confirm(`, dan `prompt(` mengembalikan **nol hasil** pada pencarian teks di seluruh kode.
- [ ] Setiap handler API mengembalikan salah satu dari dua bentuk di §2. Diperiksa uji kontrak yang menembak seluruh rute.
- [ ] Tidak ada stack trace atau pesan basis data mentah yang sampai ke peramban. Diuji dengan sengaja melanggar setiap constraint di §4 poin 6.
- [ ] Setiap field wajib punya pesan error inline **berbahasa Indonesia**; tooltip bawaan peramban tidak pernah muncul.
- [ ] Setiap error tingkat halaman muncul sebagai banner yang dapat ditutup.
- [ ] Setiap aksi berhasil menampilkan toast.
- [ ] Setiap tombol submit dan export punya state loading.
- [ ] Setiap error `500` menampilkan `requestId` yang identik dengan yang ada di Sentry dan di log Pino.
- [ ] Validasi server diverifikasi **dengan mengirim payload yang mem-bypass formulir sepenuhnya** — bukan lewat UI.
- [ ] Uji Playwright menangkap setiap kanal error. Tidak ada lagi kegagalan tak terlihat seperti yang ditemukan pada penelusuran (`D-08`).
