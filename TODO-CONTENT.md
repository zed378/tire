# TODO — Konten yang Menunggu Isi Anda

Daftar setiap angka, nama, dan gambar di antarmuka yang **bukan** berasal dari
kode atau dari data nyata. Brief §3 melarang mengarang statistik, logo klien,
testimoni, dan sertifikasi; tidak satu pun dari itu ada di halaman. Yang tersisa
adalah beberapa nilai **contoh tampilan** — angka yang ada supaya sebuah komponen
punya bentuk, bukan karena ada yang mengukurnya.

Dokumen ini catatan, bukan spesifikasi. Status pengerjaan ada di `PLAN/14`,
laporan pengukuran di `docs/redesign-report.md`.

Terakhir diperbarui: **03/09/2026 WIB.**

---

## 1. Angka karangan yang masih tayang

### 1.1 Tiga callout di hero landing

`apps/web/src/features/landing/landing-hero.tsx`

```
8,4 mm   — Kedalaman tapak
120 psi  — Tekanan angin
14 bln   — Umur pakai
```

**Saya mengarangnya.** `DESIGN_PLAN.md` §self-critique butir 3 sudah mengakui itu
dan memutuskan agar ditandai `{{ISI_KLIEN: angka contoh}}` lalu dicatat di sini —
pencatatannya yang belum pernah dilakukan. Ini catatannya.

Angka-angka itu tetap masuk akal untuk ban truk (kedalaman tapak baru sekitar
14–16 mm, batas ganti 3 mm; tekanan 100–130 psi), tapi masuk akal bukan berarti
diukur.

**Yang saya butuhkan dari Anda:** tiga nilai nyata dari satu pemeriksaan yang
benar-benar pernah dilakukan — kedalaman tapak, tekanan, umur pakai — beserta
izin menampilkannya.

**Kalau Anda tidak menyediakannya:** callout menyebut **nama besaran tanpa
nilai** — "Kedalaman tapak · Tekanan angin · Umur pakai". Halaman tetap
menjelaskan apa yang sistem catat, tanpa mengklaim angka yang tidak ada. Ini
keputusan yang sudah tertulis di `DESIGN_PLAN.md`; ia hanya menunggu jawaban
Anda.

### 1.2 Kartu nomor seri di sudut hero

`apps/web/src/features/landing/landing-hero.tsx`

```
SN2026-00148
● Pass QC
```

Formatnya nyata — begitulah `PLAN/03` menyusun nomor seri. Nomornya sendiri
karangan.

**Yang saya butuhkan:** satu nomor seri nyata yang berstatus `passed_qc` dan
boleh ditampilkan publik. Nomor seri tidak memuat data pribadi, tapi ia menunjuk
ke satu kendaraan milik satu pelanggan, jadi keputusannya tetap milik Anda.

**Kalau tidak:** biarkan seperti sekarang, tapi tambahkan keterangan "contoh" di
dekatnya — seperti yang sudah dilakukan bagian preview produk (lihat 1.3).

### 1.3 Angka di preview produk — **sudah jujur, tidak perlu tindakan**

`apps/web/src/features/landing/landing-preview.tsx` menghasilkan kedalaman,
tekanan, dan umur dari `sortOrder` posisi ban. Angkanya karangan, tapi halaman
**mengatakannya sendiri**, di badan teks yang dibaca pengunjung:

> "Susunan posisi di bawah dihasilkan mesin konfigurasi poros yang sama dengan
> yang dipakai aplikasi — angkanya contoh, strukturnya nyata."

Susunan posisinya memang nyata: ia datang dari `derivePositions` di
`@c26/contracts`, mesin yang sama yang dipakai API.

Ini pola yang saya sarankan untuk 1.1 dan 1.2 kalau Anda tidak punya angka
nyata: bukan menyembunyikan bahwa itu contoh, melainkan menuliskannya.

---

## 2. Yang sengaja kosong, dan tidak boleh diisi sembarangan

Bagian-bagian ini biasanya dipenuhi klaim di situs sejenis. Semuanya dibiarkan
kosong karena belum ada yang bisa diisi dengan jujur.

| Bagian | Kenapa kosong |
| --- | --- |
| Logo pelanggan | Tidak ada izin pemakaian merek dari siapa pun |
| Angka uptime / SLA | Sistem belum berjalan di produksi cukup lama untuk punya angka |
| Testimoni | Belum ada pengguna yang memberikannya |
| Sertifikasi (ISO, SOC 2, dll.) | Tidak ada |
| Jumlah pengguna / armada / pemeriksaan | Belum ada angka nyata |
| Perbandingan "umur ban dipantau vs tidak" | Ada di draf copy `DESIGN_PLAN.md` §8, **tidak** pernah masuk halaman. Angka ini butuh studi, bukan taksiran |

Bagian "kemampuan" di landing hanya memuat hal yang benar-benar ada di kode.
Kalau nanti sebuah angka tersedia, ia masuk lewat daftar ini — bukan lewat
tebakan yang enak dibaca.

---

## 3. Aset gambar

Ketiga foto sudah nyata, dari Wikimedia Commons, dengan atribusi yang
**dihasilkan dari metadata berkasnya sendiri** — bukan diketik. Lihat
`docs/image-sources.md`.

Satu penyimpangan yang perlu Anda ketahui, sudah tercatat di `PLAN/14`: brief §34
mewajibkan Unsplash / Pexels / Pixabay. Ketiganya hanya menyajikan atribusi lewat
API berkunci, jadi kreditnya hanya bisa ditebak — dan kredit adalah nama orang.

**Kalau Anda menyediakan kunci API salah satu dari tiga sumber itu**, asetnya
bisa diganti tanpa mengubah pipeline: `pnpm --filter @c26/web images:fetch` lalu
`images`.

Dua batasan yang berlaku untuk foto pengganti apa pun:

- **Tidak boleh ada merek dagang pihak ketiga yang terbaca.** Satu foto sudah
  dibuang karena memuat tulisan "KUMHO"; lisensi foto tidak memberi hak atas
  merek. Foto bus AKDP dipotong di bawah liverinya karena alasan yang sama.
- **Tidak boleh ada plat nomor terbaca atau wajah teridentifikasi.**

---

## 4. Teks hukum dan kontak — belum ada sama sekali

Footer landing tidak memuat satu pun dari ini, dan sebuah sistem yang menyimpan
data operasional pelanggan biasanya memerlukannya:

- [ ] Nama badan hukum dan alamat terdaftar
- [ ] Kontak yang bisa dihubungi (surel atau telepon)
- [ ] Kebijakan privasi — sistem ini menyimpan nama, surel, nomor telepon, dan
      foto yang diambil di lokasi pelanggan
- [ ] Ketentuan penggunaan

Saya tidak menambahkan tautan kosong. Tautan ke halaman yang tidak ada lebih
buruk daripada tidak ada tautan: ia menjanjikan sesuatu yang tidak ditepati.

**Perlu keputusan Anda:** apakah keempatnya diperlukan sebelum sistem dibuka ke
pengguna di luar organisasi Anda. Kalau ya, ini pekerjaan hukum, bukan pekerjaan
desain — halamannya bisa saya siapkan begitu isinya ada.
