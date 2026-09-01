# 12 — Antrean, Outbox & Notifikasi

**Prasyarat:** `01` (pg-boss), `02` (skema), `05` (envelope)
**Menutup:** `D-09` sepenuhnya, dan memberi `D-10` mekanisme penyampaiannya
**Menambah:** tabel `outbox`, `notifications`, `notification_preferences`

---

## 1. Dua Hal yang Sering Disamakan

Antrean dan notifikasi sering dibicarakan sebagai satu paket. Keduanya berbeda, dan mencampurnya menghasilkan sistem yang mengirim surel untuk transaksi yang gagal.

| | Antrean | Notifikasi |
|---|---|---|
| Pertanyaan yang dijawab | *Kapan pekerjaan ini dikerjakan?* | *Siapa yang perlu tahu, dan lewat apa?* |
| Kegagalan berarti | Pekerjaan terlambat | Orang tidak tahu |
| Sudah ada di blueprint | ✅ pg-boss, dokumen `01` §6 | ❌ belum sama sekali |

Notifikasi **memakai** antrean, tapi ia bukan antrean. Yang menyambungkan keduanya dengan benar adalah outbox — bagian tersulit dan paling sering dilewatkan dari dokumen ini.

---

## 2. Masalah Ganda-Tulis

Bentuk naif yang harus dihindari:

```ts
// ❌ SALAH — dua sistem, satu tanpa transaksi
await db.inspection.update({ where: { id }, data: { status: 'passed_qc' } });
await kirimEmail(supplier.email, "Pemeriksaan Anda lolos QC");
```

Dua cara ini gagal, dan keduanya terjadi di sistem nyata:

| Kegagalan | Akibat |
|---|---|
| Transaksi commit, pengiriman surel error | Status berubah, supplier tidak pernah tahu. **Kegagalan senyap** — persis `D-08` dalam bentuk lain |
| Surel terkirim, transaksi rollback | Supplier diberi tahu tentang sesuatu yang tidak terjadi. Lebih buruk lagi: **tidak dapat ditarik kembali** |

Baris kedua tidak dapat diperbaiki dengan retry, log, atau monitoring. Satu-satunya perbaikannya adalah struktural.

### 2.1 Outbox Transaksional

Peristiwa ditulis ke tabel **di dalam transaksi yang sama** dengan perubahan datanya. Pengiriman terjadi belakangan, dari tabel itu.

```
┌─ TRANSAKSI ─────────────────────────────────┐
│  UPDATE inspections SET status='passed_qc'  │
│  INSERT INTO audit_log (...)                │
│  INSERT INTO outbox (event_type, payload)   │  ← atomik bersama
└─────────────────────────────────────────────┘
                    │ commit
                    ▼
        pg-boss memungut dari outbox
                    ▼
        Menyusun notifikasi per penerima
                    ▼
        Mengirim per kanal, dengan retry
```

Kalau transaksi rollback, baris outbox ikut hilang — notifikasi untuk peristiwa yang tidak terjadi menjadi **mustahil**, bukan sekadar jarang. Kalau commit berhasil tapi pengiriman gagal, barisnya tetap ada dan akan dicoba lagi. Ini menukar "mungkin hilang, mungkin palsu" menjadi "pasti terkirim, mungkin terlambat" — pertukaran yang benar.

> pg-boss dipilih di dokumen `01` justru karena ini. Ia berjalan di atas PostgreSQL yang sama, sehingga **enqueue dapat ikut dalam transaksi data**. Redis + BullMQ tidak bisa melakukannya tanpa outbox terpisah, dan itulah alasan sesungguhnya di balik pilihan tersebut.

---

## 3. Skema

