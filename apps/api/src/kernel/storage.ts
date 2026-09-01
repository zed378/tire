import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PRESIGN_TTL_SECONDS } from "@c26/contracts";
import { loadConfig } from "./config.ts";

/**
 * Object storage (PLAN/01 §4.2, PLAN/05 §7).
 *
 * Cloudflare R2, spoken to over the S3 API, with MinIO standing in locally so no
 * code path differs between environments.
 *
 * Google Drive had to go: no short-lived signed URLs, no lifecycle rules, and a
 * quota tied to an account that cannot be bought separately (B-06). Among object
 * stores R2 was chosen for free egress — QC staff open the same photos
 * repeatedly, and at 252 GB stored, S3 egress alone would exceed the storage
 * bill.
 */

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client !== null) return client;

  const config = loadConfig();
  client = new S3Client({
    region: config.STORAGE_REGION,
    endpoint: config.STORAGE_ENDPOINT,
    forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function bucket(): string {
  return loadConfig().STORAGE_BUCKET;
}

/**
 * A presigned PUT the device uploads to directly.
 *
 * The photo never passes through the application server: at 18,000 uploads a
 * month, proxying them burns bandwidth and memory and buys nothing.
 */
export async function presignUpload(params: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
}): Promise<{ url: string; expiresAt: Date }> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: params.storageKey,
    ContentType: params.mimeType,
    ContentLength: params.byteSize,
    // Binds the signature to the exact bytes: a signed URL cannot be reused to
    // upload something else.
    ChecksumSHA256: Buffer.from(params.checksumSha256, "hex").toString("base64"),
  });

  const url = await getSignedUrl(getClient(), command, { expiresIn: PRESIGN_TTL_SECONDS });
  return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000) };
}

/** Short-lived read URL. Photos are never served from a permanently public link. */
export async function presignDownload(storageKey: string, ttlSeconds = 900): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: storageKey }), {
    expiresIn: ttlSeconds,
  });
}

/** Confirms the object actually landed before a `photos` row is written. */
export async function headObject(
  storageKey: string,
): Promise<{ byteSize: number; mimeType: string | null } | null> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: storageKey }),
    );
    return { byteSize: result.ContentLength ?? 0, mimeType: result.ContentType ?? null };
  } catch {
    return null;
  }
}

export async function putObject(params: {
  storageKey: string;
  body: Buffer;
  mimeType: string;
}): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: params.storageKey,
      Body: params.body,
      ContentType: params.mimeType,
    }),
  );
}

export async function getObject(storageKey: string): Promise<Buffer | null> {
  try {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: bucket(), Key: storageKey }),
    );
    if (result.Body === undefined) return null;
    return Buffer.from(await result.Body.transformToByteArray());
  } catch {
    return null;
  }
}

/**
 * Deletes an object.
 *
 * Reserved for orphaned uploads and the retention job. Deleting a photo the user
 * asked to remove is `deleted_at` on the row, NOT this — a photo is evidence of
 * work that may be questioned months later (PLAN/06 §6.1).
 */
export async function deleteObject(storageKey: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
}

export async function listObjects(
  prefix: string,
  limit = 1000,
): Promise<{ key: string; size: number; lastModified: Date | null }[]> {
  const result = await getClient().send(
    new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, MaxKeys: limit }),
  );

  return (result.Contents ?? []).map((object) => ({
    key: object.Key ?? "",
    size: object.Size ?? 0,
    lastModified: object.LastModified ?? null,
  }));
}

export function thumbnailKeyFor(storageKey: string): string {
  return storageKey.replace(/(\.[a-z0-9]+)$/i, ".thumb$1");
}
