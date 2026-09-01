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
import { loadConfig } from "../config.ts";
import {
  contentTypeFor,
  type ObjectMetadata,
  type PresignedUpload,
  type StorageDriver,
  type StoredObject,
} from "./driver.ts";

/**
 * Cloudflare R2 driver, spoken to over the S3 API (PLAN/01 §4.2).
 *
 * Not active while `STORAGE_DRIVER=local`, and kept ready rather than deferred:
 * the volumetrics in PLAN/01 §1 reach 252 GB of photos by year three, which is
 * past what a single VPS disk should be holding without versioning or lifecycle
 * rules.
 *
 * R2 rather than S3 for one reason that dominates the rest: egress is free, and
 * QC opens the same photographs repeatedly. At 252 GB stored, S3 egress alone
 * would exceed the storage bill. Google Drive was ruled out entirely — no
 * short-lived signed URLs, no lifecycle rules, and a quota tied to an account
 * that cannot be bought separately (B-06).
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
      accessKeyId: config.STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY ?? "",
    },
  });
  return client;
}

function bucket(): string {
  return loadConfig().STORAGE_BUCKET ?? "";
}

export const s3StorageDriver: StorageDriver = {
  name: "s3",

  async presignUpload(params): Promise<PresignedUpload> {
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
  },

  presignDownload(storageKey, options = {}): Promise<string> {
    return getSignedUrl(
      getClient(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: storageKey,
        // R2 echoes these back on the response, so an export downloads under a
        // sensible name and a photo still displays inline.
        ResponseContentType: contentTypeFor(storageKey),
        ...(options.filename === undefined
          ? {}
          : { ResponseContentDisposition: `attachment; filename="${options.filename}"` }),
      }),
      { expiresIn: options.ttlSeconds ?? 900 },
    );
  },

  async head(storageKey): Promise<ObjectMetadata | null> {
    try {
      const result = await getClient().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: storageKey }),
      );
      return { byteSize: result.ContentLength ?? 0, mimeType: result.ContentType ?? null };
    } catch {
      return null;
    }
  },

  async put(params): Promise<void> {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: params.storageKey,
        Body: params.body,
        ContentType: params.mimeType,
      }),
    );
  },

  async get(storageKey): Promise<Buffer | null> {
    try {
      const result = await getClient().send(
        new GetObjectCommand({ Bucket: bucket(), Key: storageKey }),
      );
      if (result.Body === undefined) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      return null;
    }
  },

  async delete(storageKey): Promise<void> {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
  },

  async list(prefix, limit = 1000): Promise<StoredObject[]> {
    const result = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, MaxKeys: limit }),
    );

    return (result.Contents ?? []).map((object) => ({
      key: object.Key ?? "",
      size: object.Size ?? 0,
      lastModified: object.LastModified ?? null,
    }));
  },
};
