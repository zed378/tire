/**
 * Turns the downloaded originals into the derivatives the site actually serves.
 *
 * Run with `pnpm --filter @c26/web images`. It is deterministic: same sources
 * in, same files out, so re-running it after changing the grade regenerates
 * everything consistently rather than leaving a mixed set behind.
 *
 * WHY THE ORIGINALS ARE NOT COMMITTED: they are 3–8 MB each and nothing serves
 * them. `public/img/source/` is gitignored; `scripts/fetch-images.ts` pulls them
 * back from Wikimedia Commons when they are needed again.
 *
 * THE GRADE (brief §36.4) is the same for every photograph, and that is the
 * point. Assorted stock photography reads as assorted stock photography no
 * matter how good each individual frame is; one consistent grade is what makes
 * a set look commissioned. Here: desaturate to 75%, lift the black point onto a
 * cool tone, and pull the top end down a little so highlights stop clipping.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = path.resolve(import.meta.dirname, "../public/img/source");
const OUT_DIR = path.resolve(import.meta.dirname, "../public/img");

const WIDTHS = [640, 1280, 1920] as const;

interface Asset {
  /** Output basename. */
  name: string;
  /** File in `public/img/source/`. */
  source: string;
  /**
   * Crop as fractions of the original, applied before resizing.
   *
   * These are art direction, not convenience. The bus is cropped below its
   * livery because a photo licence grants no right to the operator's name
   * (brief §34), and the crop that removes it happens also to be the better
   * picture: wheels and road rather than a whole coach.
   */
  crop?: { left: number; top: number; width: number; height: number };
  /** Target aspect for the slot this fills. */
  aspect: number;
  /** Largest AVIF allowed at 1920, in KB (brief §36.3). */
  budgetKb: number;
}

const ASSETS: readonly Asset[] = [
  {
    name: "tire-tread",
    source: "tire-tread-texture.jpg",
    aspect: 3 / 4,
    budgetKb: 180,
  },
  {
    name: "tire-stack",
    source: "truck-tires-stacked.jpg",
    aspect: 3 / 4,
    budgetKb: 120,
  },
  {
    name: "depot",
    source: "bus-akdp-probolinggo.jpg",
    // Lower half only: the livery lettering sits across the upper body.
    crop: { left: 0, top: 0.42, width: 1, height: 0.58 },
    aspect: 16 / 9,
    budgetKb: 120,
  },
];

/** The one grade, applied to every photograph. */
function grade(image: sharp.Sharp): sharp.Sharp {
  return image
    .modulate({ saturation: 0.75 })
    .linear(0.94, 6)
    .composite([
      {
        // Per-channel `lighten` against a very dark blue raises anything below
        // it toward that tone — which touches the shadows and leaves the rest
        // alone. That is the cool shadow lift, without a tone curve.
        input: { create: { width: 8, height: 8, channels: 3, background: "#0d1118" } },
        blend: "lighten",
        tile: true,
      },
    ]);
}

