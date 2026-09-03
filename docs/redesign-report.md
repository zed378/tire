# Laporan Redesign — QA, Aksesibilitas, Kinerja

Dokumen ini laporan pengukuran, bukan spesifikasi. Yang mengikat tetap `PLAN/00`–`13`
dan `docs/design-brief.md`. Status pengerjaan ada di `PLAN/14`.

Diukur: **03/09/2026 WIB**, di mesin pengembang (Windows 11, Chromium headless
Playwright 1.49).

---

## 1. Aksesibilitas

### Cara mengulang

```
pnpm test:a11y
```

Berkasnya `apps/web/e2e/accessibility.spec.ts`. Sapuan ini **tidak** butuh basis
data dan tidak butuh API: satu-satunya panggilan yang dibuat cangkang aplikasi
saat memuat, `/api/auth/me`, dijawab di dalam tes dengan amplop yang sama seperti
yang diterima pengunjung tanpa sesi. Audit yang tidak bisa dijalankan siapa pun
adalah audit yang tidak dijalankan siapa pun.

### Yang diperiksa

| Pemeriksaan | Cakupan |
| --- | --- |
| axe-core, tag `wcag2a` `wcag2aa` `wcag21a` `wcag21aa` | 4 halaman × 2 tema |
| Tidak ada geser horizontal | 4 halaman × 5 lebar (360 / 768 / 1024 / 1440 / 1920) |
| Login selesai tanpa tetikus | Enter mengirim dari dalam field |
| Setiap perhentian Tab berubah tampilannya saat difokuskan | 20 perhentian pertama |

Halaman: `/`, `/login`, `/register`, `/__styleguide`.

**Hasil akhir: 30 dari 30 lulus.** Sebelum perbaikan: 23 lulus, 7 gagal.

### Cacat yang ditemukan

Semua kegagalan berkategori `color-contrast`, tingkat `serious`.

#### C-01 — `--color-subtle` tidak pernah memenuhi AA di tema terang

`index.css` menulis, di atas blok tokennya sendiri, bahwa "setiap pasangan
teks-di-atas-latar di bawah ini berada di 4,5:1 atau lebih". Lalu:

```css
--color-subtle: var(--steel); /* 4.0:1 — large text and UI only */
```

