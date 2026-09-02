# Sumber gambar

Dihasilkan oleh `apps/web/scripts/fetch-images.ts`. Jangan disunting tangan —
setiap baris di bawah dibaca dari metadata berkasnya sendiri di Wikimedia
Commons, bukan ditulis dari ingatan.

Berkas asli ada di `apps/web/public/img/source/` dan **tidak** ikut di-commit
(ukurannya beberapa MB dan tidak ada yang menyajikannya). Jalankan
`pnpm --filter @c26/web images:fetch` untuk mengambilnya kembali, lalu
`pnpm --filter @c26/web images` untuk membangun turunannya.

## Kenapa Wikimedia Commons, bukan Unsplash / Pexels / Pixabay

Brief §34 menyebut tiga sumber itu. Ketiganya hanya menyajikan atribusi lewat
API yang memerlukan kunci akses, dan halaman fotonya menolak klien biasa —
sehingga kredit dari sana hanya bisa ditebak, tidak bisa diverifikasi. Commons
menerbitkan metadata yang sama secara terbuka. Pemilik proyek mengizinkan
Commons sebagai sumber pengganti. Kalau kunci API disediakan, aset bisa
diganti sumbernya; skrip pembangun turunannya tidak peduli asal berkas.

## Batasan yang dipatuhi

- Tidak ada logo merek, tulisan merek ban, atau tanda perusahaan yang terbaca.
  Lisensi foto tidak memberi hak atas merek dagang. Foto bus dipotong di bawah
  liverinya justru karena alasan ini.
- Tidak ada wajah yang bisa dikenali di hero maupun panel autentikasi.
- Berkas tidak dijual ulang atau disebarkan dalam bentuk aslinya.
- Tidak ada hotlink. Semua turunan disajikan dari origin sendiri — CSP-nya
  `img-src 'self'` (PLAN/13 §7), jadi hotlink memang akan diblokir peramban.

## Daftar aset

### `tire-tread-texture.jpg`

| | |
| --- | --- |
| Platform | Wikimedia Commons |
| Berkas | File:Texture - tire tread (30784753).jpg |
| Fotografer / kontributor | Lee Coursey from Decatur, GA |
| Lisensi | CC BY 2.0 — https://creativecommons.org/licenses/by/2.0 |
| Halaman sumber | https://commons.wikimedia.org/wiki/File:Texture_-_tire_tread_(30784753).jpg |
| Ukuran asli | 1280 × 914 px, 0.3 MB |
| Dipakai untuk | Hero landing — makro alur tapak, full-bleed ke tepi kanan viewport |
| Tanggal unduh | 03/09/2026 |

### `truck-tires-stacked.jpg`

| | |
| --- | --- |
| Platform | Wikimedia Commons |
| Berkas | File:Truck tires.JPG |
| Fotografer / kontributor | Biso |
| Lisensi | CC BY 3.0 — https://creativecommons.org/licenses/by/3.0 |
| Halaman sumber | https://commons.wikimedia.org/wiki/File:Truck_tires.JPG |
| Ukuran asli | 2592 × 1944 px, 1.4 MB |
| Dipakai untuk | Panel visual halaman daftar; band industrial di landing |
| Tanggal unduh | 03/09/2026 |

### `bus-akdp-probolinggo.jpg`

| | |
| --- | --- |
| Platform | Wikimedia Commons |
| Berkas | File:AKDP BUS PROBOLINGGO JAVA INDONESIA APRIL 2010.jpg |
| Fotografer / kontributor | THE STEPHEN J MASON PHOTOGRAPHY COLLECTION |
| Lisensi | CC BY-SA 2.0 — https://creativecommons.org/licenses/by-sa/2.0 |
| Halaman sumber | https://commons.wikimedia.org/wiki/File:AKDP_BUS_PROBOLINGGO_JAVA_INDONESIA_APRIL_2010.jpg |
| Ukuran asli | 3648 × 2736 px, 6.6 MB |
| Dipakai untuk | Panel visual halaman masuk (dipotong di bawah livery) |
| Tanggal unduh | 03/09/2026 |

## Pemrosesan

Satu grade yang sama untuk semua foto (brief §36.4): saturasi 75%, titik hitam
diangkat ke nada dingin, ujung terang ditahan agar tidak terpotong. Itu yang
membuat kumpulan foto terbaca sebagai satu set, bukan sebagai stok acak.

Turunan: 640 / 1280 / 1920 px dalam AVIF, WebP, dan JPEG. Placeholder blur 16px
disimpan sebagai data URI. Lihat `apps/web/scripts/process-images.ts`.
