import { beforeAll, describe, expect, it, vi } from "vitest";
import type * as LocalDriver from "./local-driver.ts";

/**
 * What a signed storage token is allowed to be.
 *
 * The signature already binds a token to one object and one operation, because
 * the whole payload is under the HMAC. These tests cover the rules the signature
 * alone cannot express — the ones that decide what may be signed at all.
 *
 * The photo links inside an Excel export were asked to never expire, and a
 * permanent token is a permanent grant: no login, no revocation short of
 * rotating the signing key. So it is narrowed to exactly the thing that was
 * asked for, reading one photograph, and refused for anything else.
 */

let createStorageToken: typeof LocalDriver.createStorageToken;
let verifyStorageToken: typeof LocalDriver.verifyStorageToken;

const PHOTO_KEY = "inspections/2026/SN2026-00001/STEER_1_L/abc.webp";
const EXPORT_KEY = "exports/2026/aae0f09f.xlsx";

function token(overrides: Partial<Parameters<typeof createStorageToken>[0]> = {}) {
  return {
    key: PHOTO_KEY,
    size: 0,
    mime: "image/webp",
    checksum: "",
    expiresAt: null as number | null,
    operation: "get" as const,
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.STORAGE_SIGNING_KEY = "test-key-at-least-16";
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  process.env.LOG_LEVEL = "silent";

  const { resetConfigCache } = await import("../config.ts");
  resetConfigCache();

  ({ createStorageToken, verifyStorageToken } = await import("./local-driver.ts"));
});

describe("a token that never expires", () => {
  it("is allowed for reading one photograph", () => {
    const verified = verifyStorageToken(createStorageToken(token()));
    expect(verified?.key).toBe(PHOTO_KEY);
    expect(verified?.expiresAt).toBeNull();
  });

  it("still works long after any ordinary token would have died", () => {
    // The point of the whole exercise: a link in a spreadsheet someone opens
    // next month.
    const signed = createStorageToken(token());
    const later = Date.now() + 365 * 24 * 60 * 60 * 1000;

    const clock = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      expect(verifyStorageToken(signed)).not.toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("is refused for uploading", () => {
    // A permanent write into the bucket, which is not what anyone asked for.
    expect(() => createStorageToken(token({ operation: "put" }))).toThrow(/only read/);
  });

  it("is refused for an export", () => {
    // An export is every inspection in a region in one file. A permanent
    // unauthenticated link to that is a different grant entirely, and the export
    // has its own time-limited link.
    expect(() => createStorageToken(token({ key: EXPORT_KEY }))).toThrow(/only name a photograph/);
  });

  it("is refused for a key that merely mentions the photo prefix", () => {
    expect(() => createStorageToken(token({ key: "exports/inspections/sneaky.xlsx" }))).toThrow(
      /only name a photograph/,
    );
  });
});

describe("a token presented after the rules changed", () => {
  it("is refused even though its signature is valid", async () => {
    /*
     * Minted the way a code path that forgets the rule would mint it — signed
     * correctly, so `verifyStorageToken` has to be the one that says no. This is
     * why the check runs on presentation and not only at signing: a token that
     * verifies is not the same as a token that is allowed.
     */
    const { createHmac } = await import("node:crypto");
    const payload = { ...token({ key: EXPORT_KEY }) };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", "test-key-at-least-16")
      .update(body)
      .digest("base64url");

    expect(verifyStorageToken(`${body}.${signature}`)).toBeNull();
  });
});

describe("a token that does expire", () => {
  it("is unaffected by any of this", () => {
    const signed = createStorageToken(token({ key: EXPORT_KEY, expiresAt: Date.now() + 60_000 }));
    expect(verifyStorageToken(signed)?.key).toBe(EXPORT_KEY);
  });

  it("may still be an upload token", () => {
    const signed = createStorageToken(
      token({ operation: "put", expiresAt: Date.now() + 60_000, size: 1024, checksum: "ab" }),
    );
    expect(verifyStorageToken(signed)?.operation).toBe("put");
  });

  it("stops working once it has", () => {
    const signed = createStorageToken(token({ expiresAt: Date.now() - 1 }));
    expect(verifyStorageToken(signed)).toBeNull();
  });
});

describe("a token that was tampered with", () => {
  it("is refused when the key is swapped", () => {
    const signed = createStorageToken(token({ expiresAt: Date.now() + 60_000 }));
    const [, signature] = signed.split(".");

    const forged = Buffer.from(
      JSON.stringify({ ...token({ key: EXPORT_KEY, expiresAt: Date.now() + 60_000 }) }),
    ).toString("base64url");

    expect(verifyStorageToken(`${forged}.${String(signature)}`)).toBeNull();
  });

  it("is refused when it is not a token at all", () => {
    expect(verifyStorageToken("nonsense")).toBeNull();
    expect(verifyStorageToken("")).toBeNull();
    expect(verifyStorageToken("a.b.c")).toBeNull();
  });
});
