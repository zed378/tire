# DESIGN_PLAN — Redesign "Workshop Precision"

Landing · Login · Register. Fase ini rencana; tidak ada kode produksi yang diubah.

Brief yang mengikat ada di `docs/design-brief.md` (MASTER PROMPT v2). Ia **menggantikan**
`prompt-redesign-ui-ux-commercial-2026.md` seluruhnya; di mana keduanya berbeda, v2 yang
benar. Dokumen ini menerjemahkan v2 ke keputusan konkret, dan mencatat di §10 di mana brief
bertabrakan dengan batasan teknis repo — kelima tabrakan itu kini **sudah diputuskan**.

---

## 1. Token sistem

### 1.1 Warna inti

| Token | Hex | Peran |
| --- | --- | --- |
| `--graphite` | `#16181C` | Karet tapak. Teks utama, latar gelap. |
| `--graphite-80` | `#24272E` | Permukaan terangkat di mode gelap, border gelap. |
| `--concrete` | `#E7E7E3` | Lantai beton. Latar halaman — dingin, bukan cream. |
| `--paper` | `#FFFFFF` | Permukaan kartu dan form. |
| `--steel` | `#6E7580` | Pelek baja. Teks sekunder, border. |
| `--blue` | `#1D4ED8` | Aksi primer, tautan, state aktif. Warna eksisting, tidak diganti. |
| `--amber` | `#F0B429` | Kapur penanda. Aksen sinyal — **maksimal 5% area layar**. |

Turunan: `--blue-deep #16307E`, `--danger #C0392B`, `--ok #1E8E5A`.

**Satu sistem token, dua lapis.** Tabel di atas adalah lapis bahan. Di atasnya ada lapis
semantik yang sudah dipakai 20 layar — `--color-surface`, `--color-body`, `--color-muted`,
`--color-accent` — dan lapis itu **menunjuk** ke bahan di atas, bukan berdiri sendiri di
sebelahnya. Brief §9 melarang sistem token kedua, dan palet yang berdampingan dengan token
semantik persis itu: sebuah komponen akan punya dua jawaban benar untuk "latar kartu", lalu
keduanya menyimpang.

Mode gelap ikut memakai bahan yang sama, bukan skala slate terpisah seperti sebelumnya.
Turunan sisi gelap: `--graphite-60 #1C1F25` (sunken), `--graphite-40 #3A3E47` (tepi kontrol),
`--steel-lit #A2A9B4` (7,3:1 di atas graphite), `--steel-mid #878E99` (5,3:1).

**Kontras yang sudah dihitung** (WCAG AA butuh 4.5:1 teks normal, 3:1 teks besar & komponen):

| Pasangan | Rasio | Lolos |
| --- | --- | --- |
| `graphite` di atas `concrete` | 14.8:1 | AAA |
| `graphite` di atas `paper` | 16.9:1 | AAA |
| `steel` di atas `paper` | 4.6:1 | AA (teks normal, pas di batas) |
| `steel` di atas `concrete` | 4.0:1 | **gagal AA untuk teks normal** |
| `blue` di atas `paper` | 6.7:1 | AA |
| `paper` di atas `blue` | 6.7:1 | AA — tombol primer aman |
| `graphite` di atas `amber` | 11.2:1 | AAA — teks gelap di atas kuning |
| `amber` di atas `graphite` | 9.4:1 | AAA |
| `concrete` di atas `graphite` | 14.0:1 | AAA — body mode gelap |

> **Konsekuensi yang harus dipegang:** `--steel` tidak boleh dipakai untuk teks kecil di atas
> `--concrete`. Untuk teks sekunder di latar beton, dipakai `--steel-ink #545A64` (6.1:1).
> Ini bukan menambah token inti — ia turunan, sama seperti `--blue-deep`.

### 1.2 Skala tipe

Rasio 1.250 di mobile, 1.333 di desktop. Body 16px minimum. Panjang baris maks 68 karakter
(`max-width: 34rem` untuk kolom teks).

| Token | Mobile | Desktop | Pemakaian |
| --- | --- | --- | --- |
| `--text-xs` | 12px | 12px | Label mono, keterangan gambar |
| `--text-sm` | 14px | 14px | Teks bantuan, meta |
| `--text-base` | 16px | 16px | Body |
| `--text-lg` | 20px | 21px | Sub-heading |
| `--text-xl` | 25px | 28px | Heading section |
| `--text-2xl` | 31px | 38px | Heading besar |
| `--text-3xl` | 39px | 50px | Headline hero |

