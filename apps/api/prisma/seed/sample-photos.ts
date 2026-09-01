import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { buildStorageKey, type PhotoSlot } from "@c26/contracts";
import { putObject } from "../../src/kernel/storage/index.ts";

/**
 * Generates and stores sample photographs for the demo data.
 *
 * Real images rather than placeholder bytes, because the thing being exercised
 * is the QC gallery: a reviewer looking at 6 to 22 named positions needs to see
 * that each slot is labelled with the right position, and a grid of identical
 * grey squares proves nothing about that.
 *
 * Each image carries its own position label, so a mismatch between the photo and
 * the slot it sits in is visible at a glance — which is exactly the failure mode
 * K-02 exists to prevent.
 */

const PALETTE = [
  { background: "#1e293b", accent: "#38bdf8" },
  { background: "#292524", accent: "#fbbf24" },
  { background: "#1c1917", accent: "#a3e635" },
  { background: "#0f172a", accent: "#f472b6" },
];

function svgFor(label: string, sublabel: string, index: number): string {
  const colours = PALETTE[index % PALETTE.length]!;

  // A tyre-ish shape plus the position label. Deliberately synthetic: nobody
  // should mistake demo data for a real inspection photograph.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <rect width="1200" height="900" fill="${colours.background}"/>
  <g transform="translate(600,420)">
    <circle r="300" fill="none" stroke="${colours.accent}" stroke-width="70" opacity="0.35"/>
    <circle r="300" fill="none" stroke="${colours.accent}" stroke-width="8"/>
    <circle r="150" fill="none" stroke="${colours.accent}" stroke-width="8"/>
    <circle r="40" fill="${colours.accent}" opacity="0.8"/>
  </g>
  <rect x="0" y="760" width="1200" height="140" fill="rgba(0,0,0,0.55)"/>
  <text x="60" y="822" font-family="sans-serif" font-size="52" font-weight="700" fill="#ffffff">${label}</text>
  <text x="60" y="872" font-family="sans-serif" font-size="30" fill="${colours.accent}">${sublabel} — CONTOH / DATA DEMO</text>
</svg>`;
}

export interface GeneratedPhoto {
  storageKey: string;
  checksumSha256: string;
  byteSize: number;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Renders one image and writes it through the storage driver.
 *
 * Uses the same compression profile the device applies (PLAN/06 §3): longest
 * edge 1600 px, WebP at quality 0.78. Demo data that is an order of magnitude
 * larger than real data would give a misleading impression of storage growth.
 */
export async function generateSamplePhoto(params: {
  year: number;
  serialNumber: string;
  slot: PhotoSlot;
  positionCode: string | null;
  label: string;
  sublabel: string;
  index: number;
}): Promise<GeneratedPhoto> {
  const svg = svgFor(params.label, params.sublabel, params.index);

  const body = await sharp(Buffer.from(svg))
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const metadata = await sharp(body).metadata();

  const storageKey = buildStorageKey({
    year: params.year,
    serialNumber: params.serialNumber,
    slot: params.slot,
    // Built from the position CODE, never the Indonesian label — the legacy
    // system used the label as its Drive path, which made a wording fix in the
    // UI a risk to photo matching (PLAN/03 §2.3).
    positionCode: params.positionCode,
    uuid: randomUUID(),
    mimeType: "image/webp",
  });

  await putObject({ storageKey, body, mimeType: "image/webp" });

  return {
    storageKey,
    // The same checksum the device computes before upload. It is what makes a
    // retry from the offline queue idempotent (PLAN/06 §4.1).
    checksumSha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.length,
    mimeType: "image/webp",
    width: metadata.width ?? 1600,
    height: metadata.height ?? 1200,
  };
}
