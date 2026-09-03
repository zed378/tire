# 14 — Status Pengerjaan: Redesign UI/UX

**Dokumen ini catatan, bukan spesifikasi.** Berkas `00`–`13` mengikat; berkas ini
hanya melaporkan apa yang sudah dikerjakan terhadap keduanya. Kalau isinya
bertabrakan dengan `00`–`13`, yang mengikat tetap `00`–`13`.

Brief redesign ada di `docs/design-brief.md` (MASTER PROMPT v2). Ia menggantikan
`prompt-redesign-ui-ux-commercial-2026.md` seluruhnya. Rencana desain turunannya
ada di `DESIGN_PLAN.md`.

Terakhir diperbarui: **03/09/2026 WIB.**

> Perubahan sejak catatan pertama hari ini:
>
> - Utang `zodResolver` lunas — delapan form, bukan enam. Lihat "Utang form:
>   lunas".
> - Fase 6 dimulai. Sapuan aksesibilitas dan lebar layar hijau untuk empat
>   halaman publik; LCP diukur dan **meleset**. Angkanya di
>   `docs/redesign-report.md`.

---

## Ringkasan

| Fase (brief Lampiran A) | Status |
| --- | --- |
| 1 — Audit & DESIGN_PLAN | Selesai |
| 2 — Fondasi token, tipografi | Selesai |
| 3 — Landing page | Selesai |
| 4 — Login & Register | Selesai |
| 5 — Aset gambar | Selesai, dengan satu penyimpangan sumber (lihat di bawah) |
| 6 — QA, aksesibilitas, pembersihan | **Berjalan** — lihat di bawah |

Kondisi terukur saat ini:

- `pnpm verify` **hijau** — typecheck, lint, 551 tes, dan empat gerbang statis.
- `pnpm test:a11y` **hijau** — 30 pemeriksaan: axe-core WCAG 2.1 AA di empat
  halaman publik × dua tema, lima lebar layar, dan navigasi papan ketik.
- Bundel JS awal **146,6 KB** dari plafon 180 KB (G-12), turun dari 169,3 KB.
- CSS **11,25 KB** gzip.
- LCP profil 4G: `/` **4,14 s**, `/login` **3,21 s**, `/register` **3,37 s** —
  ketiganya di atas anggaran 2,5 detik.

---

## Yang sudah dikerjakan

### Fondasi (Fase 2)

- **Satu sistem token, dua lapis.** Palet Workshop (`--graphite`, `--concrete`,
  `--paper`, `--steel`, `--blue`, `--amber`) jadi lapis bahan; token semantik
  yang sudah dipakai 20 layar (`--color-surface`, `--color-body`,
  `--color-muted`, `--color-accent`) menunjuk ke lapis itu. Sebelumnya keduanya
  berdampingan — itu dua sistem, yang dilarang brief §9.
- **Mode gelap ikut palet yang sama.** Sebelumnya memakai skala `slate` terpisah,
  jadi latar terang hangat tapi latar gelap kebiruan.
- **Tipografi**: Archivo (display), Plus Jakarta Sans (body), IBM Plex Mono
  (data). Enam berkas woff2, total 160 KB, di-host sendiri di `public/fonts/`
  karena CSP-nya `font-src 'self'`. Provenance di `public/fonts/SOURCE.md`.
- Radius berjenjang, elevasi tiga langkah, skala z-index, satu `max-width` situs,
  satu easing.

### Landing (Fase 3)

Sembilan section sesuai brief §16: navigasi, hero, nilai produk (editorial,
bukan grid kartu), perjalanan `01–06`, preview produk, band industrial,
kemampuan, CTA penutup, footer.

- Hero: foto tapak full-bleed ke tepi viewport, dipotong diagonal, tiga callout
  bergaris penunjuk dengan label monospace. Satu sekuens orkestrasi, sekali per
  sesi (`sessionStorage`).
- Preview produk mengambil nama posisi ban dari `derivePositions` di
  `@c26/contracts` — mesin yang sama dengan yang dipakai API. `PLAN/03` §1
  melarang kode lain menyusun nama posisi, dan landing yang mengarang namanya
  sendiri akan jadi tempat pertama penamaan itu menyimpang.
- Bagian kemampuan hanya memuat hal yang benar-benar ada di kode. Tidak ada logo
  pelanggan, tidak ada angka uptime, tidak ada testimoni — belum ada yang bisa
  diisi dengan jujur.
- Gerak: CSS keyframes murni. Strip progres scroll dan parallax band memakai
  `animation-timeline` di balik `@supports`, jadi peramban yang belum mendukung
  mendapat halaman statis, bukan halaman rusak.

### Autentikasi (Fase 4)

- `AuthLayout` baru: split asimetris 5/7, foto full-bleed dengan scrim
  bergradasi, form di permukaan `--paper` maksimal 420px, sedikit di atas titik
  tengah optis. Sebelumnya kartu melayang di tengah — yang dilarang brief §27.