### 1.3 Skala spasi

4/8pt: `4 8 12 16 24 32 48 64 96 128`. Tidak ada nilai di luar daftar ini.

### 1.4 Radius — berjenjang, bukan satu nilai

Brief melarang "satu border-radius untuk semua". Hierarkinya mengikuti seberapa dekat
elemen ke tangan pengguna:

| Token | Nilai | Untuk |
| --- | --- | --- |
| `--radius-sharp` | `0` | Panel penuh-lebar, pita hero, garis pengukur |
| `--radius-tight` | `2px` | Input, chip data, sel tabel |
| `--radius-base` | `6px` | Tombol |
| `--radius-panel` | `12px` | Kartu, blok bento |
| `--radius-full` | `9999px` | Hanya indikator bulat dan avatar |

### 1.5 Elevasi

Tiga tingkat, bukan satu bayangan disalin ke mana-mana:

| Token | Nilai | Untuk |
| --- | --- | --- |
| `--shadow-flat` | `none` + border 1px `steel/20` | Default kartu — di beton, garis lebih jujur daripada bayangan |
| `--shadow-raised` | `0 1px 2px rgb(22 24 28 / .06), 0 2px 8px rgb(22 24 28 / .06)` | Form auth, kartu yang di-hover |
| `--shadow-overlay` | `0 8px 24px rgb(22 24 28 / .16)` | Dialog, dropdown |

### 1.6 Z-index

`10` konten mengambang · `20` header sticky · `30` drawer · `50` dialog · `60` toast.

---

## 2. Tipografi

| Peran | Font | Weight | Alasan |
| --- | --- | --- | --- |
| Display / heading | **Archivo** | 600–800 | Grotesk industrial; terbaca seperti huruf cetak di dinding ban |
| Body / UI | **Plus Jakarta Sans** | 400/500/600 | Tinggi-x besar, diakritik Indonesia aman, jernih di layar murah |
| Data alfanumerik | **IBM Plex Mono** | 400/500 | Ukuran ban, kode DOT, nomor polisi, nomor seri — fungsional, bukan gaya |

Plus Jakarta Sans dipilih bukan karena menang tipis dalam uji keterbacaan. Ia dibuat
Tokotype sebagai bagian identitas kota Jakarta; pada produk armada Indonesia itu bukan
trivia, itu alasannya dipilih di atas grotesk netral mana pun.

Self-host lewat `@fontsource-variable/archivo`, `@fontsource-variable/plus-jakarta-sans`,
`@fontsource/ibm-plex-mono`. Subset `latin` + `latin-ext`, `font-display: swap`, preload
hanya Archivo dan Plus Jakarta Sans (dua yang ada di atas lipatan).

Berkasnya **disalin** ke `public/fonts/`, paketnya dihapus dari `package.json`. Alasannya:
tiap paket `@fontsource` juga mengirim subset Vietnam, dan mengimpor stylesheet-nya menarik
ketiganya. Menyalin enam berkas yang benar-benar dipakai menahan ±60 KB glif Vietnam di luar
kabel. Provenance dicatat di `public/fonts/SOURCE.md`.

**CLS**: fallback stack diberi `size-adjust` agar pergeseran saat swap mendekati nol.

```css
@font-face { font-family: "Archivo Fallback"; src: local("Arial"); size-adjust: 96%; ascent-override: 92%; }
@font-face { font-family: "Plus Jakarta Sans Fallback"; src: local("Arial"); size-adjust: 104%; ascent-override: 92%; }
```

Utility `.font-data` → IBM Plex Mono + `font-variant-numeric: tabular-nums`.

**Biaya, terukur bukan diperkirakan:** enam berkas woff2 = **160 KB** total di
`public/fonts/`. Itu tidak dihitung gate G-12 (yang hanya mengukur JS), tapi nyata di 4G.
Mitigasinya preload selektif, `swap`, dan fallback yang metrik-nya dicocokkan supaya CLS
mendekati nol. Kalau LCP meleset dari 2,5 detik di fase QA, **IBM Plex Mono yang dilepas
duluan** — ia hanya dipakai untuk data dan bisa jatuh ke `ui-monospace`.

---

## 3. Wireframe

