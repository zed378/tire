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
data dan tidak butuh API. Halaman publik dijawab dengan amplop yang diterima
pengunjung tanpa sesi; **dua puluh layar di balik sesi** dijawab dengan fixture
di `apps/web/e2e/api-stubs.ts`. Audit yang tidak bisa dijalankan siapa pun
adalah audit yang tidak dijalankan siapa pun — dan audit yang butuh Postgres
hidup adalah audit yang dilewati.

Fixture-nya diketik terhadap `@c26/contracts`, jadi bentuk respons yang berubah
mematahkan typecheck, bukan diam-diam merender layar kosong yang lulus.

### Yang diperiksa

| Pemeriksaan | Cakupan |
| --- | --- |
| axe-core, tag `wcag2a` `wcag2aa` `wcag21a` `wcag21aa` | **24 halaman × 2 tema** |
| axe-core, **keadaan kosong** | 20 layar di balik sesi, tanpa satu baris data |
| axe-core, **dialog terbuka** | 4 dialog: tiga form, satu konfirmasi |
| Tab tidak bisa keluar dari dialog | 15 perhentian |
| Escape menutup dialog dan mengembalikan fokus ke pembukanya | — |
| Form yang ditolak menautkan pesan ke fieldnya | `aria-invalid` + `aria-describedby` |
| Tidak ada geser horizontal | 4 halaman publik × 5 lebar (360 / 768 / 1024 / 1440 / 1920) |
| Login selesai tanpa tetikus | Enter mengirim dari dalam field |
| Setiap perhentian Tab berubah tampilannya saat difokuskan | 20 perhentian pertama |

Publik: `/`, `/login`, `/register`, `/__styleguide`.

Di balik sesi: `/welcome`, daftar dan detail pemeriksaan, form pemeriksaan baru,
spesifikasi ban, antrean unggah, antrean dan tinjauan QC, laporan, pengguna,
empat layar master data, audit, panel operasional, notifikasi, dan tiga layar
profil.

**Hasil akhir: 97 dari 97 lulus.**

| Putaran | Lulus | Gagal |
| --- | --- | --- |
| Pertama, halaman publik saja | 23 | 7 |
| Sesudah C-01 … C-04 | 30 | 0 |
| Pertama, dengan layar di balik sesi | 57 | **13** |
| Sesudah C-05 … C-09 | 70 | 0 |
| Ditambah keadaan kosong, dialog, dan galat | **97** | 0 |

Putaran terakhir itu lulus **sejak percobaan pertama**. Dua puluh keadaan
kosong, empat dialog, jebakan fokusnya, Escape yang mengembalikan fokus ke
pembuka, dan sebuah form yang baru saja ditolak — tidak satu pun melanggar.
Yang layak dicatat bukan angkanya, melainkan bahwa `Dialog` sudah memenuhi
seluruh kontrak modalnya sebelum ada yang mengujinya: `aria-modal`, judul yang
menamai, jebakan fokus, Escape, dan fokus yang kembali ke tempatnya.

### Cacat yang ditemukan

Sembilan, dalam dua putaran: C-01 sampai C-04 dari halaman publik, C-05 sampai
C-09 dari layar di balik sesi. Yang pertama semuanya soal kontras. Yang kedua
sebagian besar bukan — dan yang paling parah di antaranya, satu-satunya bertaraf
**critical** dalam sapuan ini, adalah janji ARIA yang tidak ditepati markup.

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

#### C-05 — `Tabs` menjanjikan panel yang tidak pernah ada (kritis)

`components/ui/tabs.tsx` memasang `aria-controls="panel-<nilai>"` di setiap tab.
`tire-brand-patterns-page` dan `tire-sizes-page` memakai `Tabs` **tanpa satu pun
`TabPanel`**, jadi atribut itu menunjuk id yang tidak dirender apa-apa.

Bagi pembaca layar itu berarti: "tab, mengendalikan sebuah region" — lalu
region-nya tidak ada. axe menilainya **critical**, satu-satunya di seluruh
sapuan. Kedua halaman kini membungkus isinya dengan `TabPanel`.

#### C-06 — tombol di dalam tombol pada `SearchableSelect`