- Fokus input: border ke `--blue` plus garis `--amber` menyapu kiri→kanan 110ms.
- Validasi saat **blur**, bukan saat ketikan pertama.
- Caps Lock terdeteksi dan diberitahukan di bawah field password.
- Pengukur kekuatan password berbentuk **alat ukur kedalaman tapak** (5 alur).
- Kesalahan server memindahkan fokus ke dirinya sendiri.

### Aset (Fase 5)

- Pipeline: `pnpm --filter @c26/web images:fetch` lalu `images`. Turunan
  640/1280/1920 dalam AVIF, WebP, JPEG, plus placeholder blur.
- Satu grade untuk semua foto (saturasi 75%, bayangan didinginkan, ujung terang
  ditahan) supaya terbaca sebagai satu set.
- Anggaran ukuran diperiksa skrip; build gagal kalau lewat.
- `docs/image-sources.md` dan `src/lib/photo-credits.ts` **dihasilkan**, bukan
  diketik — atribusi dibaca dari metadata berkasnya sendiri.

### Utang form: lunas

`.claude/rules/web.md` mewajibkan setiap `<form>` divalidasi lewat skema
`@c26/contracts` melalui `zodResolver`. Catatan sebelumnya menyebut enam form
yang belum. Sebenarnya **delapan** — `tire-brand-patterns-page` dan
`tire-sizes-page` juga menyusun validasinya sendiri dan tidak masuk daftar.
Semuanya sudah dipindahkan:

| Berkas | Skema yang kini dipakai |
| --- | --- |
| `auth/step-up-dialog` | `totpCodeSchema` |
| `inspections/new-inspection-page` | `vehicleSearchSchema`, `createVehicleSchema` |
| `users/users-page` | `createUserSchema`, `deleteUserSchema` |
| `master-data/master-data-page` | `createProvinceSchema`, `createCitySchema`, `createBrandSchema` |
| `master-data/vehicle-brands-page` | `createVehicleBrandSchema`, `updateVehicleBrandSchema` |
| `master-data/tire-brand-patterns-page` | `createTireBrandPatternSchema`, `updateTireBrandPatternSchema` |
| `master-data/tire-sizes-page` | `createTireSizeSchema`, `updateTireSizeSchema` |
| `ops/ops-page` | `logSearchSchema` |

Satu penolong baru, `lib/form-errors.ts`: `applyFieldErrors` memindahkan galat
422 dari amplop ke field yang disebutkannya, dan `hasFieldErrors` menjaga banner
halaman tetap diam untuk galat yang sudah punya tempat. Pembagian tiga kanal di
`PLAN/05` §5.1 sekarang diputuskan sekali, bukan delapan kali.

`pnpm verify` hijau setelahnya: 551 tes, lint tanpa peringatan, empat gerbang.

---

## Cacat yang ditemukan dan diperbaiki

Semuanya ditemukan dengan menjalankan aplikasi, bukan dengan membaca kode.

| Cacat | Akibat sebelum diperbaiki |
| --- | --- |
| `bg-graphite`, `bg-amber`, `text-paper` menunjuk `--color-graphite` dkk. yang tidak pernah ada | Panel CTA penutup dan tombolnya **tidak terlihat** di peramban, sementara build tetap hijau |
| `duration-180` bukan kelas Tailwind yang ada | Semua tombol beranimasi di durasi bawaan peramban, bukan 180ms |
| Foto `truck-wheel-kumho` memuat tulisan "KUMHO", "KRS 03", "ALTEC" | Merek dagang pihak ketiga terpampang di halaman daftar. Lisensi foto tidak memberi hak merek. Foto dihapus |
| Copy halaman daftar: "Akun baru menunggu persetujuan admin" | **Tidak benar.** `register()` membuat akun dengan peran `supplier`, `isActive: true`, dan langsung memberi sesi |
| Langkah non-aktif di perjalanan `01–06` diredupkan `opacity: .55` | Teks lima dari enam langkah jatuh di bawah kontras AA |
| Tanda wajib `*` memakai token `text-danger` (token isian, bukan teks) | 3,1:1 di atas kartu gelap |
| Error field memakai `role="alert"` | Asertif — menyela pembaca layar untuk pesan yang lahir dari meninggalkan field |

Ditemukan saat memindahkan form ke `zodResolver`:

