/**
 * Downloads the photographic originals and reads their attribution.
 *
 * Run with `pnpm --filter @c26/web images:fetch`, then `images` to build the
 * derivatives. The originals land in `public/img/source/`, which is gitignored:
 * they are several megabytes each and nothing serves them.
 *
 * THE ATTRIBUTION IS READ, NOT TYPED. Author, licence and licence URL come out
 * of each file's own `extmetadata` on the Commons API and are written straight
 * into `docs/image-sources.md`. A credit is somebody's name, and a name written
 * from memory is a name invented.
 *
 * ON THE SOURCE: brief §34 names Unsplash, Pexels and Pixabay. All three serve
 * their attribution only through APIs that need an access key, and their photo
 * pages refuse an ordinary client — so a credit taken from them could not be
 * verified here, only guessed. Wikimedia Commons publishes the same metadata
 * openly, and the owner allowed it where the required three do not work out.
 * If a key is provided later, the assets can be re-sourced; the pipeline below
 * does not care where the files came from.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "Commercial2026/1.0 (tire data system; asset sourcing)";
const SOURCE_DIR = path.resolve(import.meta.dirname, "../public/img/source");
const DOC = path.resolve(import.meta.dirname, "../../../docs/image-sources.md");

interface Wanted {
  /** Commons file title. */
  title: string;
  /** Output basename — must match `process-images.ts`. */
  name: string;
  /** Local filename in `public/img/source/`. */
  file: string;
  usage: string;
}

const WANTED: readonly Wanted[] = [
  {
    title: "File:Texture - tire tread (30784753).jpg",
    name: "tire-tread",
    file: "tire-tread-texture.jpg",
    usage: "Hero landing — makro alur tapak, full-bleed ke tepi kanan viewport",
  },
  {
    title: "File:Truck tires.JPG",
    name: "tire-stack",
    file: "truck-tires-stacked.jpg",
    usage: "Panel visual halaman daftar; band industrial di landing",
  },
  {
    title: "File:AKDP BUS PROBOLINGGO JAVA INDONESIA APRIL 2010.jpg",
    name: "depot",
    file: "bus-akdp-probolinggo.jpg",
    usage: "Panel visual halaman masuk (dipotong di bawah livery)",
  },
];

