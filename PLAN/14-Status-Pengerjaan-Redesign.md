# 14 — Status Pengerjaan: Redesign UI/UX

**Dokumen ini catatan, bukan spesifikasi.** Berkas `00`–`13` mengikat; berkas ini
hanya melaporkan apa yang sudah dikerjakan terhadap keduanya. Kalau isinya
bertabrakan dengan `00`–`13`, yang mengikat tetap `00`–`13`.

Brief redesign ada di `docs/design-brief.md` (MASTER PROMPT v2). Ia menggantikan
`prompt-redesign-ui-ux-commercial-2026.md` seluruhnya. Rencana desain turunannya
ada di `DESIGN_PLAN.md`.

Terakhir diperbarui: **03/09/2026 WIB.**

> Perubahan sejak catatan pertama hari ini: utang `zodResolver` lunas — delapan
> form, bukan enam. Rinciannya di bawah, di bagian "Utang form: lunas".

---

## Ringkasan

| Fase (brief Lampiran A) | Status |
| --- | --- |
| 1 — Audit & DESIGN_PLAN | Selesai |
| 2 — Fondasi token, tipografi | Selesai |
| 3 — Landing page | Selesai |
| 4 — Login & Register | Selesai |
| 5 — Aset gambar | Selesai, dengan satu penyimpangan sumber (lihat di bawah) |
| 6 — QA, aksesibilitas, pembersihan | **Belum** |

Kondisi terukur saat ini:

- `pnpm verify` **hijau** — typecheck, lint, 551 tes, dan empat gerbang statis.
- Bundel JS awal **169,3 KB** dari plafon 180 KB (G-12).
- CSS **11,2 KB** gzip.

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

---

## Yang belum dikerjakan

### Fase 6 — QA dan pembersihan (belum mulai)

- [ ] Audit aksesibilitas menyeluruh: urutan fokus, landmark, kontras seluruh
      halaman di kedua tema.
- [ ] Uji di lebar 360 / 768 / 1024 / 1440 / 1920.
- [ ] Ukur LCP di profil 4G. Kalau meleset dari 2,5 detik, IBM Plex Mono yang
      dilepas duluan.
- [ ] `docs/redesign-report.md` dan `TODO-CONTENT.md`.
- [ ] Hapus rute sementara `/__styleguide` dan berkasnya. **Terakhir, bukan
      pertama**: brief §Lampiran A menaruhnya satu langkah dengan
      `docs/redesign-report.md`, dan halaman itu justru permukaan yang dipakai
      untuk audit kontras dan sapuan lebar di atasnya. Catatan sebelumnya
      menempatkannya di urutan pertama; urutan brief yang dipakai.

### Berasal dari sebelum redesign, masih terbuka

- [x] ~~Enam form belum memakai `zodResolver`~~ — selesai, delapan form. Lihat
      "Utang form: lunas" di atas.
- [ ] **G-06** cakupan baris keseluruhan masih di bawah 70% (lihat
      `ACCEPTANCE/STATUS.md`). Perlu suite integrasi berbasis database.
- [ ] **G-07** skor mutasi mesin poros belum pernah dijalankan.
- [ ] **G-11** e2e alur QC belum pernah dijalankan; selektornya hampir pasti
      patah setelah perubahan DOM redesign ini.
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