| Cacat | Akibat sebelum diperbaiki |
| --- | --- |
| `master-brand.ts` menulis `.min(2)`, `.max(120)` tanpa pesan | Begitu skema itu dipasang ke form, pengguna Indonesia akan membaca `String must contain at least 2 character(s)` — bawaan Zod, bahasa Inggris, melanggar `K-10`. Pesan ditambahkan di skema, bukan di layar, supaya server memakai kalimat yang sama |
| `createCitySchema.provinceId` memakai `.positive()` tanpa pesan | Dropdown yang belum dipilih terkirim sebagai `0` dan dijawab `Number must be greater than 0` |
| Empat tombol mati tanpa penjelasan: Verifikasi (step-up), Hapus Pengguna, Cari (log ops), Cari (plat) | Tombol yang tidak bereaksi dan tidak mengatakan sebabnya. Semua diganti pesan di bawah field — sama seperti 403 `STEP_UP_REQUIRED` yang dulu jadi jalan buntu |
| `tire-brand-patterns-page` mengirim `type` dua kali (dari dialog dan dari tab) | Tidak salah selama keduanya sama, tapi dua sumber untuk satu nilai |
| Ganti nama inline (merk kendaraan, pattern, ukuran ban) tidak divalidasi sama sekali | Nama satu huruf dikirim, ditolak server 422, dan klien tidak punya tempat menaruh jawabannya — galat jatuh ke banner halaman tanpa menunjuk field |

Ditemukan oleh sapuan aksesibilitas dan pengukuran LCP (Fase 6). Rinciannya,
dengan angka kontras dan cara mengulang, ada di `docs/redesign-report.md`:

| Cacat | Akibat sebelum diperbaiki |
| --- | --- |
| `--color-subtle` di tema terang = `--steel`, yang sebenarnya **3,75:1** di atas concrete — bukan 4,0 seperti tertulis, dan di bawah AA | Empat belas elemen di landing saja, plus footer login dan daftar, di bawah AA. Komentarnya membatasi token itu ke "teks besar dan UI"; setiap penggunanya teks 11–12px |
| `accent-text` di atas `accent-soft` di tema gelap = **4,07:1** | Pasangan ini dipakai sidebar aktif, opsi tersorot `SearchableSelect`, lencana aksen, kartu sambutan. Semuanya di bawah AA di mode gelap, dan tidak satu pun terjangkau sapuan ini — yang membuka kedok cuma kartu preview di landing |
| Kartu terpilih di preview landing memakai token netral di atas isian aksen | 3,14:1. Satu-satunya `bg-accent-soft` di aplikasi yang tidak dipasangkan dengan `text-accent-text` |
| Halaman `/__styleguide` mencetak label di atas swatch-nya | Tujuh label di bawah AA — dan `--ok` (#1E8E5A) tidak bisa diperbaiki dengan tinta apa pun: 4,14:1 terhadap putih, 4,29:1 terhadap graphite |
| Halaman `/__styleguide` menaruh komponen nyata di atas `bg-paper`/`bg-concrete` | Di mode gelap seluruh label form di sana adalah teks nyaris-putih di atas putih. Kegagalan dua sistem token yang redesign ini ada untuk menghilangkan, di halaman yang mendokumentasikan tokennya |
| `vite.config.ts` menyajikan `127.0.0.1:5573`, `playwright.config.ts` menunggu `localhost:5173` | `pnpm test:e2e` habis waktu enam puluh detik menunggu server yang sudah hidup. Inilah sebab G-11 tidak pernah berjalan |

### Resep LCP di catatan sebelumnya salah sasaran

Catatan ini pernah menulis: "Kalau meleset dari 2,5 detik, IBM Plex Mono yang
dilepas duluan." Pengukurannya menyanggah itu. Elemen yang tergambar terakhir
adalah **foto**, di ketiga rute publik — bukan teks. Melepas Plex Mono akan
menghilangkan huruf data dari seluruh aplikasi dan tidak menggerakkan angkanya.
Huruf itu tetap.

Yang dicoba sebagai gantinya: seluruh aplikasi ber-sesi dipisahkan ke satu chunk
lazy. JS awal turun **171,1 KB → 146,6 KB**, tapi LCP tidak bergerak (4,27 → 4,14
detik di `/`; derau, bukan perbaikan). Pemisahan itu dipertahankan atas alasannya
sendiri — 24,5 KB adalah sebagian besar sisa ruang anggaran `PLAN/06` §7, dan
pengunjung tanpa sesi tidak seharusnya mengunduh layar yang tidak boleh ia buka.

> Perlu keputusan Anda. Pengungkit terbesar yang tersisa adalah
> `<link rel="preload" as="image">` untuk foto LCP, tapi aplikasi disajikan dari
> satu `index.html` statis sementara foto hero berbeda antara `/` dan halaman
> auth — preload yang benar untuk `/` memboroskan 96 KB di `/login`. Pilihannya:
> HTML per rute di Caddy, menurunkan kualitas AVIF `tire-tread` (~0,4 detik di
> `/` saja), atau menerima angkanya. `PLAN/01` §4.2 memilih SPA tanpa SSR dengan
> sadar; ini harga yang dibayarkannya, terukur.

---

## Yang belum dikerjakan

### Fase 6 — QA dan pembersihan (berjalan)

- [x] ~~Audit aksesibilitas~~ untuk **halaman publik**. `pnpm test:a11y`,
      axe-core WCAG 2.1 AA, dua tema. Berkasnya
      `apps/web/e2e/accessibility.spec.ts`; ia menyetub `/api/auth/me` sendiri
      sehingga tidak butuh basis data.
- [ ] **Dua puluh layar di balik sesi belum pernah diperiksa axe.** Cacat C-02
      di laporan itu justru kelas yang hidup di sana — pasangan `accent-text`
      di atas `accent-soft` yang gagal di tema gelap dipakai sidebar,
      `SearchableSelect`, dan lencana. Menjangkaunya butuh seed, sama seperti
      G-11.
- [x] ~~Uji di lebar 360 / 768 / 1024 / 1440 / 1920~~ — 20 dari 20 lulus sejak
      pengukuran pertama, tidak ada perbaikan yang diperlukan.
- [x] ~~Ukur LCP di profil 4G~~ — **meleset di ketiga rute publik**
      (4,14 / 3,21 / 3,37 detik). Lihat catatan di bawah: resep "lepas IBM Plex
      Mono duluan" menyasar hal yang salah.
- [x] ~~`docs/redesign-report.md`~~
- [ ] `TODO-CONTENT.md`.
- [ ] Hapus rute sementara `/__styleguide` dan berkasnya. **Terakhir, bukan
      pertama**: brief §Lampiran A menaruhnya satu langkah dengan
      `docs/redesign-report.md`, dan halaman itu justru permukaan yang dipakai
      untuk audit kontras dan sapuan lebar di atasnya. Keputusan itu terbayar —
      halaman itu sendiri menyumbang dua cacat (C-04 di laporan). Ketika
      dihapus, hapus juga entrinya di `accessibility.spec.ts`.

### Berasal dari sebelum redesign, masih terbuka

- [x] ~~Enam form belum memakai `zodResolver`~~ — selesai, delapan form. Lihat
      "Utang form: lunas" di atas.
- [ ] **G-06** cakupan baris keseluruhan masih di bawah 70% (lihat
      `ACCEPTANCE/STATUS.md`). Perlu suite integrasi berbasis database.
- [ ] **G-07** skor mutasi mesin poros belum pernah dijalankan.
- [ ] **G-11** e2e alur QC belum pernah dijalankan; selektornya hampir pasti
      patah setelah perubahan DOM redesign ini. **Sebabnya sekarang diketahui
      dan sudah diperbaiki**: Vite menyajikan di `127.0.0.1:5573`, Playwright
      menunggu `localhost:5173`, jadi `pnpm test:e2e` habis waktu menunggu
      server yang sudah hidup. Keduanya kini mengimpor `apps/web/dev-server.ts`.
      Yang tersisa adalah menjalankannya dengan seed.
- [ ] Beacon Cloudflare Insights diblokir CSP. Keputusan infrastruktur pemilik.

---

## Penyimpangan dari brief yang perlu Anda ketahui

### 1. Sumber foto: Wikimedia Commons, bukan Unsplash / Pexels / Pixabay

Brief §34 mewajibkan tiga sumber itu. Ketiganya hanya menyajikan atribusi lewat
API berkunci, dan halaman fotonya menolak klien biasa (Unsplash membalas 401).
Artinya kredit dari sana hanya bisa **ditebak**, dan kredit adalah nama orang.

Commons menerbitkan metadata yang sama secara terbuka, dan Anda sudah
mengizinkannya sebagai pengganti. Skrip turunannya tidak peduli asal berkas —
kalau Anda menyediakan kunci API salah satu dari tiga sumber itu, asetnya bisa
diganti tanpa mengubah pipeline. Alasannya juga tercatat di
`docs/image-sources.md`.

### 2. Penomoran gerbang: gerbang CSP dinaikkan ke G-14

`PLAN/09` §5 sudah memakai **G-13** untuk gerbang lockfile. Gerbang CSP yang
ditambahkan selama redesign ini sempat ikut bernama G-13 — tabrakan. Karena
dokumen yang mengikat, gerbang baru itu diganti jadi **G-14**, dan `PLAN/09`
belum mencantumkannya.

> Perlu keputusan Anda: apakah G-14 dimasukkan ke tabel gerbang di `PLAN/09` §5.
> Selama belum, ia berjalan di CI tanpa dasar di dokumen mana pun.

### 3. Foto bus dipotong

Foto AKDP Probolinggo dipotong di bawah liverinya. Livery memuat nama operator
bus, dan lisensi foto tidak memberi hak atas nama itu (brief §34). Potongannya
kebetulan juga gambar yang lebih baik: roda dan jalan, bukan seluruh badan bus.
