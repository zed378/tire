import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "@c26/contracts";
import { AppError } from "../envelope/index.ts";
import { COMMON_PASSWORDS } from "./common-passwords.ts";

/**
 * Password handling (PLAN/04 §4.1, PLAN/13 §8).
 *
 * Closes B-11. Not one legacy password is migrated, whatever form I-03 finds it
 * in: plain text obviously cannot come across, a weak hash is no better, and
 * even a strong hash has been sitting somewhere readable by many people for an
 * unknown length of time (PLAN/07 §5). Every user is recreated with a one-time
 * initial password and `must_change_password`.
 */

// PLAN/04 §4.1. These are the OWASP-recommended Argon2id parameters.
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain, ARGON2_OPTIONS);
  } catch {
    // A malformed stored hash must read as "wrong password", not as a 500 that
    // tells an attacker something about the record.
    return false;
  }
}

/**
 * Policy check.
 *
 * There are no composition rules on purpose: length decides far more than a
 * symbol requirement does, and forced complexity produces `Passw0rd!` on every
 * account in the building.
 */
export function assertPasswordPolicy(plain: string): void {
  const issues: { field: string; code: "TOO_SHORT" | "PASSWORD_TOO_COMMON"; message: string }[] = [];

  if (plain.length < MIN_PASSWORD_LENGTH) {
    issues.push({
      field: "newPassword",
      code: "TOO_SHORT",
      message: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    });
  }

  if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
    issues.push({
      field: "newPassword",
      code: "PASSWORD_TOO_COMMON",
      message: "Password ini terlalu umum dipakai. Pilih yang lain.",
    });
  }

  if (issues.length > 0) throw new AppError("VALIDATION_ERROR", { fieldErrors: issues });
}

/**
 * Have I Been Pwned check via k-anonymity (PLAN/13 §8).
 *
 * Only the first five characters of the SHA-1 hash leave this process; the
 * service never learns the password or the full hash. A network failure returns
 * false rather than blocking a password change — availability of a third party
 * must not gate account recovery.
 */
export async function isPasswordBreached(plain: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(plain, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(3000),
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return false;

    const body = await response.text();
    return body.split("\n").some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false;
  }
}

/**
 * A one-time initial password, readable aloud over the phone.
 *
 * Ambiguous characters (0/O, 1/l/I) are excluded because this string is
 * dictated between an admin and a user far more often than it is copied.
 */
const READABLE_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 14): string {
  const bytes = randomBytes(length);
  let output = "";
  for (let i = 0; i < length; i++) {
    output += READABLE_ALPHABET[bytes[i]! % READABLE_ALPHABET.length];
  }
  return output;
}

/** Constant-time comparison for tokens and recovery codes. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