```sql
CREATE TABLE outbox (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type    text NOT NULL,          -- 'inspection.passed_qc'
  aggregate_id  bigint NOT NULL,
  payload       jsonb NOT NULL,
  actor_id      bigint REFERENCES users(id),
  request_id    text NOT NULL,          -- korelasi ke log, dokumen 05
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX idx_outbox_pending ON outbox(created_at) WHERE processed_at IS NULL;

CREATE TABLE notifications (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id      bigint REFERENCES outbox(id),
  recipient_id   bigint NOT NULL REFERENCES users(id),
  channel        notification_channel NOT NULL,
  template       text NOT NULL,
  payload        jsonb NOT NULL,
  status         notification_status NOT NULL DEFAULT 'pending',
  attempts       int NOT NULL DEFAULT 0,
  last_error     text,
  read_at        timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Idempotensi: satu peristiwa, satu penerima, satu kanal — sekali saja
  CONSTRAINT uq_notif UNIQUE (outbox_id, recipient_id, channel)
);

CREATE INDEX idx_notif_inbox ON notifications(recipient_id, created_at DESC)
  WHERE channel = 'in_app';
CREATE INDEX idx_notif_unread ON notifications(recipient_id)
  WHERE channel = 'in_app' AND read_at IS NULL;

CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'whatsapp');
CREATE TYPE notification_status  AS ENUM ('pending', 'sent', 'failed', 'suppressed');
```

`uq_notif` adalah penjagaan yang paling sering diperlukan. Worker yang di-retry setelah timeout akan mencoba menyisipkan baris yang sama; constraint menolaknya, dan pengguna tidak menerima notifikasi ganda. **Idempotensi ditegakkan basis data, bukan disiplin kode** — konsisten dengan prinsip dokumen `02` §1.

---

## 4. Kanal

### 4.1 Pilihan dan Urutannya

| Kanal | Fase | Biaya | Alasan |
|---|---|---|---|
| **In-app** | F2 | Nol | Selalu berhasil, tidak butuh pihak ketiga, tidak bisa masuk spam. Baseline |
| **Email** | F4 | ~$0 pada volume ini | Tahan lama, dapat diarsipkan, bukti tertulis |
| **WhatsApp** | F7+ | Berbayar, butuh persetujuan Meta | Kanal yang benar-benar dibaca di Indonesia — dan yang paling mahal |
| **Web Push** | tidak dijadwalkan | Nol | PWA sudah ada, tapi iOS membatasi keras. Ditinjau setelah data pemakaian nyata |

**In-app lebih dulu, dan itu bukan sekadar penghematan.** Kanal in-app menyimpan seluruh riwayat notifikasi di sistem sendiri, dapat diuji otomatis, dan tidak pernah gagal karena alasan di luar kendali. Email dan WhatsApp adalah **peningkatan jangkauan** di atas dasar itu, bukan penggantinya. Notifikasi yang hanya dikirim lewat surel dan gagal terkirim menjadi notifikasi yang tidak pernah ada.

### 4.2 WhatsApp: Peringatan yang Perlu Dinyatakan Sekarang

WhatsApp adalah kanal yang paling mungkin Anda inginkan, dan yang paling mudah salah direncanakan:

- Memerlukan **WhatsApp Business API** lewat penyedia resmi, bukan WhatsApp biasa. Otomasi lewat akun personal melanggar ketentuan layanan dan berujung pemblokiran nomor.
- Pesan di luar jendela 24 jam wajib memakai **template yang disetujui terlebih dahulu**. Notifikasi sistem hampir selalu di luar jendela itu.
- Berbayar per percakapan.
- Nomor telepon menjadi data pribadi yang harus dikelola dan dilindungi — field yang bahkan belum ada di tabel `users` hari ini.

Karena itu ia ditempatkan di F7+ dan di belakang antarmuka `PengirimNotifikasi` (§6), sehingga penambahannya kelak tidak menyentuh satu pun kode domain.

---

## 5. Katalog Peristiwa

Kolom terakhir yang paling penting: notifikasi yang tidak mengubah tindakan siapa pun adalah kebisingan, dan kebisingan membuat notifikasi penting ikut diabaikan.

