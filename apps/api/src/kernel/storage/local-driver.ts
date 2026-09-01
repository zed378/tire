import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { PRESIGN_TTL_SECONDS } from "@c26/contracts";
import { loadConfig } from "../config.ts";
import type { ObjectMetadata, PresignedUpload, StorageDriver, StoredObject } from "./driver.ts";

/**
 * Filesystem storage driver.
 *
 * Photos live under `UPLOAD_DIR` and are reached through this API rather than
 * through an object store. The presigned URL points at `/api/uploads/:token`,
 * where the token is an HMAC over the storage key, size, MIME type, checksum,
 * and expiry — so a URL cannot be edited to write somewhere else, upload
 * something larger, or outlive its ten minutes.
 *
 * That keeps the whole PLAN/05 §7 protocol intact: the device still presigns,
 * PUTs to a URL it was given, and confirms. Nothing on the client knows the
 * difference, which is what makes the eventual move to R2 a configuration
 * change.
 *
 * WHAT THIS TRADES AWAY, stated plainly: the bytes now pass through the
 * application process, which PLAN/05 §7 avoids on purpose — at 18,000 uploads a
 * month, proxying them costs bandwidth and memory. It also ties photo durability
 * to one disk, where PLAN/01 §5.2 assumes versioned object storage with a 90-day
 * window on deleted objects. Both are acceptable while volume is low and the
 * system is being built; neither is acceptable at the volumes PLAN/01 §1
 * projects. The trigger to switch is in the README.
 */

interface TokenPayload {
  key: string;
  size: number;
  mime: string;
  checksum: string;
  expiresAt: number;
  operation: "put" | "get";
}

function signingKey(): string {
  return loadConfig().STORAGE_SIGNING_KEY;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createStorageToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the payload, or null when the token is forged, altered, or expired. */
export function verifyStorageToken(token: string): TokenPayload | null {
  const [body, signature] = token.split(".");
  if (body === undefined || signature === undefined) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function uploadRoot(): string {
  return resolve(loadConfig().UPLOAD_DIR);
}

/**
 * Resolves a storage key to an absolute path, refusing anything that escapes the
 * upload root. Storage keys are built by `buildStorageKey` from values the
 * database already constrains, but a path traversal check costs nothing and the
 * failure mode is total.
 */
export function resolveStoragePath(storageKey: string): string {
  const root = uploadRoot();
  const target = resolve(join(root, storageKey));
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`storage key escapes the upload directory: ${storageKey}`);
  }
  return target;
}

export async function writeUpload(storageKey: string, body: Buffer): Promise<void> {
  const target = resolveStoragePath(storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
}

export const localStorageDriver: StorageDriver = {
  name: "local",

  presignUpload(params): Promise<PresignedUpload> {
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000);
    const token = createStorageToken({
      key: params.storageKey,
      size: params.byteSize,
      mime: params.mimeType,
      checksum: params.checksumSha256.toLowerCase(),
      expiresAt: expiresAt.getTime(),
      operation: "put",
    });

    const base = loadConfig().PUBLIC_API_URL.replace(/\/$/, "");
    return Promise.resolve({ url: `${base}/api/uploads/${token}`, expiresAt });
  },

  presignDownload(storageKey, ttlSeconds = 900): Promise<string> {
    const token = createStorageToken({
      key: storageKey,
      size: 0,
      mime: "",
      checksum: "",
      expiresAt: Date.now() + ttlSeconds * 1000,
      operation: "get",
    });

    const base = loadConfig().PUBLIC_API_URL.replace(/\/$/, "");
    return Promise.resolve(`${base}/api/uploads/${token}`);
  },

  async head(storageKey): Promise<ObjectMetadata | null> {
    try {
      const stats = await stat(resolveStoragePath(storageKey));
      if (!stats.isFile()) return null;
      return { byteSize: stats.size, mimeType: null };
    } catch {
      return null;
    }
  },

  async put(params): Promise<void> {
    await writeUpload(params.storageKey, params.body);
  },

  async get(storageKey): Promise<Buffer | null> {
    try {
      return await readFile(resolveStoragePath(storageKey));
    } catch {
      return null;
    }
  },

  async delete(storageKey): Promise<void> {
    await rm(resolveStoragePath(storageKey), { force: true });
  },

  async list(prefix, limit = 1000): Promise<StoredObject[]> {
    const root = uploadRoot();
    const found: StoredObject[] = [];

    async function walk(directory: string): Promise<void> {
      if (found.length >= limit) return;

      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (found.length >= limit) return;
        const full = join(directory, entry.name);

        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }

        const key = full.slice(root.length + 1).split(sep).join("/");
        if (!key.startsWith(prefix)) continue;

        const stats = await stat(full);
        found.push({ key, size: stats.size, lastModified: stats.mtime });
      }
    }

    await walk(root);
    return found;
  },
};
