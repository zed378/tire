import {
  MAX_PHOTO_BYTES,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE_PX,
  PHOTO_WEBP_QUALITY,
  type PhotoMimeType,
} from "@c26/contracts";

/**
 * On-device compression (PLAN/06 §3).
 *
 * A modern phone camera produces 3–8 MB per photograph. Fifteen of those over a
 * field 4G connection is 60–120 MB per vehicle — unacceptable both for the
 * worker's data allowance and for the storage bill.
 *
 * Target: longest edge 1,920 px, WebP at quality 0.78, landing at 400–700 KB.
 * That is enough to read the brand, the pattern, and the state of the tread,
 * which is what the photograph is for.
 */

export interface CompressedPhoto {
  blob: Blob;
  mimeType: PhotoMimeType;
  width: number;
  height: number;
  checksumSha256: string;
  /** From EXIF where the browser exposes it. Time only — GPS is discarded. */
  capturedAt: string | null;
  originalBytes: number;
}

function scaleToFit(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= PHOTO_MAX_EDGE_PX) return { width, height };

  const ratio = PHOTO_MAX_EDGE_PX / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

async function supportsWebp(): Promise<boolean> {
  if (typeof OffscreenCanvas === "undefined") return false;
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const blob = await canvas.convertToBlob({ type: "image/webp" });
    return blob.type === "image/webp";
  } catch {
    return false;
  }
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads the EXIF capture time and nothing else.
 *
 * PLAN/06 §3.1 recommendation: keep the time, drop GPS. The value of a
 * photograph here is proving the condition of a tire, not the whereabouts of the
 * person holding the camera — and recording every field worker's coordinates all
 * day is personal-data collection that would need a legal basis, a notice, and a
 * retention policy nobody has asked for.
 *
 * Re-encoding through a canvas strips all metadata anyway; this reads the value
 * before that happens so it can be stored in the one column that wants it.
 *
 * The value comes from the device clock, which a user can change. Weak evidence,
 * never the sole basis of a dispute.
 */
async function readCaptureTime(file: File): Promise<string | null> {
  try {
    const header = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(header);

    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) break;

      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);

      if (marker === 0xe1) {
        const text = new TextDecoder("ascii").decode(
          new Uint8Array(header, offset + 4, Math.min(size, view.byteLength - offset - 4)),
        );
        // EXIF stores it as `YYYY:MM:DD HH:MM:SS`.
        const match = text.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (match !== null) {
          const [, year, month, day, hour, minute, second] = match;
          return new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`,
          ).toISOString();
        }
        return null;
      }

      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compresses one photograph.
 *
 * Uses `createImageBitmap` and `OffscreenCanvas` so decoding and re-encoding
 * happen off the main thread where the browser allows it — a frozen UI while a
 * 8 MB photo is processed reads as a crash to somebody standing next to a truck.
 */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const capturedAt = await readCaptureTime(file);

  const bitmap = await createImageBitmap(file);
  const size = scaleToFit(bitmap.width, bitmap.height);

  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2d canvas context unavailable");

  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const useWebp = await supportsWebp();
  const mimeType: PhotoMimeType = useWebp ? "image/webp" : "image/jpeg";
  const quality = useWebp ? PHOTO_WEBP_QUALITY : PHOTO_JPEG_QUALITY;

  let blob = await canvas.convertToBlob({ type: mimeType, quality });

  // A photograph of a very detailed tread can still land above the cap. Rather
  // than rejecting work the user has already done, step the quality down once.
  if (blob.size > MAX_PHOTO_BYTES) {
    blob = await canvas.convertToBlob({ type: mimeType, quality: quality * 0.75 });
  }

  if (blob.size > MAX_PHOTO_BYTES) {
    throw new Error("Foto masih terlalu besar setelah dikompresi. Coba ambil ulang.");
  }

  return {
    blob,
    mimeType,
    width: size.width,
    height: size.height,
    checksumSha256: await sha256Hex(blob),
    capturedAt,
    originalBytes: file.size,
  };
}
