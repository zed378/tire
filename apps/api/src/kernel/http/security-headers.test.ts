import { describe, expect, it } from "vitest";
import { cacheControlFor, securityHeadersFor, type HeaderContext } from "./security-headers.ts";

/**
 * PLAN/13 §7. This module had no tests, and it is where a production outage
 * lived: `storageOrigin` arrives empty whenever `STORAGE_HOST` is unset, which
 * silently drops the upload host out of `connect-src`. The process boots, every
 * screen works, and the browser refuses every photo upload before the request
 * leaves the device — so nothing reaches the server log either.
 *
 * `loadConfig` now refuses to boot in that state. These tests cover the other
 * half: what the header actually says once it does.
 */

const CONFIGURED: HeaderContext = {
  storageOrigin: "https://tire-store.zedth.my.id",
  secure: true,
};

function directives(header: string): Map<string, string> {
  return new Map(
    header.split(";").map((part) => {
      const [name, ...rest] = part.trim().split(/\s+/);
      return [name ?? "", rest.join(" ")];
    }),
  );
}

describe("securityHeadersFor: the SPA", () => {
  it("lets the browser reach the storage host for the photo PUT", () => {
    const csp = securityHeadersFor("spa", CONFIGURED)["content-security-policy"] ?? "";
    expect(directives(csp).get("connect-src")).toBe("'self' https://tire-store.zedth.my.id");
  });

  it("lets the browser display a photograph served from it", () => {
    const csp = securityHeadersFor("spa", CONFIGURED)["content-security-policy"] ?? "";
    expect(directives(csp).get("img-src")).toBe(
      "'self' https://tire-store.zedth.my.id data: blob:",
    );
  });

  it("falls back to same-origin only when no storage host is configured", () => {
    // The single-hostname deployment, which is legitimate: uploads are served
    // by the application host and `'self'` already covers them. This is also
    // the shape the misconfigured deployment took — hence the boot-time guard
    // in `loadConfig`, because from inside this function the two are identical.
    const csp =
      securityHeadersFor("spa", { storageOrigin: "", secure: true })[
        "content-security-policy"
      ] ?? "";

    expect(directives(csp).get("connect-src")).toBe("'self'");
    expect(directives(csp).get("img-src")).toBe("'self' data: blob:");
    // No stray separator from the empty interpolation.
    expect(csp).not.toContain("  ");
  });

  it("refuses to be framed, which the legacy system could not do", () => {
    // B-07: the old system ran inside an Apps Script sandbox iframe.
    const csp = securityHeadersFor("spa", CONFIGURED)["content-security-policy"] ?? "";
    expect(directives(csp).get("frame-ancestors")).toBe("'none'");
  });
});

describe("securityHeadersFor: decision A-07", () => {
  it("never emits unsafe-inline or unsafe-eval, in any response class", () => {
    // The reason the dashboard chart is hand-written SVG and no component sets
    // a `style` attribute. A regression here would quietly undo all of it.
    for (const responseClass of ["spa", "api", "storage"] as const) {
      for (const context of [CONFIGURED, { storageOrigin: "", secure: false }]) {
        const csp = securityHeadersFor(responseClass, context)["content-security-policy"] ?? "";
        expect(csp).not.toContain("unsafe-inline");
        expect(csp).not.toContain("unsafe-eval");
      }
    }
  });
});

describe("securityHeadersFor: the storage host", () => {
  it("allows the application origin to display what it serves", () => {
    // Without `cross-origin`, the default `same-origin` policy would let the
    // upload succeed and then refuse to render the thumbnail — a failure that
    // looks like a broken photograph rather than a header.
    expect(securityHeadersFor("storage", CONFIGURED)["cross-origin-resource-policy"]).toBe(
      "cross-origin",
    );
  });

  it("sends no referrer, because the signed token is in the path", () => {
    expect(securityHeadersFor("storage", CONFIGURED)["referrer-policy"]).toBe("no-referrer");
  });

  it("loads nothing but images", () => {
    const csp = securityHeadersFor("storage", CONFIGURED)["content-security-policy"] ?? "";
    expect(directives(csp).get("default-src")).toBe("'none'");
  });
});

describe("securityHeadersFor: the API", () => {
  it("loads nothing at all", () => {
    const csp = securityHeadersFor("api", CONFIGURED)["content-security-policy"] ?? "";
    expect(directives(csp).get("default-src")).toBe("'none'");
    expect(directives(csp).get("frame-ancestors")).toBe("'none'");
  });
});

describe("securityHeadersFor: transport", () => {
  it("pins HTTPS in production", () => {
    expect(securityHeadersFor("spa", CONFIGURED)["strict-transport-security"]).toContain(
      "max-age=31536000",
    );
  });

  it("does not pin it locally, where there is no TLS to pin", () => {
    // HSTS on localhost would poison the developer's browser for the whole
    // domain, and it cannot be undone by changing this header back.
    const headers = securityHeadersFor("spa", { storageOrigin: "", secure: false });
    expect(headers["strict-transport-security"]).toBeUndefined();
  });

  it("allows the camera and nothing else", () => {
    expect(securityHeadersFor("spa", CONFIGURED)["permissions-policy"]).toBe(
      "camera=(self), geolocation=(), microphone=()",
    );
  });
});

describe("cacheControlFor", () => {
  it("never caches the service worker", () => {
    // A stale worker serves an old application to a new API, and the user has
    // no way to notice (PLAN/06 §5.1).
    expect(cacheControlFor("/sw.js")).toBe("no-cache, must-revalidate");
  });

  it("caches fingerprinted assets forever", () => {
    expect(cacheControlFor("/assets/index-abc123.js")).toContain("immutable");
  });

  it("always revalidates the HTML shell, or a deploy reaches nobody", () => {
    expect(cacheControlFor("/")).toBe("no-cache");
    expect(cacheControlFor("/inspections/SN2026-00001")).toBe("no-cache");
  });
});
