import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type * as LocalDriver from "../../kernel/storage/local-driver.ts";

/**
 * Serving a downloaded file, through the running application.
 *
 * An export could not be downloaded. The signed URL resolved, the file was
 * there, and the browser refused to save it — because this route guessed the
 * content type from the extension with two possible answers, `image/webp` or
 * `image/jpeg`, so a spreadsheet arrived as a JPEG. With `x-content-type-options:
 * nosniff` set (correctly), the browser would not look past that header.
 *
 * `storage/driver.ts` describes the failure exactly — "a spreadsheet served as
 * an image renders as a broken image icon and cannot be saved at all" — and the
 * token was changed to carry the real type. This route was never changed to read
 * it. These tests are the missing half.
 *
 * No database: a signed token authorises this route on its own, which is the
 * whole point of it (PLAN/05 §7).
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EXPORT_KEY = "exports/2026/aae0f09f-ee98-46a6-8b9a-bdb261147f8e.xlsx";
const PHOTO_KEY = "inspections/2026/SN2026-00001/tire/abc.webp";

let app: FastifyInstance;
let uploadDir: string;
let createToken: typeof LocalDriver.createStorageToken;

async function seedObject(key: string, contents: string): Promise<void> {
  const target = join(uploadDir, key);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, contents);
}

beforeAll(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), "c26-uploads-"));

  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.STORAGE_SIGNING_KEY = "test-key-at-least-16";
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  process.env.UPLOAD_DIR = uploadDir;
  process.env.LOG_LEVEL = "silent";

  const { resetConfigCache } = await import("../../kernel/config.ts");
  resetConfigCache();

  ({ createStorageToken: createToken } = await import("../../kernel/storage/local-driver.ts"));

  await seedObject(EXPORT_KEY, "PK-not-really-a-spreadsheet");
  await seedObject(PHOTO_KEY, "not-really-a-photo");

  const { buildApp } = await import("../../app.ts");
  app = buildApp();
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await rm(uploadDir, { recursive: true, force: true });
});

function getToken(key: string, mime: string, filename?: string): string {
  return createToken({
    key,
    size: 0,
    mime,
    checksum: "",
    expiresAt: Date.now() + 60_000,
    operation: "get",
    ...(filename === undefined ? {} : { filename }),
  });
}

describe("an export download", () => {
  it("is served as a spreadsheet, not as an image", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(EXPORT_KEY, XLSX_MIME)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(XLSX_MIME);
  });

  it("keeps nosniff, which is what made the wrong type fatal", async () => {
    // The header is right and stays. It is the reason a mislabelled file could
    // not be recovered by the browser guessing — and the reason the label has to
    // be correct rather than close enough.
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(EXPORT_KEY, XLSX_MIME)}`,
    });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("saves under the name the token carries, not the storage key", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(EXPORT_KEY, XLSX_MIME, "Data Quality Control 04-09-2026.xlsx")}`,
    });

    const disposition = String(response.headers["content-disposition"]);
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="Data Quality Control 04-09-2026.xlsx"');
    // RFC 6266's starred form, so a non-ASCII label survives the trip.
    expect(disposition).toContain("filename*=UTF-8''");
  });

  it("is private and short-lived, because it is customer data", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(EXPORT_KEY, XLSX_MIME)}`,
    });

    expect(String(response.headers["cache-control"])).toContain("private");
  });
});

describe("a photo download", () => {
  it("keeps its own type", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(PHOTO_KEY, "image/webp")}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/webp");
  });

  it("is displayed inline rather than downloaded", async () => {
    // No filename on a photo's token, so no disposition header: the gallery
    // shows it, it does not save it.
    const response = await app.inject({
      method: "GET",
      url: `/api/uploads/${getToken(PHOTO_KEY, "image/webp")}`,
    });

    expect(response.headers["content-disposition"]).toBeUndefined();
  });
});

describe("a token that does not authorise this", () => {
  it("answers 404 for an upload token used to read", async () => {
    const putToken = createToken({
      key: EXPORT_KEY,
      size: 0,
      mime: XLSX_MIME,
      checksum: "",
      expiresAt: Date.now() + 60_000,
      operation: "put",
    });

    const response = await app.inject({ method: "GET", url: `/api/uploads/${putToken}` });
    expect(response.statusCode).toBe(404);
  });

  it("answers 404 for a token that has expired", async () => {
    const stale = createToken({
      key: EXPORT_KEY,
      size: 0,
      mime: XLSX_MIME,
      checksum: "",
      expiresAt: Date.now() - 1_000,
      operation: "get",
    });

    const response = await app.inject({ method: "GET", url: `/api/uploads/${stale}` });
    expect(response.statusCode).toBe(404);
  });

  it("answers 404 for an object that is not there", async () => {
    const missing = getToken("exports/2026/nothing-here.xlsx", XLSX_MIME);
    const response = await app.inject({ method: "GET", url: `/api/uploads/${missing}` });
    expect(response.statusCode).toBe(404);
  });
});
