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

describe("PLAN/13 §2.1 — session tokens", () => {
  it("never stores the value that goes in the cookie", () => {
    const token = issueSessionToken();
    expect(token.hash).not.toBe(token.value);
    expect(token.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces a different token every time", () => {
    const values = new Set(Array.from({ length: 200 }, () => issueSessionToken().value));
    expect(values.size).toBe(200);
  });

  it("hashes deterministically so lookup by hash works", () => {
    const token = issueSessionToken();
    expect(hashSessionToken(token.value)).toBe(token.hash);
  });

  it("issues a distinct CSRF token", () => {
    expect(issueCsrfToken()).not.toBe(issueCsrfToken());
  });
});

describe("PLAN/04 §4.2 — session lifetime", () => {
  const now = new Date("2026-09-01T08:00:00.000Z");

  it("expires 12 hours after login", () => {
    const { expiresAt } = sessionLifetime(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(12 * 60 * 60 * 1000);
  });

  it("sets an absolute ceiling of 7 days", () => {
    const { absoluteExpiresAt } = sessionLifetime(now);
    expect(absoluteExpiresAt.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("extends on activity while the ceiling is far away", () => {
    const { absoluteExpiresAt } = sessionLifetime(now);
    const later = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    expect(renewedExpiry(absoluteExpiresAt, later).getTime()).toBe(
      later.getTime() + 12 * 60 * 60 * 1000,
    );
  });

  it("never renews past the absolute ceiling", () => {
    // Sliding renewal that could outrun the ceiling would make the 7-day limit
    // decorative.
    const { absoluteExpiresAt } = sessionLifetime(now);
    const nearCeiling = new Date(absoluteExpiresAt.getTime() - 60 * 60 * 1000);
    expect(renewedExpiry(absoluteExpiresAt, nearCeiling)).toEqual(absoluteExpiresAt);
  });
});

describe("PLAN/13 §5 — device labelling", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36", "Chrome di Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/605.1.15", "Safari di iOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64) Firefox/121.0", "Firefox di Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36", "Chrome di macOS"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/120 Edg/120.0", "Edge di Windows"],
  ])("labels %s", (userAgent, expected) => {
    expect(deviceLabelFrom(userAgent)).toBe(expected);
  });

  it("falls back rather than throwing on a missing user agent", () => {
    expect(deviceLabelFrom(undefined)).toBe("Perangkat tidak dikenal");
    expect(deviceLabelFrom("")).toBe("Perangkat tidak dikenal");
  });

  it("compares IPv4 addresses at the /24 subnet", () => {
    // Coarse on purpose: a stricter fingerprint alerts on every browser update,
    // and users learn to ignore an alert that cries wolf.
    expect(sameNetwork("103.10.5.20", "103.10.5.99")).toBe(true);
    expect(sameNetwork("103.10.5.20", "103.10.6.20")).toBe(false);
  });

  it("compares IPv6 addresses at the /64 subnet", () => {
    expect(sameNetwork("2001:db8:1:2:3:4:5:6", "2001:db8:1:2:9:9:9:9")).toBe(true);
    expect(sameNetwork("2001:db8:1:2::1", "2001:db8:1:3::1")).toBe(false);
  });

  it("treats a missing address as a different network", () => {
    expect(sameNetwork(null, "103.10.5.20")).toBe(false);
    expect(sameNetwork("103.10.5.20", null)).toBe(false);
  });
});
