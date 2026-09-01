import { beforeAll, describe, expect, it } from "vitest";
import { resetConfigCache } from "../config.ts";
import {
  createStorageToken,
  localStorageDriver,
  resolveStoragePath,
  verifyStorageToken,
} from "./local-driver.ts";

/**
 * The local storage driver's security properties.
 *
 * A presigned URL is by design usable without a session: the decision about
 * whether an upload is allowed was made when the token was issued, by a route
 * that had a session and checked ownership, inspection status, and both photo
 * caps. Everything below tests that the token cannot be stretched beyond that
 * one decision.
 */

beforeAll(() => {
  process.env.STORAGE_SIGNING_KEY = "a-test-signing-key-of-sufficient-length";
  process.env.UPLOAD_DIR = "./uploads";
  process.env.PUBLIC_API_URL = "http://localhost:3000";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test"; // not-a-secret: unreachable localhost fixture, config validation only
  process.env.MFA_ENCRYPTION_KEY ??= Buffer.alloc(32, 3).toString("base64");
  resetConfigCache();
});

const validPayload = {
  key: "inspections/2026/SN2026-00001/DRIVE_1_R_OUT/abc.webp",
  size: 400_000,
  mime: "image/webp",
  checksum: "a".repeat(64),
  expiresAt: Date.now() + 60_000,
  operation: "put" as const,
};

describe("upload tokens cannot be stretched beyond one decision", () => {
  it("round-trips a valid token", () => {
    const verified = verifyStorageToken(createStorageToken(validPayload));
    expect(verified).toEqual(validPayload);
  });

  it("rejects a token whose payload was edited", () => {
    // The whole point: without the signature, a client could rewrite the storage
    // key and overwrite somebody else's photograph.
    const token = createStorageToken(validPayload);
    const [body, signature] = token.split(".");

    const tampered = Buffer.from(
      JSON.stringify({ ...validPayload, key: "inspections/2026/SOMEONE_ELSE/x.webp" }),
    ).toString("base64url");

    expect(verifyStorageToken(`${tampered}.${signature ?? ""}`)).toBeNull();
    expect(body).not.toBe(tampered);
  });

  it("rejects a token with a forged signature", () => {
    const [body] = createStorageToken(validPayload).split(".");
    expect(verifyStorageToken(`${body ?? ""}.notarealsignature`)).toBeNull();
  });

  it("rejects an expired token", () => {
    // Ten minutes, per PLAN/05 §7. A URL that outlives its window is a URL that
    // can be replayed from a log or a screenshot.
    expect(
      verifyStorageToken(createStorageToken({ ...validPayload, expiresAt: Date.now() - 1000 })),
    ).toBeNull();
  });

  it("rejects a malformed token rather than throwing", () => {
    for (const token of ["", "nodot", "a.b.c.d", "!!!.???"]) {
      expect(verifyStorageToken(token)).toBeNull();
    }
  });

  it("keeps upload and download tokens distinct", () => {
    // A read token must not be usable to write. The operation is inside the
    // signed payload, and the routes check it.
    const downloadToken = createStorageToken({ ...validPayload, operation: "get" });
    expect(verifyStorageToken(downloadToken)?.operation).toBe("get");
  });
});

describe("storage keys cannot escape the upload directory", () => {
  it("resolves an ordinary key inside the root", () => {
    const resolved = resolveStoragePath("inspections/2026/SN2026-00001/side/abc.webp");
    expect(resolved).toContain("uploads");
  });

  it.each([
    "../../../etc/passwd",
    "inspections/../../../../secrets.env",
    "/etc/passwd",
  ])("refuses %s", (key) => {
    // Storage keys are built from values the database already constrains, so
    // this should be unreachable. It costs nothing to check, and the failure
    // mode if it were ever reachable is total.
    expect(() => resolveStoragePath(key)).toThrow(/escapes/);
  });
});

describe("presigned URLs", () => {
  it("points an upload at this API's own upload route", async () => {
    const signed = await localStorageDriver.presignUpload({
      storageKey: validPayload.key,
      mimeType: "image/webp",
      byteSize: 400_000,
      checksumSha256: validPayload.checksum,
    });

    expect(signed.url).toContain("/api/uploads/");
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("binds the upload URL to the exact size and checksum", async () => {
    const signed = await localStorageDriver.presignUpload({
      storageKey: validPayload.key,
      mimeType: "image/webp",
      byteSize: 400_000,
      checksumSha256: validPayload.checksum,
    });

    const token = signed.url.split("/api/uploads/")[1] ?? "";
    const payload = verifyStorageToken(token);

    expect(payload?.size).toBe(400_000);
    expect(payload?.checksum).toBe(validPayload.checksum);
    expect(payload?.operation).toBe("put");
  });

  it("issues a read token for a download", async () => {
    const url = await localStorageDriver.presignDownload(validPayload.key, { ttlSeconds: 300 });
    const payload = verifyStorageToken(url.split("/api/uploads/")[1] ?? "");

    expect(payload?.operation).toBe("get");
    expect(payload?.key).toBe(validPayload.key);
  });

  it("keeps the token short enough to survive Fastify's route parameter cap", async () => {
    // The token is a route parameter, and Fastify caps those at 100 characters
    // by default — under which every photo upload and every photo view answers
    // 414 URI Too Long. `app.ts` raises the cap to 1024; this asserts the token
    // stays well inside it, so growing the payload cannot quietly break both
    // flows again.
    const signed = await localStorageDriver.presignUpload({
      storageKey: "inspections/2026/SN2026-00001/FREE_5_L_OUT/00000000-0000-0000-0000-000000000000.webp",
      mimeType: "image/webp",
      byteSize: 5 * 1024 * 1024,
      checksumSha256: "f".repeat(64),
    });

    const token = signed.url.split("/api/uploads/")[1] ?? "";
    expect(token.length).toBeGreaterThan(100);
    expect(token.length).toBeLessThan(700);
  });

  it("returns null metadata for an object that is not there", async () => {
    expect(await localStorageDriver.head("inspections/2026/nope/missing.webp")).toBeNull();
    expect(await localStorageDriver.get("inspections/2026/nope/missing.webp")).toBeNull();
  });
});
