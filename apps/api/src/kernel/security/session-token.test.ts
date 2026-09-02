import { createHash } from "node:crypto";
import { SESSION_ABSOLUTE_TTL_DAYS, SESSION_TTL_HOURS } from "@c26/contracts";
import { describe, expect, it } from "vitest";
import {
  deviceLabelFrom,
  hashSessionToken,
  issueCsrfToken,
  issueSessionToken,
  renewedExpiry,
  sameNetwork,
  sessionLifetime,
} from "./session-token.ts";

/**
 * Opaque session tokens (PLAN/13 §1.1, §2.1, §5).
 *
 * This file previously tested an API that does not exist: a two-argument
 * `hashSessionToken(token, salt)`, a `SAME_NETWORK_WINDOW_MINUTES` constant, a
 * `SessionLifetime` with `ttl`/`absoluteTtl` fields, and a `deviceLabelFrom`
 * taking an object. None of it compiled, so none of it ran, and the module has
 * in practice been untested.
 *
 * A salt is absent from the real implementation on purpose, and it is worth
 * saying why rather than reintroducing it: the value being hashed is 256 bits
 * of `randomBytes`, not a password. Salting defends low-entropy secrets against
 * precomputation, and there is nothing to precompute against a value drawn from
 * 2^256. What matters here is only that the database never holds the value the
 * cookie carries — which is what these tests check.
 */

describe("PLAN/13 §2.1 — the database never holds the cookie value", () => {
  it("issues a value and a hash that are not the same string", () => {
    const issued = issueSessionToken();
    expect(issued.hash).not.toBe(issued.value);
  });

  it("stores exactly the SHA-256 of the value", () => {
    const issued = issueSessionToken();
    const expected = createHash("sha256").update(issued.value).digest("hex");
    expect(issued.hash).toBe(expected);
  });

  it("never issues the same token twice", () => {
    const issued = Array.from({ length: 50 }, () => issueSessionToken().value);
    expect(new Set(issued).size).toBe(issued.length);
  });

  it("issues a value safe to put in a cookie", () => {
    // base64url: no padding, no separators a Set-Cookie header would choke on.
    expect(issueSessionToken().value).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashSessionToken", () => {
  it("is deterministic", () => {
    expect(hashSessionToken("token-value")).toBe(hashSessionToken("token-value"));
  });

  it("separates different inputs", () => {
    expect(hashSessionToken("a")).not.toBe(hashSessionToken("b"));
  });

  it("returns 64 hexadecimal characters", () => {
    expect(hashSessionToken("")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("PLAN/13 §2.2 — CSRF token", () => {
  it("never issues the same token twice", () => {
    const issued = Array.from({ length: 50 }, () => issueCsrfToken());
    expect(new Set(issued).size).toBe(issued.length);
  });

  it("is readable by JavaScript, so it must survive a cookie round trip", () => {
    expect(issueCsrfToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("PLAN/04 §4.2 — session lifetime", () => {
  const now = new Date("2026-03-12T08:00:00.000Z");

  it("expires twelve hours after login", () => {
    const lifetime = sessionLifetime(now);
    const hours = (lifetime.expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    expect(hours).toBe(SESSION_TTL_HOURS);
    // The figure follows the working pattern the field staff actually have:
    // one day of work, not a week.
    expect(SESSION_TTL_HOURS).toBe(12);
  });

  it("caps the session seven days from first login however active the user is", () => {
    const lifetime = sessionLifetime(now);
    const days = (lifetime.absoluteExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(SESSION_ABSOLUTE_TTL_DAYS);
    expect(SESSION_ABSOLUTE_TTL_DAYS).toBe(7);
  });

  it("puts the absolute ceiling after the sliding expiry", () => {
    const lifetime = sessionLifetime(now);
    expect(lifetime.absoluteExpiresAt.getTime()).toBeGreaterThan(lifetime.expiresAt.getTime());
  });
});

describe("PLAN/04 §4.2 — renewal slides but never breaks the ceiling", () => {
  const now = new Date("2026-03-12T08:00:00.000Z");

  it("extends by the full session length while there is room", () => {
    const ceiling = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const renewed = renewedExpiry(ceiling, now);
    const hours = (renewed.getTime() - now.getTime()) / (60 * 60 * 1000);
    expect(hours).toBe(SESSION_TTL_HOURS);
  });

  it("clamps to the ceiling when the sliding window would overshoot it", () => {
    // One hour left on the absolute lifetime: renewal must not turn that into
    // twelve, or the seven-day cap would never be reached by an active user.
    const ceiling = new Date(now.getTime() + 60 * 60 * 1000);
    expect(renewedExpiry(ceiling, now).getTime()).toBe(ceiling.getTime());
  });

  it("returns the ceiling itself once it has passed", () => {
    const ceiling = new Date(now.getTime() - 60 * 1000);
    expect(renewedExpiry(ceiling, now).getTime()).toBe(ceiling.getTime());
  });
});

describe("PLAN/13 §5 — device label", () => {
  it("names browser and platform in Indonesian (K-10)", () => {
    expect(
      deviceLabelFrom(
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome di Android");
  });

  it("reads an iPhone as Safari on iOS", () => {
    expect(
      deviceLabelFrom(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari di iOS");
  });

  it("prefers Edge over the Chrome string Edge also carries", () => {
    expect(deviceLabelFrom("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0")).toBe(
      "Edge di Windows",
    );
  });

  it("falls back to Indonesian when there is no user agent at all", () => {
    expect(deviceLabelFrom(undefined)).toBe("Perangkat tidak dikenal");
    expect(deviceLabelFrom("")).toBe("Perangkat tidak dikenal");
    expect(deviceLabelFrom("   ")).toBe("Perangkat tidak dikenal");
  });

  it("still produces a label for an unrecognised agent", () => {
    expect(deviceLabelFrom("SomeCrawler/1.0")).toBe("Peramban lain di perangkat lain");
  });
});

describe("PLAN/13 §5 — same network", () => {
  it("treats an identical address as the same network", () => {
    expect(sameNetwork("203.0.113.7", "203.0.113.7")).toBe(true);
  });

  it("treats a /24 neighbour as the same network", () => {
    // Mobile carriers move a device around within a subnet constantly. Alerting
    // on that would cry wolf, and an alert people learn to ignore protects
    // nobody.
    expect(sameNetwork("203.0.113.7", "203.0.113.99")).toBe(true);
  });

  it("treats a different /24 as a different network", () => {
    expect(sameNetwork("203.0.113.7", "198.51.100.7")).toBe(false);
  });

  it("compares IPv6 on the first four groups", () => {
    expect(sameNetwork("2001:db8:85a3:1::1", "2001:db8:85a3:1::ffff")).toBe(true);
    expect(sameNetwork("2001:db8:85a3:1::1", "2001:db8:85a3:2::1")).toBe(false);
  });

  it("says no when either address is unknown", () => {
    // Absence of evidence is not a match. Answering true here would silently
    // suppress the alert the comparison exists to raise.
    expect(sameNetwork(null, "203.0.113.7")).toBe(false);
    expect(sameNetwork("203.0.113.7", null)).toBe(false);
    expect(sameNetwork(null, null)).toBe(false);
  });
});