async function build(asset: Asset): Promise<string[]> {
  const lines: string[] = [];
  const input = await readFile(path.join(SOURCE_DIR, asset.source));
  const meta = await sharp(input).metadata();
  const sw = meta.width ?? 0;
  const sh = meta.height ?? 0;
  if (sw === 0 || sh === 0) throw new Error(`${asset.source}: no dimensions`);

  /*
   * Never ask for more pixels than the source has.
   *
   * The tread macro is 1280px wide on Commons. Resizing it to 1920 does not
   * recover detail that was never there — it produces a soft image in a larger
   * file, and `srcset` would then hand that larger file to the very devices
   * best able to see how soft it is. The widths are capped at the source, and
   * the component's `srcset` lists only what actually exists.
   */
  const cropWidth = asset.crop === undefined ? sw : Math.round(asset.crop.width * sw);
  const widths = WIDTHS.filter((w) => w <= cropWidth);
  if (widths.length === 0) throw new Error(`${asset.source}: narrower than ${String(WIDTHS[0])}px`);

  for (const width of widths) {
    const height = Math.round(width / asset.aspect);

    for (const format of ["avif", "webp", "jpeg"] as const) {
      let pipeline = sharp(input);

      if (asset.crop !== undefined) {
        pipeline = pipeline.extract({
          left: Math.round(asset.crop.left * sw),
          top: Math.round(asset.crop.top * sh),
          width: Math.round(asset.crop.width * sw),
          height: Math.round(asset.crop.height * sh),
        });
      }

      pipeline = grade(pipeline).resize(width, height, { fit: "cover", position: "centre" });

      /*
       * Quality falls as the image grows.
       *
       * A tread macro is almost entirely fine grain, which is the worst case
       * for every codec — at a flat quality the 1280 file came out at 227 KB in
       * WebP. Larger renditions are also seen at lower magnification, so they
       * tolerate more compression: the artefacts land in texture that was
       * already noise. Every one of these photographs is desaturated and sits
       * behind type or a scrim, which buys more room again.
       */
      const step = width >= 1920 ? 2 : width >= 1280 ? 1 : 0;
      const buffer =
        format === "avif"
          ? await pipeline
              .avif({ quality: [46, 38, 32][step] ?? 38, effort: 7 })
              .toBuffer()
          : format === "webp"
            ? await pipeline.webp({ quality: [70, 62, 56][step] ?? 62 }).toBuffer()
            : await pipeline
                .jpeg({ quality: [74, 66, 60][step] ?? 66, mozjpeg: true })
                .toBuffer();

      const ext = format === "jpeg" ? "jpg" : format;
      const file = `${asset.name}-${String(width)}.${ext}`;
      await writeFile(path.join(OUT_DIR, file), buffer);

      const kb = buffer.byteLength / 1024;
      lines.push(`  ${file.padEnd(28)} ${kb.toFixed(1).padStart(7)} KB`);

      if (format === "avif" && width === widths[widths.length - 1] && kb > asset.budgetKb) {
        throw new Error(
          `${file} is ${kb.toFixed(1)} KB, over the ${String(asset.budgetKb)} KB budget`,
        );
      }
    }
  }

  /*
   * The blur placeholder: a 16px AVIF.
   *
   * IT IS EMITTED AS A CSS CLASS, NOT AN INLINE STYLE. The obvious way to do a
   * LQIP is a `style` attribute carrying a `background-image` data URI, and
   * under this CSP that renders nothing at all — `style-src 'self'` refuses
   * style attributes, and gate G-14 fails the build on one. A generated
   * stylesheet served from our own origin is allowed, so they go there.
   */
  let lqip = sharp(input);
  if (asset.crop !== undefined) {
    lqip = lqip.extract({
      left: Math.round(asset.crop.left * sw),
      top: Math.round(asset.crop.top * sh),
      width: Math.round(asset.crop.width * sw),
      height: Math.round(asset.crop.height * sh),
    });
  }
  const placeholder = await grade(lqip)
    .resize(16, Math.max(1, Math.round(16 / asset.aspect)), { fit: "cover" })
    .avif({ quality: 30 })
    .toBuffer();

  lines.push(
    `  ${`${asset.name} LQIP`.padEnd(28)} ${(placeholder.byteLength / 1024).toFixed(1).padStart(7)} KB`,
  );

  generated.push({
    name: asset.name,
    widths,
    aspect: asset.aspect,
    lqip: `data:image/avif;base64,${placeholder.toString("base64")}`,
  });

  return lines;
}

interface Generated {
  name: string;
  widths: readonly number[];
  aspect: number;
  lqip: string;
}

const generated: Generated[] = [];

await mkdir(OUT_DIR, { recursive: true });

for (const asset of ASSETS) {
  console.log(`\n${asset.name}  <- ${asset.source}`);
  for (const line of await build(asset)) console.log(line);
}

/*
 * Two generated files, both committed — the build needs them, and regenerating
 * them requires the originals, which are not committed.
 */
const manifest = [
  "/**",
  " * GENERATED by `scripts/process-images.ts`. Do not edit.",
  " *",
  " * Which renditions exist for each photograph. `Photo` builds its `srcset`",
  " * from this rather than from a guess, so it never offers a file that was not",
  " * produced — the tread macro stops at 1280 because its source does.",
  " */",
  "",
  "export interface PhotoManifest {",
  "  readonly widths: readonly number[];",
  "  /** width / height */",
  "  readonly aspect: number;",
  "}",
  "",
  "export const PHOTOS = {",
  ...generated.map(
    (g) => `  "${g.name}": { widths: [${g.widths.join(", ")}], aspect: ${g.aspect.toFixed(6)} },`,
  ),
  "} as const satisfies Record<string, PhotoManifest>;",
  "",
  "export type PhotoName = keyof typeof PHOTOS;",
  "",
].join("\n");

await writeFile(path.resolve(import.meta.dirname, "../src/lib/photo-manifest.ts"), manifest);

const css = [
  "/*",
  " * GENERATED by `scripts/process-images.ts`. Do not edit.",
  " *",
  " * Blur placeholders, one class per photograph. They live in a stylesheet",
  " * rather than in a `style` attribute because the CSP is `style-src 'self'`",
  " * with no 'unsafe-inline' (PLAN/13 §7): an inline background-image would not",
  " * render at all, and gate G-14 fails the build on one.",
  " */",
  "",
  ...generated.map(
    (g) =>
      `.lqip-${g.name} {\n  background-image: url("${g.lqip}");\n  background-size: cover;\n  background-position: center;\n}\n`,
  ),
].join("\n");

await writeFile(path.resolve(import.meta.dirname, "../src/styles/lqip.css"), css);

console.log("\nAll derivatives within budget.");
console.log("Wrote src/lib/photo-manifest.ts and src/styles/lqip.css");