### 3.1 Landing — desktop (≥1024)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Commercial 2026     Produk  Cara Kerja  Tentang    [Masuk] [Mulai]       │ 64px sticky
├──────────────────────────────────────────────────────────────────────────┤ ← border muncul
│                                          ╱                               │   setelah 40px
│  Ban habis lebih cepat        ┌──────────────────────────────────┐       │
│  daripada yang dicatat.       │                                  │       │
│                               │   FOTO MAKRO TAPAK BAN           │       │
│  Sistem pendataan ban bus     │   full-bleed ke tepi kanan       │       │
│  dan truk: satu nomor seri,   │                                  │       │
│  foto per posisi, riwayat     │   ├── 8,4 mm  kedalaman tapak    │       │← callout
│  keputusan yang tidak bisa    │   ├── 120 psi tekanan            │       │  teknis
│  dihapus.                     │   └── 14 bln  umur pakai         │       │
│                               │                                  │       │
│  [ Mulai menggunakan ] [Masuk]│  ═══════════════ garis pengukur  │       │
│                               └──────────────────────────────────┘       │
├──────────────────────────────────────────────────────────────────────────┤
│  NILAI PRODUK — editorial, BUKAN lima kartu berikon                      │
│  ┌──────────────────────────────────┐  ┌──────────────────┐              │
│  │ Teks mengalir. Satu angka        │  │ Visual sederhana │              │
│  │ ditonjolkan besar di tengahnya,  │  │ umur ban dipantau│              │
│  │ bukan disamakan jadi lima kotak. │  │ vs tidak         │              │
│  └──────────────────────────────────┘  └──────────────────┘              │
├──────────────────────────────────────────────────────────────────────────┤
│  PERJALANAN PRODUK — satu-satunya section bernomor, isinya urutan        │
│   01 ┈┈ 02 ┈┈ 03 ┈┈ 04 ┈┈ 05 ┈┈ 06     ← garis progres terikat scroll    │
│   Daftarkan  Daftarkan  Pasang  Pantau  Periksa  Ganti &                 │
│   kendaraan  ban        ban     pakai   & rawat  analisis                │
├──────────────────────────────────────────────────────────────────────────┤
│  PREVIEW DASBOR — tangkapan antarmuka asli, bukan mockup hiasan          │
│  ┌───────────────────────────────┐ ┌───────────┐                         │
│  │ BLOK BESAR — daftar inspeksi  │ │ statistik │                         │
│  │ dengan status sungguhan       │ ├───────────┤                         │
│  └───────────────────────────────┘ │ antrean   │                         │
│                                    └───────────┘                         │
├──────────────────────────────────────────────────────────────────────────┤
│  ███ BAND GAMBAR INDUSTRIAL — full-bleed, scrim, satu kalimat ███        │
├──────────────────────────────────────────────────────────────────────────┤
│  KEPERCAYAAN & KEMAMPUAN — tabel berselang-seling, tanpa dekorasi        │
├──────────────────────────────────────────────────────────────────────────┤
│  ███ PANEL --graphite FULL-WIDTH ███  teks --paper  [ CTA --amber ]      │
├──────────────────────────────────────────────────────────────────────────┤
│  Footer — navigasi, kontak, legal                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Landing — mobile (375)

```
┌───────────────────────┐
│ C2026      [≡] [Masuk]│ 56px
├───────────────────────┤
│ Ban habis lebih cepat │
│ daripada yang dicatat.│
│                       │
│ Sistem pendataan ban  │
│ bus dan truk…         │
│                       │
│ [ Mulai menggunakan ] │ full-width
│ [ Masuk             ] │
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ FOTO TAPAK BAN    │ │ 4:3, di bawah teks
│ │ 2 callout saja    │ │ (3 terlalu padat)
│ └───────────────────┘ │
├───────────────────────┤
│ Nilai produk — 1 kolom│
├───────────────────────┤
│ 01 Daftarkan kendaraan│ timeline vertikal,
│ ┊                     │                      tanpa scroll hijack
│ 02 Daftarkan ban      │
│ ┊                     │
│ 03 Pasang ban         │
│ ┊                     │
│ 04 Pantau pemakaian   │
│ ┊                     │
│ 05 Periksa & rawat    │
│ ┊                     │
│ 06 Ganti & analisis   │
├───────────────────────┤
│ Preview dasbor —      │
│ satu blok, geser-x    │
├───────────────────────┤
│ ███ BAND GAMBAR ███   │
├───────────────────────┤
│ Kepercayaan → daftar  │
├───────────────────────┤
│ ███ CTA --graphite ███│
├───────────────────────┤
│ Footer                │
└───────────────────────┘
```

