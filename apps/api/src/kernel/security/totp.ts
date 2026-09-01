import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { authenticator } from "otplib";
import { MFA_RECOVERY_CODE_COUNT } from "@c26/contracts";
import { loadConfig } from "../config.ts";

/**
 * TOTP multi-factor authentication (PLAN/13 §3).
 *
 * TOTP rather than SMS or WhatsApp, and the deciding reason is not cost: it
 * works with no signal at all. The core work of this system happens in garages
 * and vehicle pools, and an OTP that needs a cell tower is an OTP that fails
 * exactly where the app is used.
 */

// ±1 step. Wider tolerance widens the brute-force window for a 6-digit code.
authenticator.options = { window: 1, step: 30 };

const ISSUER = "Commercial 2026";

/**
 * The TOTP secret is ENCRYPTED, not hashed — the server has to read it back to
 * verify a code. The key lives in an environment variable and never in the repo;
 * `.claude/hooks/guard.mjs` blocks writes to `.env` for that reason.
 */
function encryptionKey(): Buffer {
  const key = Buffer.from(loadConfig().MFA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

/** AES-256-GCM. Layout: 12-byte IV || 16-byte auth tag || ciphertext. */
export function encryptSecret(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(payload: Buffer): string {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpauthUri(username: string, secret: string): string {
  return authenticator.keyuri(username, ISSUER, secret);
}

export function verifyTotp(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/**
 * Ten single-use recovery codes, shown exactly once at enrolment.
 *
 * Formatted in two groups so they can be read aloud and written down without
 * transcription errors.
 */
export function generateRecoveryCodes(count = MFA_RECOVERY_CODE_COUNT): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(10);
    let raw = "";
    for (const byte of bytes) raw += alphabet[byte % alphabet.length];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
