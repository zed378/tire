import { createHash, randomBytes } from "node:crypto";
import { SESSION_ABSOLUTE_TTL_DAYS, SESSION_TTL_HOURS } from "@c26/contracts";

/**
 * Opaque session tokens (PLAN/13 §1.1, §2.1).
 *
 * PLAN/01 originally sketched JWTs and PLAN/04 specified server sessions; the
 * two cannot both hold, and PLAN/13 settles it in favour of sessions. The
 * deciding property is revocation: PLAN/04 §5 already required that downgrading
 * someone's role revokes their sessions immediately, and a JWT simply cannot do
 * that — it stays valid until it expires. The one thing JWTs win on, stateless
 * scaling, is irrelevant to one API process and one database.
 *
 * The database stores the HASH of the cookie value, never the value. A leaked
 * dump must not hand an attacker a usable session.
 */

const TOKEN_BYTES = 32; // 256 bits

export interface IssuedToken {
  /** Goes into the cookie. Never logged, never stored. */
  value: string;
  /** Goes into the database. */
  hash: string;
}

export function issueSessionToken(): IssuedToken {
  const value = randomBytes(TOKEN_BYTES).toString("base64url");
  return { value, hash: hashSessionToken(value) };
}

export function hashSessionToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Double-submit CSRF token (PLAN/13 §2.2). Readable by JavaScript, by design. */
export function issueCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface SessionLifetime {
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

/**
 * 12 hours, extended on activity, with a hard ceiling of 7 days from first login.
 *
 * Twelve hours follows the actual working pattern: one day of field work, no
 * more (PLAN/04 §4.2).
 */
export function sessionLifetime(now: Date = new Date()): SessionLifetime {
  return {
    expiresAt: new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

/** Sliding renewal that can never push past the absolute ceiling. */
export function renewedExpiry(absoluteExpiresAt: Date, now: Date = new Date()): Date {
  const sliding = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  return sliding > absoluteExpiresAt ? absoluteExpiresAt : sliding;
}

/**
 * A readable device label from the user agent (PLAN/13 §5).
 *
 * Deliberately coarse. Browser fingerprinting produces a false positive on every
 * browser update, and users learn to ignore an alert that cries wolf — so the
 * label pairs a broad user-agent reading with the IP subnet instead.
 */
export function deviceLabelFrom(userAgent: string | undefined): string {
  if (userAgent === undefined || userAgent.trim() === "") return "Perangkat tidak dikenal";

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Safari\//.test(userAgent) ? "Safari"
    : "Peramban lain";

  const platform =
    /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent) ? "iOS"
    : /Windows/.test(userAgent) ? "Windows"
    : /Macintosh|Mac OS/.test(userAgent) ? "macOS"
    : /Linux/.test(userAgent) ? "Linux"
    : "perangkat lain";

  return `${browser} di ${platform}`;
}

/** Subnet-level comparison: /24 for IPv4, /64 for IPv6. */
export function sameNetwork(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  if (a === b) return true;

  if (a.includes(":") && b.includes(":")) {
    return a.split(":").slice(0, 4).join(":") === b.split(":").slice(0, 4).join(":");
  }
  return a.split(".").slice(0, 3).join(".") === b.split(".").slice(0, 3).join(".");
}