| Peristiwa | Penerima | Kanal | Mengapa ia layak mengganggu |
|---|---|---|---|
| `inspection.submitted` | Admin QC | in-app | Ada pekerjaan baru di antrean |
| `inspection.passed_qc` | Supplier pengirim | in-app + email | **Menutup `D-10`** — hari ini supplier buta total |
| `inspection.dropped_qc` | Supplier pengirim | in-app + email | Idem, dan memuat alasan penolakan |
| `inspection.needs_revision` | Supplier pengirim | in-app + email + WA | **Menuntut tindakan.** Menutup `D-11` |
| `inspection.resubmitted` | Admin QC | in-app | Pekerjaan kembali ke antrean |
| `export.ready` | Peminta | in-app | **Menutup `D-09`** — export hari ini benar-benar bisu |
| `export.failed` | Peminta | in-app | Idem |
| `user.password_reset` | Pengguna | email | Kredensial sekali pakai |
| `user.login_from_new_device` | Pengguna | email | Keamanan — lihat dokumen `13` |
| `job.repeatedly_failed` | **Operator** | in-app + email | Dokumen `10` §3 |
| `storage.threshold_exceeded` | **Operator** | in-app + email | Peringatan dini biaya |

**Yang sengaja tidak dinotifikasi:**

| Tidak dinotifikasi | Alasan |
|---|---|
| Setiap foto selesai diunggah | Puluhan per pengajuan. Cukup progres di layar |
| Spesifikasi ban disimpan | Admin sendiri yang melakukannya |
| Dashboard diperbarui | Tidak ada yang menunggu |
| Setiap pengajuan masuk, ke manajer | Manajer memantau agregat, bukan peristiwa |

### 5.1 Aturan Peredaman

Tanpa peredaman, `job.repeatedly_failed` pada gangguan penyimpanan akan mengirim ratusan surel dalam beberapa menit — dan operator akan mematikan notifikasinya, tepat sebelum kejadian yang benar-benar penting.

| Aturan | Ketentuan |
|---|---|
| Peristiwa sistem yang sama | Maksimum 1 per 15 menit per penerima; sisanya diringkas |
| Notifikasi in-app | Tidak pernah diredam. Murah dan tidak mengganggu |
| Jam kirim email & WA | 07.00–20.00 WIB. Di luar itu, diantre sampai pagi |
| Kecuali | `user.password_reset` dan peringatan keamanan — dikirim seketika |

---

## 6. Antarmuka Pengiriman

Satu antarmuka, banyak implementasi. Kode domain tidak pernah tahu kanal apa yang dipakai.

```ts
// kernel/notifikasi/pengirim.ts
export interface PengirimNotifikasi {
  readonly channel: NotificationChannel;
  kirim(n: Notification): Promise<HasilKirim>;
}

export type HasilKirim =
  | { ok: true;  externalId?: string }
  | { ok: false; retryable: boolean; error: string };
```

`retryable` adalah field yang menentukan. Tanpanya, worker akan mencoba ulang alamat surel yang tidak valid sebanyak lima kali, lalu memarkirnya di dead letter, lalu membuat operator menyelidiki sesuatu yang tidak akan pernah berhasil.

| Kegagalan | `retryable` | Tindakan |
|---|---|---|
| Penyedia surel timeout | `true` | Backoff eksponensial, maks 5 percobaan |
| Alamat surel tidak valid | `false` | `failed` seketika, tandai kontak pengguna |
| Template WA belum disetujui | `false` | `failed`, beri tahu operator |
| Kuota penyedia habis | `true` | Backoff panjang |
| Pengguna nonaktif | — | `suppressed`, tanpa percobaan |

---

## 7. Katalog Pekerjaan Antrean

Memperluas dokumen `01` §6 dari empat menjadi delapan pekerjaan.

| Pekerjaan | Pemicu | Retry | Catatan |
|---|---|---|---|
| `outbox.pungut` | tiap 5 detik | — | Membaca outbox, menyusun notifikasi |
| `notifikasi.kirim` | per notifikasi | 5×, backoff eksponensial | Idempoten lewat `uq_notif` |
| `buat-thumbnail` | foto terunggah | 3× | dokumen `01` |
| `susun-export` | Admin klik Export | 2× | Memancarkan `export.ready` / `export.failed` |
| `bersihkan-unggahan-terlantar` | harian 02.00 | 1× | dokumen `01` |
| `ringkas-pelaporan` | tiap 10 menit | 1× | Menyegarkan materialized view |
| `arsip-notifikasi` | mingguan | 1× | Pindahkan in-app > 90 hari |
| `pantau-kesehatan-antrean` | tiap 5 menit | — | Memancarkan `job.repeatedly_failed` |

