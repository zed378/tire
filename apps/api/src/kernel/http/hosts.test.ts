import { describe, expect, it } from "vitest";
import { isRouteAllowedForHost, isStorageHost, normalizeHost } from "./hosts.ts";
import { cacheControlFor, securityHeadersFor } from "./security-headers.ts";

/**
 * The storage-host restriction.
 *
 * This used to be four lines of reverse-proxy configuration. It is code now
 * because it is a security boundary, and a boundary that can be asserted on is
 * worth more than one sitting in a config file nobody tests.
 */

const STORAGE = "tire-store.zedth.my.id";

describe("host matching", () => {
  it("ignores the port and the case", () => {
    expect(isStorageHost("TIRE-STORE.zedth.my.id", STORAGE)).toBe(true);
    expect(isStorageHost("tire-store.zedth.my.id:8443", STORAGE)).toBe(true);
  });

  it("does not match the application host", () => {
    expect(isStorageHost("tire.zedth.my.id", STORAGE)).toBe(false);
  });

  it("does not match a host that merely contains the storage name", () => {
    // A suffix match here would hand the whole API to anyone who could point
    // `evil-tire-store.zedth.my.id` at this process.
    expect(isStorageHost("evil-tire-store.zedth.my.id", STORAGE)).toBe(false);
    expect(isStorageHost("tire-store.zedth.my.id.attacker.test", STORAGE)).toBe(false);
  });

  it("treats an unset storage host as no restriction", () => {
    // Local development: everything is localhost, and there is nothing to split.
    expect(isStorageHost("tire-store.zedth.my.id", "")).toBe(false);
  });

  it("handles a missing Host header", () => {
    expect(normalizeHost(undefined)).toBe("");
    expect(isStorageHost(undefined, STORAGE)).toBe(false);
  });
});

describe("the storage host serves exactly one route", () => {
  const onStorage = (path: string): boolean =>
    isRouteAllowedForHost({ host: STORAGE, path, storageHost: STORAGE });

  it("allows the signed upload route", () => {
    expect(onStorage("/api/uploads/eyJrZXkiOiJ4In0.signature")).toBe(true);
  });

  it("allows it with a query string", () => {
    expect(onStorage("/api/uploads/token?download=1")).toBe(true);
  });

  it.each([
    "/api/qc/queue",
    "/api/users",
    "/api/audit",
    "/api/auth/login",
    "/api/health",
    "/",
    "/inspections/SN2026-00001",
    "/assets/index-abc.js",
  ])("refuses %s", (path) => {
    expect(onStorage(path)).toBe(false);
  });

  it("refuses a path that merely contains the prefix", () => {
    // Prefix matching has to anchor at the start, or `/api/qc?x=/api/uploads/`
    // walks straight through.
    expect(onStorage("/api/qc/queue?next=/api/uploads/x")).toBe(false);
    expect(onStorage("/redirect?to=/api/uploads/x")).toBe(false);
  });

  it("refuses the prefix without a token", () => {
    expect(onStorage("/api/uploads")).toBe(false);
  });

  it("leaves the application host completely unrestricted", () => {
    for (const path of ["/api/qc/queue", "/api/users", "/", "/inspections/SN2026-00001"]) {
      expect(isRouteAllowedForHost({ host: "tire.zedth.my.id", path, storageHost: STORAGE })).toBe(
        true,
      );
    }
  });
});

describe("PLAN/13 §7 — security headers per response class", () => {
  const context = { storageOrigin: "https://tire-store.zedth.my.id", secure: true };

  it("gives the SPA a CSP with no unsafe-inline", () => {
    // Decision A-07. It is why the dashboard chart is hand-written SVG rather
    // than a charting library, and why no component sets a style attribute.
    const csp = securityHeadersFor("spa", context)["content-security-policy"] ?? "";

    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://tire-store.zedth.my.id");
  });

  it("locks the API down to nothing, because JSON loads nothing", () => {
    const csp = securityHeadersFor("api", context)["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'none'");
  });

  it("keeps signed photo URLs out of referrers", () => {
    // The token is in the path, so a referrer would leak a working URL.
    const headers = securityHeadersFor("storage", context);
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["content-security-policy"]).toContain("img-src 'self'");
  });

  it("refuses to be framed in every class", () => {
    // The legacy system lived INSIDE an Apps Script sandbox iframe (B-07).
    for (const responseClass of ["spa", "api", "storage"] as const) {
      expect(securityHeadersFor(responseClass, context)["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
    }
  });

  it("omits HSTS where there is no TLS to pin", () => {
    const local = securityHeadersFor("spa", { ...context, secure: false });
    expect(local["strict-transport-security"]).toBeUndefined();
    expect(securityHeadersFor("spa", context)["strict-transport-security"]).toContain("max-age=");
  });

  it("sets nosniff everywhere", () => {
    for (const responseClass of ["spa", "api", "storage"] as const) {
      expect(securityHeadersFor(responseClass, context)["x-content-type-options"]).toBe("nosniff");
    }
  });
});

describe("PLAN/06 §5.1 — cache policy", () => {
  it("never caches the service worker", () => {
    // A stale worker serves an old application to a new API, and the user has
    // no way to notice.
    expect(cacheControlFor("/sw.js")).toContain("no-cache");
  });

  it("caches fingerprinted assets for a year", () => {
    expect(cacheControlFor("/assets/index-CPMhI2G4.js")).toContain("immutable");
  });

  it("always revalidates the HTML shell", () => {
    // Otherwise a deploy never reaches anyone who already has the page.
    expect(cacheControlFor("/index.html")).toBe("no-cache");
  });
});