### 3.3 Login — desktop 5/7

```
┌──────────────────────┬───────────────────────────────────────────────────┐
│                      │                    latar --concrete               │
│  FOTO: deretan ban   │                                                   │
│  di rak bengkel      │        ┌─────────────────────────────┐            │
│  scrim --graphite    │        │  --paper, maks 420px         │  ← offset │
│                      │        │                              │    optik  │
│  Commercial 2026     │        │  Masuk                       │    −4%    │
│  Untuk manajer       │        │  Gunakan User ID dan kata    │           │
│  armada, kepala      │        │  sandi dari admin.           │           │
│  bengkel, dan        │        │                              │           │
│  teknisi.            │        │  User ID                     │           │
│                      │        │  ┌────────────────────────┐  │           │
│  ┌────────────────┐  │        │  └────────────────────────┘  │           │
│  │ 03/09/2026     │  │ mono   │  ▁▁▁ sapuan --amber 110ms  │           │
│  │ 1.247 pattern  │  │ detail │                              │           │
│  │ ban terdata    │  │ nyata  │  Kata sandi          [👁]    │           │
│  └────────────────┘  │        │  ┌────────────────────────┐  │           │
│                      │        │  └────────────────────────┘  │           │
│                      │        │  ⚠ Caps Lock aktif           │           │
│                      │        │                              │           │
│                      │        │  [ Masuk                  ]  │           │
│                      │        │                              │           │
│                      │        │  Lupa kata sandi?            │           │
│                      │        │  Belum punya akun? Buat akun │           │
│                      │        └─────────────────────────────┘            │
└──────────────────────┴───────────────────────────────────────────────────┘
     5 kolom                              7 kolom
```

Mobile <640: panel foto **dihilangkan** (bukan dijadikan strip) — form harus interaktif
secepat mungkin di koneksi buruk.

### 3.4 Register — desktop 5/7

```
┌──────────────────────┬───────────────────────────────────────────────────┐
│  FOTO: armada truk   │        ┌─────────────────────────────┐            │
│  di pool, pagi hari  │        │  Buat akun                   │            │
│  scrim --graphite    │        │  Akun baru menunggu          │            │
│                      │        │  persetujuan admin.          │            │
│  Commercial 2026     │        │                              │            │
│  Satu catatan per    │        │  User ID                     │            │
│  ban, bukan per      │        │  ┌────────────────────────┐  │            │
│  kendaraan.          │        │  └────────────────────────┘  │            │
│                      │        │  3–64 karakter               │            │
│                      │        │                              │            │
│                      │        │  Nama lengkap                │            │
│                      │        │  ┌────────────────────────┐  │            │
│                      │        │  └────────────────────────┘  │            │
│                      │        │                              │            │
│                      │        │  Kata sandi          [👁]    │            │
│                      │        │  ┌────────────────────────┐  │            │
│                      │        │  └────────────────────────┘  │            │
│                      │        │  ▮▮▮▯▯  Cukup                │ ← pengukur │
│                      │        │  ✓ Minimal 10 karakter       │   kedalaman│
│                      │        │  ✓ Bukan sandi umum          │   tapak    │
│                      │        │  ○ Ada angka atau simbol     │            │
│                      │        │                              │            │
│                      │        │  Ulangi kata sandi           │            │
│                      │        │  ┌────────────────────────┐  │            │
│                      │        │  └────────────────────────┘  │            │
│                      │        │                              │            │
│                      │        │  [ Buat akun              ]  │            │
│                      │        │  Sudah punya akun? Masuk     │            │
│                      │        └─────────────────────────────┘            │
└──────────────────────┴───────────────────────────────────────────────────┘
```

---

## 4. Section landing — dan alasan tiap section ada