### 7.1 Ambang Peringatan

| Sinyal | Ambang | Tindakan |
|---|---|---|
| Kedalaman antrean | > 500 selama 10 menit | Peringatan ke operator |
| Usia outbox tertua yang belum diproses | > 5 menit | **Peringatan kritis** — outbox macet berarti notifikasi berhenti diam-diam |
| Pekerjaan gagal 24 jam terakhir | > 20 | Peringatan ke operator |
| Isi dead letter | > 0 | Peringatan harian |

Baris kedua yang paling penting dan paling mudah terlewat. Outbox yang berhenti diproses tidak menghasilkan error apa pun — sistem tampak sehat, sementara tidak ada seorang pun menerima kabar. Ini bentuk `D-08` di tingkat infrastruktur, dan satu-satunya cara menangkapnya adalah memantau **usia entri tertua**, bukan jumlahnya.

---

## 8. Preferensi Pengguna

```sql
CREATE TABLE notification_preferences (
  user_id     bigint NOT NULL REFERENCES users(id),
  event_type  text   NOT NULL,
  channel     notification_channel NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, event_type, channel)
);
```

| Aturan | Ketentuan |
|---|---|
| Default | Seluruh kanal aktif untuk peristiwa yang relevan dengan peran |
| Tidak dapat dimatikan | `user.password_reset`, peringatan keamanan, `inspection.needs_revision` |
| In-app | Tidak pernah dapat dimatikan. Ia arsip, bukan gangguan |
| Berhenti berlangganan | Setiap surel memuat tautan yang mematikan kanal surel untuk jenis peristiwa itu saja |

`inspection.needs_revision` masuk daftar yang tidak dapat dimatikan karena ia satu-satunya notifikasi yang **menuntut tindakan supplier**. Kalau ia dapat dibisukan, `D-11` kembali dalam bentuk baru: pengajuan tergantung selamanya karena tidak ada yang tahu ia perlu diperbaiki.

---

## 9. Dampak ke Dokumen Lain

| Dokumen | Perubahan |
|---|---|
| `01` | Katalog pekerjaan 4 → 8. Penyedia surel masuk daftar dependensi eksternal |
| `02` | Tabel `outbox`, `notifications`, `notification_preferences`. Kolom `email` dan `phone` pada `users` |
| `04` | Izin baru `notification.read.own`, `notification.preferences.manage` |
| `05` | Endpoint kotak masuk, tandai terbaca, preferensi |
| `10` | Panel operasional bertambah: kesehatan outbox, kirim ulang notifikasi gagal |
| `11` | Peristiwa `vehicle.duplicate_suspected` kalau Q-12 dijawab opsi (c) |

> **Q-13 (baru):** apakah `users` memiliki alamat surel? Tabel hari ini tidak punya kolom itu, dan sistem berjalan tidak pernah mengumpulkannya (dokumen `00` §4.3). Tanpa surel, kanal email tidak dapat dibangun sama sekali — dan pengumpulannya untuk pengguna lama adalah pekerjaan manual.

---

## 10. Ringkasan Keputusan

| # | Keputusan | Status |
|---|---|---|
| N-01 | Outbox transaksional wajib untuk seluruh notifikasi | Mengikat |
| N-02 | In-app sebagai baseline; email dan WA sebagai peningkatan | Dianjurkan |
| N-03 | Idempotensi ditegakkan `uq_notif`, bukan kode | Mengikat |
| N-04 | WhatsApp ditunda ke F7+ di belakang antarmuka pengirim | Dianjurkan |
| N-05 | Pantau **usia** outbox tertua, bukan hanya kedalaman antrean | Mengikat |
| N-06 | Notifikasi in-app tidak dapat dimatikan | Dianjurkan |
| N-07 | Kolom surel & telepon ditambahkan sejak migrasi pertama | Menunggu **Q-13** |
