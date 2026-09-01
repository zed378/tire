import { beforeAll, describe, expect, it } from "vitest";
import { resetConfigCache } from "../config.ts";
import { AppError } from "../envelope/index.ts";
import {
  assertPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
  safeEqual,
  verifyPassword,
} from "./password.ts";
import {
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from "./totp.ts";

/**
 * Credential handling (PLAN/04 §4.1, PLAN/13 §3 and §8).
 *
 * B-11 is what this closes: the legacy system most likely held passwords as
 * plain text in a spreadsheet that anyone with access to the sheet could read.
 * Not one of those passwords is migrated, whatever form it turns out to be in
 * (PLAN/07 §5).
 */

beforeAll(() => {
  // A throwaway key for the encryption round trip. The real one lives in an
  // environment variable and is never written to this repository.
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test"; // not-a-secret: unreachable localhost fixture, config validation only
  process.env.STORAGE_SIGNING_KEY ??= "test-signing-key-at-least-16-chars";
  resetConfigCache();
});

describe("PLAN/04 §4.1 — password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("kalimat pendek yang mudah diingat");

    expect(await verifyPassword(hash, "kalimat pendek yang mudah diingat")).toBe(true);
    expect(await verifyPassword(hash, "kalimat pendek yang salah")).toBe(false);
  });

  it("produces a different hash for the same password each time", async () => {
    // Argon2id salts per hash. Two identical passwords sharing a hash would tell
    // anyone reading the table which accounts to attack together.
    const [first, second] = await Promise.all([hashPassword("password sama"), hashPassword("password sama")]);
    expect(first).not.toBe(second);
  });

  it("reads a malformed stored hash as a wrong password, not a crash", async () => {
    // A 500 here would tell an attacker something about the record. It has to be
    // indistinguishable from an ordinary failure.
    expect(await verifyPassword("not-a-real-argon2-hash", "anything")).toBe(false);
  });
}, 30_000);

describe("PLAN/04 §4.1 — password policy", () => {
  it("requires ten characters", () => {
    expect(() => assertPasswordPolicy("pendek")).toThrow(AppError);
  });

  it("imposes no composition rules", () => {
    // Length decides far more than a symbol requirement, and forced complexity
    // produces `Passw0rd!` on every account in the building.
    expect(() => assertPasswordPolicy("semua huruf kecil tanpa angka")).not.toThrow();
  });

  it("rejects a password from the common list", () => {
    expect(() => assertPasswordPolicy("password123")).toThrow(AppError);
    expect(() => assertPasswordPolicy("bismillah")).toThrow(AppError);
  });

  it("matches the common list regardless of case", () => {
    expect(() => assertPasswordPolicy("PASSWORD123")).toThrow(AppError);
  });

  it("attaches the failure to the newPassword field so it renders inline", () => {
    try {
      assertPasswordPolicy("short");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).fieldErrors[0]?.field).toBe("newPassword");
    }
  });

  it("reports both the length and the commonality at once", () => {
    try {
      assertPasswordPolicy("admin");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).fieldErrors).toHaveLength(2);
    }
  });
});

describe("temporary passwords are readable aloud", () => {
  it("excludes characters that are ambiguous over the phone", () => {
    // This string is dictated between an admin and a user far more often than it
    // is copied, so 0/O and 1/l/I are left out.
    for (let attempt = 0; attempt < 50; attempt++) {
      expect(generateTemporaryPassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it("is long enough to satisfy the policy it will be checked against", () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(10);
    expect(() => assertPasswordPolicy(generateTemporaryPassword())).not.toThrow();
  });

  it("never repeats", () => {
    const generated = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(generated.size).toBe(200);
  });
});

describe("constant-time comparison", () => {
  it("matches identical strings and rejects everything else", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("PLAN/13 §3.2 — TOTP secrets are encrypted, not hashed", () => {
  it("round-trips a secret", () => {
    // Encrypted rather than hashed because the server must read it back to
    // verify a code.
    const secret = generateTotpSecret();
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces different ciphertext each time", () => {
    // AES-256-GCM with a fresh IV. Identical ciphertext would reveal which users
    // share a secret, and leak the fact that a secret was reset to the same one.
    const secret = generateTotpSecret();
    expect(encryptSecret(secret).toString("hex")).not.toBe(encryptSecret(secret).toString("hex"));
  });

  it("refuses to decrypt tampered ciphertext", () => {
    const payload = encryptSecret(generateTotpSecret());
    const last = payload.length - 1;
    payload.writeUInt8(payload.readUInt8(last) ^ 0xff, last);

    // GCM authenticates the ciphertext, so a single flipped bit fails the tag
    // rather than decrypting to something plausible.
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("builds an otpauth URI naming the issuer and the account", () => {
    const uri = buildOtpauthUri("admin1", generateTotpSecret());
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("admin1");
    expect(uri).toContain("Commercial");
  });

  it("rejects a code that is not six digits rather than throwing", () => {
    expect(verifyTotp(generateTotpSecret(), "abcdef")).toBe(false);
    expect(verifyTotp(generateTotpSecret(), "")).toBe(false);
  });
});

describe("PLAN/13 §3.3 — recovery codes", () => {
  it("issues ten by default", () => {
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it("formats them in two groups so they can be read out and written down", () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("excludes the characters that get misread", () => {
    for (const code of generateRecoveryCodes(50)) {
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it("never issues the same code twice", () => {
    const codes = generateRecoveryCodes(100);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("normalises whatever the user types", () => {
    expect(normalizeRecoveryCode("  ab2cd-e3fgh ")).toBe("AB2CD-E3FGH");
  });
});