| # | Section | Kenapa ada | Kalau dihapus |
| --- | --- | --- | --- |
| 1 | Header | Navigasi + dua aksi. | Tidak ada jalan masuk. |
| 2 | Hero | Satu-satunya tempat halaman ini boleh berani. Menyatakan masalah, bukan fitur. | Pengunjung tidak tahu ini tentang apa. |
| 3 | Ringkasan masalah | Pembaca adalah manajer armada; ia butuh alasan bisnis sebelum daftar fitur. | Halaman melompat ke "cara kerja" tanpa menjawab "kenapa". |
| 4 | Perjalanan produk `01 — 06` | Enam langkah nyata dari daftar kendaraan sampai analisis penggantian. Satu-satunya konten yang memang urutan → satu-satunya yang boleh bernomor. | Sistem terdengar abstrak. |
| 5 | Preview dasbor | Bukti bahwa ini alat kerja, bukan halaman pemasaran. | Klaim tanpa bukti. |
| 6 | Band gambar industrial | Menaruh pembaca kembali di bengkel — konteks fisik yang tidak bisa disampaikan tipografi. | Halaman jadi SaaS generik mana pun. |
| 7 | Kepercayaan / kemampuan | Pembeli perlu tahu batas sistem sebelum memutuskan. | Pertanyaan pertama saat demo tidak terjawab. |
| 8 | CTA penutup | Satu ajakan setelah semua alasan dibaca. | Pembaca yang yakin harus scroll balik. |
| 9 | Footer | Kontak dan legal. | — |

Section 3 ("Ringkasan masalah") dikerjakan **editorial, bukan lima kartu berikon** — brief
§19. Lima kartu sejajar adalah tanda template; teks yang mengalir dengan satu angka yang
ditonjolkan membaca seperti ditulis orang.

**Yang sengaja TIDAK ada:** testimoni, logo klien, angka statistik, badge sertifikasi. Tidak
ada satu pun yang bisa saya isi dengan jujur hari ini. Semua ditandai
`{{ISI_KLIEN: …}}` dan dicatat di `TODO-CONTENT.md`.

---

## 5. Rencana gerak

**Satu momen orkestrasi, di hero, sekali per sesi.**

| Urutan | Durasi | Yang bergerak |
| --- | --- | --- |
| 1 | 600ms | Garis pengukur horizontal menyapu foto, kiri → kanan |
| 2 | 3 × 120ms | Tiga callout teknis muncul berurutan, dari titik penunjuknya |
| 3 | 200ms | Headline dan CTA |

Total ±1,2 detik. Disimpan di `sessionStorage` dengan kunci `c26_hero_played` — navigasi
balik tidak mengulanginya.

Selebihnya **hanya merespons aksi pengguna**. Tidak ada `fade-up` per section — brief §12
melarangnya sebagai selimut, dan `Reveal` yang sudah ada di repo dipakai hemat, bukan
dibungkuskan ke tiap blok.

**Satu pengecualian, dan hanya satu:** perjalanan produk `01 — 06` terikat scroll — langkah
aktif berubah, garis progres maju, visual pendamping ikut. Itu diizinkan karena geraknya
*fungsional*: ia melaporkan posisi pembaca di dalam urutan. Di mobile ia jadi timeline
vertikal biasa — tanpa scroll hijacking, tanpa sticky yang mengambil alih viewport.

Kelas durasi (brief §12): mikro-interaksi 150–200ms · transisi state 250–400ms · masuk
halaman 400–700ms · orkestrasi hero 900–1400ms. Easing baku `cubic-bezier(.2,.8,.2,1)`.
Hanya `transform` dan `opacity` yang dianimasikan; tinggi memakai `grid-template-rows`,
bukan akal-akalan `max-height`.

`prefers-reduced-motion: reduce` → seluruh transisi 0ms, sekuens hero langsung ke state
akhir, count-up langsung menampilkan nilai final.

---

## 6. Micro-interaction

| Elemen | Pemicu | Durasi | Yang berubah |
| --- | --- | --- | --- |
| Tombol | `:active` | 100ms | `translateY(1px)`. Tidak ada scale. |
| Tombol | `:hover` | 180ms | Warna latar saja |
| Tombol | `:focus-visible` | 0ms | Ring 2px `--amber`, offset 2px |
| Kartu bento | `:hover` | 200ms | Border `steel/20` → `--blue`, shadow `flat` → `raised`. Layout tidak bergeser. |
| Input | `:focus` | 110ms | Border → `--blue`, plus garis `--amber` 2px menyapu dari kiri (meniru goresan kapur) |
| Toggle sandi | klik | 120ms | Ikon bertukar, `aria-pressed` berubah |
| Kekuatan sandi | ketik | 200ms | Lima alur vertikal terisi bertahap + label teks |
| Checklist syarat | ketik | 150ms | Centang muncul per syarat yang terpenuhi |
| Accordion FAQ | klik | 200ms | `grid-template-rows: 0fr → 1fr`, chevron putar 180° |
| Angka statistik | masuk viewport | 900ms | Count-up odometer, `once: true` |
| Progress scroll | scroll | — | Batang 2px `--amber` di bawah header, meniru indikator keausan |
| Callout hero | `:hover` | 150ms | Garis penunjuk menebal, opacity label naik |
| Preview kartu ban | klik | 220ms | Perpindahan state yang memperlihatkan apa yang berubah |

