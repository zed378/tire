/**
 * The storage driver interface (PLAN/05 §7).
 *
 * Two implementations sit behind it: `local`, which writes to a directory on
 * disk and serves the bytes through this API with short-lived signed tokens,
 * and `s3`, which talks to Cloudflare R2.
 *
 * The client-side protocol is identical for both — presign, PUT to the returned
 * URL, confirm — so the device code never learns which one is in use, and moving
 * to R2 when volume justifies it (PLAN/01 §4.2 explains why R2 rather than S3:
 * free egress, and QC opens the same photos repeatedly) changes one environment
 * variable rather than any upload logic.
 */

export interface PresignedUpload {
  url: string;
  expiresAt: Date;
}

export interface DownloadOptions {
  ttlSeconds?: number;
  /**
   * When set, the browser is told to save the file under this name rather than
   * try to display it.
   *
   * Photos are viewed inline; an Excel export must download. Getting this wrong
   * is not cosmetic — a spreadsheet served as an image renders as a broken image
   * icon and cannot be saved at all.
   */
  filename?: string;
}

export interface ObjectMetadata {
  byteSize: number;
  mimeType: string | null;
}

export interface StoredObject {
  key: string;
  size: number;
  lastModified: Date | null;
}

export interface StorageDriver {
  readonly name: "local" | "s3";

  presignUpload(params: {
    storageKey: string;
    mimeType: string;
    byteSize: number;
    checksumSha256: string;
  }): Promise<PresignedUpload>;

  presignDownload(storageKey: string, options?: DownloadOptions): Promise<string>;

  head(storageKey: string): Promise<ObjectMetadata | null>;

  put(params: { storageKey: string; body: Buffer; mimeType: string }): Promise<void>;

  get(storageKey: string): Promise<Buffer | null>;

  /**
   * Removes an object permanently.
   *
   * Reserved for orphaned uploads and the retention job. Deleting a photo a user
   * asked to remove is `deleted_at` on the row, never this: a photo is evidence
   * of work that may be questioned months later (PLAN/06 §6.1).
   */
  delete(storageKey: string): Promise<void>;

  list(prefix: string, limit?: number): Promise<StoredObject[]>;
}

export function thumbnailKeyFor(storageKey: string): string {
  return storageKey.replace(/(\.[a-z0-9]+)$/i, ".thumb$1");
}

/**
 * Content type for a stored object, by extension.
 *
 * The download route used to guess with `extension === "webp" ? webp : jpeg`,
 * which meant every Excel export was served as `image/jpeg`. The browser then
 * tried to render a spreadsheet as a photograph.
 */
const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
};

export function contentTypeFor(storageKey: string): string {
  const extension = storageKey.split(".").pop()?.toLowerCase() ?? "";
  // Unknown types download rather than render, which is the safe default for
  // something whose shape we do not know.
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}