Dua hal salah. Angkanya sendiri terlalu murah hati — `--steel` (#6E7580) di atas
concrete sebenarnya **3,75:1**, bukan 4,0. Dan komentarnya membatasi
penggunaannya ke "teks besar dan UI", padahal setiap penggunanya adalah teks 11px
atau 12px: nomor langkah `01–06` di perjalanan landing, kredit foto, keterangan
footer.

Empat belas elemen di halaman landing saja jatuh di bawah AA.

**Perbaikan.** Satu nilai turunan baru, mengikuti pola yang sudah ada di berkas
itu (`--steel-ink`, `--steel-lit`, `--steel-mid` semuanya turunan, bukan warna
baru):

```css
--steel-dim: 97 104 115; /* #616873 */
```

4,53:1 di atas concrete dan 5,62:1 di atas paper — titik paling gelap dari rona
itu yang masih terbaca "lebih tenang daripada sekunder" sambil lulus AA di
**kedua** latar terang.

#### C-02 — `accent-text` di atas `accent-soft` gagal di tema gelap

Keduanya sepasang di mana pun muncul: item sidebar aktif, opsi tersorot di
`SearchableSelect`, lencana aksen, kartu sambutan. Di tema gelap pasangan itu
brand-400 di atas brand-900 — **4,07:1**.

Ini tidak terdeteksi lebih awal karena setiap penggunanya ada di balik sesi, dan
sapuan ini hanya menjangkau halaman publik. Yang membuka kedok adalah kartu
posisi ban terpilih di preview landing, satu-satunya penggunanya di halaman
publik.

**Perbaikan.** `--color-accent-text` gelap naik dari brand-400 ke **brand-300**:
5,74:1 di atas isian dan 9,86:1 di atas kanvas.

Latarnya sengaja **tidak** digelapkan sebagai gantinya. brand-950 hanya 1,02:1
terhadap permukaan gelap — "terpilih" dan "tidak terpilih" akan terlihat sama.

#### C-03 — kartu terpilih di preview landing memakai token netral di atas isian aksen

Setiap `bg-accent-soft` lain di aplikasi dipasangkan dengan `text-accent-text`.
Kartu ini satu-satunya yang memakai `text-body`/`text-subtle`, dan `text-subtle`
di atas isian aksen gelap adalah 3,14:1. Sekarang mengikuti pasangan yang sama.

#### C-04 — halaman styleguide menampilkan kegagalan yang justru dibuatnya sendiri

Dua kelas, keduanya di `features/styleguide/styleguide-page.tsx`:

1. **Label dicetak di atas swatch-nya.** Tujuh label di bawah 4,5:1 — dan satu di
   antaranya tidak bisa diperbaiki dengan tinta lain sama sekali: `--ok`
   (#1E8E5A) hanya mencapai 4,14:1 terhadap putih dan 4,29:1 terhadap graphite,
   jadi tidak ada label yang terbaca di atasnya. Nama dan hex sekarang di
   **bawah** swatch, di atas latar halaman — sama seperti spesimen elevasi di
   bawahnya yang memang sudah begitu.
2. **Komponen nyata di atas latar material keras.** Panel form dan baris tombol
   memakai `bg-paper` dan `bg-concrete` (lapis material, selalu terang),
   sementara komponen di dalamnya mengikuti tema. Di mode gelap seluruh label di
   panel itu adalah teks nyaris-putih di atas putih. Itu persis kegagalan dua
   sistem token yang redesign ini ada untuk menghilangkan, terjadi di halaman
   yang mendokumentasikan tokennya. Panel komponen sekarang memakai
   `bg-surface`.

### Positif palsu yang dibuang dari tes

Versi pertama tes cincin fokus mencari `outline` atau `box-shadow` pada elemen
yang difokuskan, dan melaporkan field password di halaman login tidak punya
indikator. Field itu punya: `auth.css` sengaja mengganti cincin amber umum dengan
border yang berubah biru **dan menebal dua kali lipat**, plus garis amber yang
menyapu masuk di `::after` pembungkusnya — karena tiga indikator bertumpuk pada
satu kontrol 40px saling menimpa.

Tes yang menyebut implementasi akan menggagalkan implementasi yang lebih baik.
Sekarang setiap perhentian Tab dibandingkan dengan dirinya sendiri: elemen yang
sama, difokuskan dan tidak. Kalau tidak ada yang berubah, pengguna papan ketik
tidak tahu di mana mereka berada — apa pun alasannya.

### Yang belum diaudit

Sapuan ini hanya menjangkau empat halaman publik. **Dua puluh layar di balik
sesi belum pernah diperiksa axe**, dan C-02 menunjukkan kelas cacat yang justru
hidup di sana. Menjangkaunya butuh basis data ter-seed — sama seperti G-11.

---

## 2. Lebar layar

Empat halaman diuji di 360 / 768 / 1024 / 1440 / 1920. **Dua puluh dari dua
puluh lulus** sejak pengukuran pertama; tidak ada halaman yang menggeser ke
samping di lebar mana pun. Tidak ada perbaikan yang diperlukan.

---

## 3. Largest Contentful Paint

### Cara mengulang

```
pnpm --filter @c26/web build
pnpm --filter @c26/web preview
pnpm --filter @c26/web measure:lcp
```

Profil throttling Lighthouse mobile — 1,6 Mbit/s turun, 750 Kbit/s naik, 150ms
pulang-pergi, CPU diperlambat empat kali — pada perangkat Pixel 5. Build
produksi, bukan dev server: mengukur dev server melaporkan biaya modul ES tanpa
bundling yang tidak pernah dibayar siapa pun.

Tiga kali jalan per rute, yang dilaporkan yang tengah. Throttling teremulasi di
mesin yang juga mengerjakan hal lain itu berisik — halaman yang sama diukur dua
kali berturut-turut pernah kembali 3,6 detik dan 9,5 detik.

### Hasil

Anggaran 2,5 detik. **Semua rute publik meleset.**

| Rute | LCP (median dari 3) | Elemen yang terakhir tergambar |
| --- | --- | --- |
| `/` | **4,14 s** | foto hero (`tire-tread`, 95,7 KB AVIF) |
| `/login` | **3,21 s** | foto auth (`depot`, 21,0 KB AVIF) |
| `/register` | **3,37 s** | foto auth (`depot`, 21,0 KB AVIF) |

### Resep di `PLAN/14` menyasar hal yang salah

Catatan itu menulis: "Kalau meleset dari 2,5 detik, IBM Plex Mono yang dilepas
duluan." Pengukuran mengatakan sebaliknya. Elemen yang tergambar terakhir adalah
**foto**, di ketiga rute — bukan teks, bukan huruf. Melepas Plex Mono akan
menghilangkan huruf data dari seluruh aplikasi dan tidak menggerakkan angka ini.
Huruf itu tetap.

### Apa yang dicoba, dan apa hasilnya

Seluruh aplikasi ber-sesi dipisahkan ke satu chunk lazy
(`src/routes/protected-routes.tsx`). Pengunjung tanpa sesi sebelumnya mengunduh
seluruh produk — cangkang, setiap layar pemeriksaan, QC, spesifikasi ban,
notifikasi — sebelum halaman landing bisa menggambar satu kata pun.

Hasilnya, diukur bolak-balik dalam kondisi yang sama:

| | JS awal (gzip) | `/` | `/login` | `/register` |
| --- | --- | --- | --- | --- |
| Sebelum pemisahan | 171,1 KB | 4,27 s | 3,03 s | 3,40 s |
| Sesudah pemisahan | **146,6 KB** | 4,14 s | 3,21 s | 3,37 s |

**Pemisahan itu bukan perbaikan LCP.** Selisih waktunya derau, bukan perbaikan.
Ia tetap dipertahankan karena alasannya sendiri: 24,5 KB adalah sebagian besar
sisa ruang yang dimiliki anggaran 180 KB `PLAN/06` §7, dan pengunjung tanpa sesi
tidak seharusnya mengunduh layar yang tidak boleh ia buka.

### Diagnosis

Biayanya rantai berurutan yang dimiliki sebuah SPA secara konstruksi:

```
HTML  →  JS (146 KB)  →  render  →  peramban menemukan <img>  →  ambil foto  →  dekode
```

Foto tidak bisa mulai diunduh sebelum JavaScript selesai dijalankan dan React
menggambar. Memotong 24 KB dari mata rantai tengah tidak memendekkan rantainya.
Selisih 0,9 detik antara `/` dan `/login` kira-kira selisih ukuran fotonya
(95,7 KB versus 21,0 KB) pada tautan yang di-throttle.

### Yang bisa ditempuh — perlu keputusan pemilik

1. **`<link rel="preload" as="image">` untuk foto LCP.** Menghapus satu
   pulang-pergi penuh dan menumpuk pengambilan foto di atas pengunduhan JS. Ini
   pengungkit terbesar yang tersisa. Halangannya: aplikasi disajikan dari satu
   `index.html` statis, sementara foto hero berbeda antara `/` dan halaman auth
   — preload yang benar untuk `/` memboroskan 96 KB di `/login`. Butuh HTML per
   rute di Caddy, atau menerima pemborosan itu.
2. **Turunkan kualitas AVIF khusus `tire-tread`.** 95,7 KB pada 1280 sementara
   saudaranya 21–55 KB; makro tapak itu detail berfrekuensi tinggi dan mahal.
   Menghemat kira-kira 0,4 detik di `/` saja.
3. **Terima angkanya.** `/login` dan `/register` — dua halaman yang benar-benar
   dilalui pengguna lapangan setiap hari — berada di 3,2 detik, dan sesudah
   masuk aplikasi tidak lagi membayar biaya muat pertama.

`PLAN/01` §4.2 memilih SPA dengan sadar, tanpa SSR. Laporan ini tidak
mengusulkan membuka kembali keputusan itu; ia hanya mencatat harga yang
dibayarkannya, terukur.

---

## 4. Anggaran ukuran

| | Terukur | Plafon | Gerbang |
| --- | --- | --- | --- |
| JS awal (gzip) | 146,6 KB | 180 KB | G-12 |
| CSS (gzip) | 11,25 KB | — | — |
| Huruf, enam berkas woff2 | 160 KB | — | — |

---

## 5. Cacat lain yang ditemukan selama fase ini

### G-11 tidak pernah bisa berjalan

`vite.config.ts` menyajikan di `127.0.0.1:5573`. `playwright.config.ts` menunggu
`localhost:5173`. Perintah `pnpm test:e2e` karena itu habis waktu setelah enam
puluh detik menunggu server yang sebenarnya sudah hidup sepanjang waktu — dua
port berbeda, dan pada Windows `localhost` juga menyelesaikan ke `::1` lebih dulu
sementara Vite mengikat alamat IPv4.

`PLAN/14` mencatat "G-11 e2e alur QC belum pernah dijalankan". Ini sebabnya.

Sekarang keduanya mengimpor satu definisi, `apps/web/dev-server.ts`. Sapuan
aksesibilitas berjalan lewat jalur yang sama, jadi kalau port itu bergeser lagi,
ia yang akan memberi tahu.