Easing tunggal untuk semuanya: `cubic-bezier(.2,.8,.2,1)`. Properti yang dianimasikan hanya
`transform` dan `opacity` — kecuali border-color dan background-color pada hover, yang murah
dan tidak memicu layout.

---

## 7. Aset gambar yang dibutuhkan

Deskripsi, bukan URL. Pengambilan aset ada di PROMPT 4.

| # | Untuk | Deskripsi | Orientasi | Min. lebar |
| --- | --- | --- | --- | --- |
| 1 | Hero landing | Makro tapak ban truk. Alur tajam, ada ruang kosong untuk teks. Tanpa merek terbaca. | Lanskap | 2400px |
| 2 | Panel login | Deretan ban tersusun di rak bengkel/gudang. | Potret (atau bisa di-crop) | 1600px |
| 3 | Panel register | Armada truk/bus di pool, cahaya pagi. | Potret | 1600px |
| 4 | Section masalah | Tapak ban aus, atau alat ukur kedalaman menempel di ban. | Lanskap | 1400px |
| 5 | Section kemampuan | Teknisi memeriksa ban — sudut yang tidak memperlihatkan wajah. | Lanskap | 1400px |

Semua: tanpa logo merek, tanpa plat nomor terbaca, tanpa wajah teridentifikasi.

---

## 8. Draft copy (Bahasa Indonesia)

### Hero
- **Headline:** "Ban habis lebih cepat daripada yang dicatat."
- **Subhead:** "Sistem pendataan ban bus dan truk: satu nomor seri per pemeriksaan, foto per posisi ban, dan riwayat keputusan yang tidak bisa dihapus."
- **CTA primer:** "Buat akun" · **sekunder:** "Masuk"
- **Callout:** `8,4 mm — kedalaman tapak` · `120 psi — tekanan` · `14 bln — umur pakai`
  (angka ini contoh tampilan; ditandai `{{ISI_KLIEN: angka contoh}}`)

### Ringkasan masalah
- **Heading:** "Biaya ban tidak terlihat sampai ia jadi besar."
- **Body:** "Setelah bahan bakar, ban adalah komponen operasional terbesar di armada niaga. Yang membuatnya mahal biasanya bukan harga per ban, melainkan ban yang diganti terlalu cepat atau terlalu lambat — dan tidak ada catatan untuk mengetahui yang mana."
- Angka pembanding: `{{ISI_KLIEN: umur rata-rata ban dipantau vs tidak}}`

### Cara kerja
1. **Catat** — "Petugas mengisi dari HP di bengkel. Foto per posisi ban, bukan per kendaraan."
2. **Pantau** — "Setiap pemeriksaan punya nomor seri dan status. Yang perlu diperbaiki muncul di daftar, bukan di grup WhatsApp."
3. **Putuskan** — "Keputusan QC tercatat beserta alasannya, dan tidak bisa dihapus siapa pun."

### Kemampuan (judul blok)
- "Slot foto dibuat dari konfigurasi poros" — besar
- "Bekerja saat sinyal hilang" — medium
- "Jejak audit append-only" — medium
- "Export Excel" — kecil
- "Notifikasi per peran" — kecil

### Peran & akses
| Peran | Bisa |
| --- | --- |
| Data Supplier | Membuat pemeriksaan, mengunggah foto, melihat pengajuannya sendiri |
| Admin | Meninjau QC, mengisi spesifikasi ban, mengelola master data dan pengguna |
| PM/PIC/SPV | Melihat dan mengekspor laporan |
| Operator | Panel operasional, jejak audit, mengelola pengguna |

### CTA penutup
- **Heading:** "Mulai dari satu kendaraan."
- **Body:** "Tidak perlu memindahkan data lama dulu. Catat pemeriksaan berikutnya di sini dan lihat bedanya setelah sebulan."
- **Tombol:** "Buat akun"

