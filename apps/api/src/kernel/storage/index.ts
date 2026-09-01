import { loadConfig } from "../config.ts";
import type { DownloadOptions, ObjectMetadata, StorageDriver, StoredObject } from "./driver.ts";
import { localStorageDriver } from "./local-driver.ts";
import { s3StorageDriver } from "./s3-driver.ts";

/**
 * Selects the storage driver from configuration.
 *
 * Callers use the free functions below and never touch a driver directly, so the
 * whole application is one environment variable away from moving photos to R2.
 */

let driver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (driver !== null) return driver;
  driver = loadConfig().STORAGE_DRIVER === "s3" ? s3StorageDriver : localStorageDriver;
  return driver;
}

/** Test helper. Never called by application code. */
export function resetStorageDriver(): void {
  driver = null;
}

export async function presignUpload(params: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
}): Promise<{ url: string; expiresAt: Date }> {
  return getStorageDriver().presignUpload(params);
}

/** Short-lived read URL. Photos are never served from a permanently public link. */
export async function presignDownload(
  storageKey: string,
  options: DownloadOptions = {},
): Promise<string> {
  return getStorageDriver().presignDownload(storageKey, options);
}

/** Confirms the object actually landed before a `photos` row claims it did. */
export async function headObject(storageKey: string): Promise<ObjectMetadata | null> {
  return getStorageDriver().head(storageKey);
}

export async function putObject(params: {
  storageKey: string;
  body: Buffer;
  mimeType: string;
}): Promise<void> {
  return getStorageDriver().put(params);
}

export async function getObject(storageKey: string): Promise<Buffer | null> {
  return getStorageDriver().get(storageKey);
}

export async function deleteObject(storageKey: string): Promise<void> {
  return getStorageDriver().delete(storageKey);
}

export async function listObjects(prefix: string, limit = 1000): Promise<StoredObject[]> {
  return getStorageDriver().list(prefix, limit);
}

export { contentTypeFor, thumbnailKeyFor } from "./driver.ts";
export type { DownloadOptions, ObjectMetadata, StorageDriver, StoredObject } from "./driver.ts";