interface Meta {
  name: string;
  file: string;
  usage: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * A polite GET.
 *
 * Commons rate-limits, and it is entitled to: this is a free service being
 * asked for multi-megabyte files. On a 429 it says how long to wait, so the
 * script waits that long rather than hammering — and pauses between files even
 * when nothing has complained.
 */
async function politeFetch(url: string, attempt = 1): Promise<Response> {
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (response.status !== 429 || attempt > 4) return response;

  const header = Number(response.headers.get("retry-after"));
  const waitMs = Number.isFinite(header) && header > 0 ? header * 1000 : attempt * 5000;
  console.log(`  rate limited, waiting ${String(Math.round(waitMs / 1000))}s…`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return politeFetch(url, attempt + 1);
}

function plain(html: string | undefined): string {
  if (html === undefined) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOne(wanted: Wanted): Promise<Meta> {
  const url =
    `${API}?action=query&format=json&titles=${encodeURIComponent(wanted.title)}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata`;

  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`${wanted.title}: API ${String(response.status)}`);

  const json = (await response.json()) as {
    query: { pages: Record<string, { title: string; imageinfo?: unknown[] }> };
  };

  const page = Object.values(json.query.pages)[0];
  const info = page?.imageinfo?.[0] as
    | {
        url: string;
        descriptionurl: string;
        width: number;
        height: number;
        extmetadata?: Record<string, { value?: string }>;
      }
    | undefined;

  if (info === undefined) throw new Error(`${wanted.title}: not found on Commons`);

  const em = info.extmetadata ?? {};
  const license = plain(em["LicenseShortName"]?.value) || "tidak diketahui";

  // A file whose licence cannot be read is a file that does not get used.
  if (license === "tidak diketahui") {
    throw new Error(`${wanted.title}: no licence in metadata — refusing to use it`);
  }

  const binary = await politeFetch(info.url);
  if (!binary.ok) throw new Error(`${wanted.title}: download ${String(binary.status)}`);
  const buffer = Buffer.from(await binary.arrayBuffer());
  await writeFile(path.join(SOURCE_DIR, wanted.file), buffer);

  return {
    name: wanted.name,
    file: wanted.file,
    usage: wanted.usage,
    title: page?.title ?? wanted.title,
    author: plain(em["Artist"]?.value) || "tidak disebutkan",
    license,
    licenseUrl: plain(em["LicenseUrl"]?.value),
    sourceUrl: info.descriptionurl,
    width: info.width,
    height: info.height,
    bytes: buffer.byteLength,
  };
}

await mkdir(SOURCE_DIR, { recursive: true });

const collected: Meta[] = [];
for (const [index, wanted] of WANTED.entries()) {
  // A second between files. Nothing here is urgent, and the alternative is
  // being rate-limited into a retry that takes far longer.
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
  const meta = await fetchOne(wanted);
  collected.push(meta);
  console.log(
    `${meta.file}  ${String(meta.width)}x${String(meta.height)}  ${meta.license}  ${meta.author}`,
  );
}

const today = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date());

const doc = `# Sumber gambar

Dihasilkan oleh \`apps/web/scripts/fetch-images.ts\`. Jangan disunting tangan —
setiap baris di bawah dibaca dari metadata berkasnya sendiri di Wikimedia
Commons, bukan ditulis dari ingatan.

Berkas asli ada di \`apps/web/public/img/source/\` dan **tidak** ikut di-commit
(ukurannya beberapa MB dan tidak ada yang menyajikannya). Jalankan
\`pnpm --filter @c26/web images:fetch\` untuk mengambilnya kembali, lalu
\`pnpm --filter @c26/web images\` untuk membangun turunannya.

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
  \`img-src 'self'\` (PLAN/13 §7), jadi hotlink memang akan diblokir peramban.

## Daftar aset

${collected
  .map(
    (m) => `### \`${m.file}\`

| | |
| --- | --- |
| Platform | Wikimedia Commons |
| Berkas | ${m.title} |
| Fotografer / kontributor | ${m.author} |
| Lisensi | ${m.license}${m.licenseUrl === "" ? "" : ` — ${m.licenseUrl}`} |
| Halaman sumber | ${m.sourceUrl} |
| Ukuran asli | ${String(m.width)} × ${String(m.height)} px, ${(m.bytes / 1024 / 1024).toFixed(1)} MB |
| Dipakai untuk | ${m.usage} |
| Tanggal unduh | ${today} |
`,
  )
  .join("\n")}
## Pemrosesan

Satu grade yang sama untuk semua foto (brief §36.4): saturasi 75%, titik hitam
diangkat ke nada dingin, ujung terang ditahan agar tidak terpotong. Itu yang
membuat kumpulan foto terbaca sebagai satu set, bukan sebagai stok acak.

Turunan: 640 / 1280 / 1920 px dalam AVIF, WebP, dan JPEG. Placeholder blur 16px
disimpan sebagai data URI. Lihat \`apps/web/scripts/process-images.ts\`.
`;

await writeFile(DOC, doc);

/*
 * The credits the interface itself renders, from the same metadata as the
 * document above.
 *
 * Generated rather than hand-written for one reason: CC BY and CC BY-SA
 * require the author's name, and a name typed from memory is a name invented.
 * Swap a photograph and its credit changes with it, instead of quietly
 * describing the previous picture.
 */
const credits = [
  "/**",
  " * GENERATED by `scripts/fetch-images.ts`. Do not edit.",
  " *",
  " * Attribution read from each file's own metadata on Wikimedia Commons.",
  " * CC BY and CC BY-SA both require the author, the licence, and a link back,",
  " * so these are a condition of use, not decoration.",
  " */",
  "",
  "export interface PhotoCredit {",
  "  readonly author: string;",
  "  readonly license: string;",
  "  /** Empty for public domain, which has no deed to link. */",
  "  readonly licenseUrl: string;",
  "  readonly sourceUrl: string;",
  "}",
  "",
  "export const PHOTO_CREDITS = {",
  ...collected.map(
    (m) =>
      `  "${m.name}": {\n` +
      `    author: ${JSON.stringify(m.author)},\n` +
      `    license: ${JSON.stringify(m.license)},\n` +
      `    licenseUrl: ${JSON.stringify(m.licenseUrl)},\n` +
      `    sourceUrl: ${JSON.stringify(m.sourceUrl)},\n` +
      `  },`,
  ),
  "} as const satisfies Record<string, PhotoCredit>;",
  "",
].join("\n");

await writeFile(path.resolve(import.meta.dirname, "../src/lib/photo-credits.ts"), credits);

console.log(`\n${DOC} written (${String(collected.length)} assets).`);
console.log("Wrote src/lib/photo-credits.ts");