Tanda silang "hapus pilihan" adalah `<span role="button" tabIndex={0}>` **di
dalam** tombol pemicu. Kontrol di dalam kontrol: peramban dan pembaca layar
tidak sepakat cara memaparkannya, dan pada praktiknya yang di dalam ikut
terbaca sebagai bagian dari nama tombol luar dan tidak bisa dioperasikan
sendiri.

Sekarang ia saudara dari pemicu, diposisikan absolut di atasnya, dan sebuah
`<button>` sungguhan dengan nama yang menyebut pilihan yang akan dihapus.

Terlihat di layar spesifikasi ban, tapi komponennya dipakai juga di form
pemeriksaan baru — merk kendaraan, provinsi, kota.

#### C-07 — grafik menjanjikan akses papan ketik yang tidak pernah ada

`components/ui/line-chart.tsx` menaruh satu `<rect role="button" tabIndex={0}>`
per titik data di dalam `<svg role="img">`. Sebuah `role="img"` adalah **satu
daun** di pohon aksesibilitas: anak-anaknya tidak dipaparkan sama sekali. Jadi
strip itu tidak pernah bisa difokus, dan angkanya tidak pernah terbaca — yang
didapat pembaca layar hanya "Grafik TB dan LT per periode", tanpa satu pun
angka.

Atribut interaktifnya dilepas (strip itu memang afordans penunjuk, bukan
kontrol), dan sebagai gantinya data yang sama disajikan sebagai **tabel
`sr-only`** — periode, TB, LT, baris per baris. Bukan menambal aturan axe:
sebelumnya angkanya benar-benar tidak tersedia.

#### C-08 — `<dl>` yang bukan daftar definisi, di halaman profil

`<dt>` dan `<dd>` bersarang dua `<div>` dalam. Spesifikasi hanya mengizinkan
satu `<div>` pembungkus per kelompok, jadi axe melaporkan dua sisi sekaligus:
daftar yang isinya bukan kelompok, dan istilah yang tidak berada di dalam
daftar.

Meratakannya pun tidak akan benar. Tiap baris membawa aksi, dan baris yang bisa
dioperasikan bukan "istilah dan definisinya". Sekarang `<ul>` — daftar
pengaturan, yang memang itulah wujudnya.

#### C-09 — dua kontras terakhir

| Tempat | Sebelum | Perbaikan |
| --- | --- | --- |
| Tombol peringatan di layar sambutan, `bg-warning text-white` | **3,19:1** | Token baru `--color-on-warning` (graphite) — 5,58:1. Amber di palet ini warna sinyal yang terang ("kapur di dinding ban"); ia menuntut tinta gelap, bukan putih. Pasangan `on-accent` sudah ada; `on-warning` yang belum |
| Label kartu statistik antrean QC, `opacity-80` | 6,84 → **4,41:1** (peringatan), 6,81 → **4,34:1** (sukses) | Peredupannya dilepas. Huruf kapital 12px berspasi sudah terbaca sekunder; meredupkannya tidak membeli apa pun |

Yang kedua kelas cacat yang sama dengan langkah `01–06` di landing yang dulu
diredupkan `opacity: .55`. Peredupan adalah cara paling mudah menjatuhkan
kontras tanpa ada yang menyadarinya.

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

- **Pembaca layar sungguhan.** axe menangkap kelas cacat yang tidak terlihat
  mata; ia tidak menggantikan menjalankan halaman ini dengan NVDA atau
  TalkBack. Ini yang tersisa dan tidak bisa diotomatiskan.
- **Keadaan yang butuh jawaban server tertentu**: 500 dengan `requestId` yang
  bisa disalin, `SERVICE_UNAVAILABLE`, unggahan yang gagal, antrean offline.
  Fixture-nya selalu menjawab 200; menjangkau ini berarti menambah varian gagal
  di `api-stubs.ts`.
- **Empat dialog dari sekian**, dipilih untuk mencakup dua bentuknya — form dan
  konfirmasi. Dialog step-up, misalnya, belum terbuka dalam sapuan.
- Satu hal yang saya lihat tapi **tidak** saya ubah: halaman profil memasang
  `<Button>` di dalam `<Link>` — sebuah `<button>` di dalam `<a>`. Itu HTML
  tidak sah dan dua kontrol bertumpuk, tapi axe tidak melaporkannya, dan
  memperbaikinya berarti memilih antara menduplikasi kelas tombol di sisi
  tautan atau menambah komponen baru. Keputusan Anda.

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