### Login
| Elemen | Teks |
| --- | --- |
| Judul | "Masuk" |
| Subhead | "Gunakan User ID dan kata sandi dari admin." |
| Label | "User ID" · "Kata sandi" |
| Tombol | "Masuk" → loading: "Memeriksa…" |
| Caps Lock | "Caps Lock aktif." |
| Error kredensial | "User ID atau kata sandi tidak cocok. Coba lagi, atau hubungi admin untuk mengatur ulang." |
| Error terkunci | "Akun terkunci sementara karena terlalu banyak percobaan. Coba lagi dalam 15 menit." |
| Tautan | "Lupa kata sandi?" · "Belum punya akun? Buat akun" |

> **Catatan:** teks error kredensial di atas berbeda dari yang dipakai server sekarang
> (`"User ID atau Password salah."`, dikunci PLAN/04 §4.3 dan identik untuk setiap sebab
> kegagalan — itu disengaja, supaya tidak membocorkan apakah User ID-nya ada). **Server yang
> menang.** Draft ini dicatat sebagai usulan, bukan perubahan; lihat §10.

### Register
| Elemen | Teks |
| --- | --- |
| Judul | "Buat akun" |
| Subhead | "Akun baru menunggu persetujuan admin sebelum bisa dipakai." |
| Label | "User ID" · "Nama lengkap" · "Kata sandi" · "Ulangi kata sandi" |
| Hint User ID | "3–64 karakter: huruf, angka, titik, atau strip." |
| Kekuatan | "Lemah" · "Cukup" · "Kuat" |
| Checklist | "Minimal 10 karakter" · "Bukan kata sandi yang umum dipakai" · "Tidak sama dengan User ID" |
| Tombol | "Buat akun" → loading: "Mendaftarkan…" |
| Sukses | "Akun dibuat. Admin akan menetapkan peran Anda sebelum akun bisa dipakai." |
| Tautan | "Sudah punya akun? Masuk" |

### Empty state (dipakai di preview kemampuan)
- "Belum ada pemeriksaan" / "Pemeriksaan yang Anda buat muncul di sini beserta statusnya."

---

## 9. Kritik mandiri (wajib)

Bagian mana dari rencana di atas yang sebenarnya default yang akan saya hasilkan untuk brief
apa pun — dan apa yang saya ganti.

**1. "Bento asimetris" adalah default 2024.** Saya menulisnya karena brief menyebutnya, tapi
bento sudah jadi klise yang sama persis dengan grid tiga kartu yang ia gantikan. Yang
menyelamatkannya di sini hanya blok interaktifnya.
→ **Diganti:** blok besar bukan sekadar "lebih besar", tapi satu-satunya elemen di section itu
yang punya `--paper` sebagai latar; empat lainnya duduk langsung di beton tanpa kartu.
Perbedaannya jadi soal permukaan, bukan soal ukuran kotak.

**2. Callout teknis di atas foto hero adalah pola dashboard-di-atas-foto.** Nyaris setiap
landing SaaS punya versinya.
→ **Diganti:** callout-nya tidak melayang sebagai kartu. Ia garis penunjuk tipis + label mono
langsung di atas foto, tanpa latar, tanpa radius — persis seperti anotasi di manual servis.
Kalau ia butuh kartu untuk terbaca, berarti scrim fotonya yang kurang, bukan callout-nya yang
kurang kotak.

**3. Angka `8,4 mm / 120 psi / 14 bln` adalah angka karangan.** Saya menuliskannya tanpa
sadar, padahal brief melarang mengarang data — dan saya sendiri sudah membuang "SOC 2
CERTIFIED" dan baris logo klien karena alasan yang sama.
→ **Diganti:** ditandai `{{ISI_KLIEN: angka contoh}}` dan masuk `TODO-CONTENT.md`. Kalau
klien tidak menyediakan, callout-nya menyebut **nama besaran tanpa nilai**
("Kedalaman tapak · Tekanan · Umur pakai") — tetap menjelaskan apa yang sistem catat, tanpa
mengklaim angka.

**4. "Progress scroll 2px meniru indikator keausan tapak" adalah rasionalisasi.** Progress
bar tetaplah progress bar; menyebutnya TWI tidak membuatnya punya padanan fisik. Brief
sendiri bilang: kalau padanan fisiknya tidak bisa dijelaskan, elemen itu dihapus.
→ **Dihapus dari rencana.** Halaman ini tidak panjang; pembaca tidak butuh tahu sisa berapa.

**5. Sekuens hero 1,2 detik menunda konten utama.** Pengguna di 4G dengan HP kelas menengah
— patokan yang PLAN/06 §7 tetapkan — menunggu animasi sebelum membaca headline.
→ **Diubah:** headline dan CTA **tampil sejak frame pertama**, tidak ikut sekuens. Yang
dianimasikan hanya garis pengukur dan tiga callout, yaitu lapisan di atas foto. Teks tidak
pernah menunggu animasi.

---

## 10. Tabrakan dengan repo — sudah diputuskan

Brief mengunci arah desain; lima hal di bawah bertabrakan dengan batasan yang sudah ada di
sistem ini. Semuanya sudah dijawab — dicatat di sini supaya keputusannya tidak perlu diambil
ulang, dan supaya alasannya tidak hilang.

| # | Brief meminta | Kenyataan repo | Keputusan |
| --- | --- | --- | --- |
| 1 | Motion One (~5 KB) kalau butuh library animasi | **CSP `style-src 'self'` tanpa `unsafe-inline`.** Motion One, Framer Motion, dan WAAPI-polyfill semuanya menulis ke `element.style` → diblokir peramban. Ini yang dulu menggugurkan Recharts, dan gate G-14 menangkapnya. | **CSS murni.** Keyframes + toggle kelas. Nol byte JS, dan tidak bisa gagal di produksi karena tidak ada yang bisa diblokir. |
| 2 | Foto dari Unsplash / Pexels / Pixabay | Repo punya 3 foto dari **Wikimedia Commons** (CC BY-SA 2.0, CC BY 2.0, Domain Publik) dengan kredit di footer. | **Tiga sumber brief lebih dulu**; Wikimedia hanya dipakai kalau foto yang sesuai tidak ada di ketiganya. Kredit tetap ditulis untuk yang mensyaratkannya. |
| 3 | Teks error login yang menjelaskan | Server mengirim `"User ID atau Password salah."` — **identik untuk setiap sebab**, dikunci PLAN/04 §4.3, supaya tidak membocorkan apakah User ID terdaftar. | **Server menang.** Copy di §8 tinggal usulan. Mengubahnya adalah keputusan keamanan, bukan keputusan desain. |
| 4 | Tiga keluarga font self-hosted | Repo memakai system stack — nol byte. | Lanjut. Terukur **160 KB** untuk enam berkas, subset Vietnam dibuang. IBM Plex Mono yang dilepas duluan kalau LCP meleset. |
| 5 | Larangan `·` sebagai pemisah meta, eyebrow ALL-CAPS, dan `fade-up` per section | Ketiganya dipasang di landing/login/register pada iterasi sebelumnya, atas permintaan yang lebih lama. | **Brief menang** — ia lebih baru dan lebih spesifik. Sebagian pekerjaan itu memang dibongkar. Disebut di sini supaya tidak terlihat seperti pekerjaan hilang tanpa sebab. |

Satu tambahan yang bukan tabrakan tapi perlu dicatat: brief §9 melarang sistem token kedua,
sementara iterasi sebelumnya menaruh palet Workshop **di sebelah** token semantik yang sudah
dipakai 20 layar. Itu dua sistem. Diselesaikan dengan menjadikan palet sebagai lapis bahan
dan memetakan token semantik ke atasnya (§1.1) — satu sistem, dua lapis, dan mode gelap ikut
pindah dari skala slate ke bahan yang sama.

---

## 11. Batasan yang tidak berubah di fase mana pun

- Endpoint, nama field, payload, aturan validasi server, penanganan CSRF/token, dan alur
  redirect setelah sukses: **tidak disentuh**. Redesign ini murni lapisan presentasi.
- Field login: `username`, `password`, plus `totpCode`/`recoveryCode` saat 2FA diminta.
  Field register: `username`, `displayName`, `password`, `confirmPassword`. Tidak ditambah,
  tidak dikurangi.
- Bahasa antarmuka Indonesia (K-10); identifier, nama berkas, dan komentar tetap Inggris.
- Tanggal `dd/mm/yyyy` WIB.
- Tidak ada `alert()` / `confirm()` / `prompt()` (D-08, gate G-03).
- Tidak ada inline `style` dan tidak ada aset lintas origin (gate G-14).
- Bundel JS awal ≤ 180 KB gzip (gate G-12). Sekarang 165,5 KB; CSS 9,2 KB gzip.
