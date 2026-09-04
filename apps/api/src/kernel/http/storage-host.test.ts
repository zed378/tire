import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * The storage hostname, exercised through the running application.
 *
 * Every other test in this directory is a unit test, and the production outage
 * that prompted these went straight past all of them: `hosts.ts` was correct,
 * `security-headers.ts` was correct, and the two were wired together with a
 * configuration value that made both no-ops. Nothing asserted what an actual
 * request receives.
 *
 * No database is touched. These requests carry no session cookie, so the actor
 * resolves to nobody and none of them reaches a repository — which is precisely
 * what makes the host boundary testable on its own.
 */

const STORAGE_HOST = "tire-store.zedth.my.id";
const APP_HOST = "tire.zedth.my.id";

let app: FastifyInstance;
let validPutToken: string;

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.STORAGE_SIGNING_KEY = "test-key-at-least-16";
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  process.env.WEB_ORIGIN = `https://${APP_HOST}`;
  process.env.PUBLIC_API_URL = `https://${STORAGE_HOST}`;
  process.env.STORAGE_HOST = STORAGE_HOST;
  process.env.APP_ENV = "production";
  process.env.LOG_LEVEL = "silent";

  const { resetConfigCache } = await import("../config.ts");
  resetConfigCache();

  // A genuine token. A forged one is answered 404 on purpose — "forged,
  // altered, or expired all read the same: there is nothing here" — which is
  // indistinguishable from the host guard refusing the route, and that is the
  // very thing these tests exist to tell apart.
  const { createStorageToken } = await import("../storage/local-driver.ts");
  validPutToken = createStorageToken({
    key: "inspections/2026/SN2026-00001/tire/abc.webp",
    size: 3,
    mime: "image/webp",
    checksum: "0".repeat(64),
    expiresAt: Date.now() + 60_000,
    operation: "put",
  });

  const { buildApp } = await import("../../app.ts");
  app = buildApp();
  await app.ready();
  // Generous: this is the only test that loads the whole module graph, Prisma
  // client included, and that import alone runs to several seconds on a cold
  // cache. Nothing here connects to the database.
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe("the storage host serves one route and nothing else", () => {
  it("answers 404 for the API it is not allowed to expose", async () => {
    // 404 rather than 403 on purpose: somebody who discovers this hostname
    // should learn nothing about what else the process can do.
    for (const path of ["/api/users", "/api/inspections", "/api/audit", "/api/auth/me"]) {
      const response = await app.inject({
        method: "GET",
        url: path,
        headers: { host: STORAGE_HOST },
      });

      expect(response.statusCode, `${path} on the storage host`).toBe(404);
    }
  });

  it("lets the signed upload route through", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/uploads/${validPutToken}`,
      headers: { host: STORAGE_HOST, "content-type": "image/webp" },
      // One byte short of what the token registered, so the route refuses it
      // AFTER verifying the token and writes nothing to disk. 400 proves the
      // request reached the handler; 404 would mean the host guard ate it.
      payload: Buffer.from([1, 2]),
    });

    expect(response.statusCode).toBe(400);
  });

  it("does not restrict the application host", async () => {
    // Compared by response class rather than by status: the same path is a
    // 404 on both hosts here (no SPA is built in a unit test), but the storage
    // host is recognised and gets the storage policy while the application host
    // gets the SPA one. That difference IS the routing decision, and it needs
    // no database to observe.
    const onStorage = await app.inject({
      method: "GET",
      url: "/beranda",
      headers: { host: STORAGE_HOST },
    });
    const onApp = await app.inject({
      method: "GET",
      url: "/beranda",
      headers: { host: APP_HOST },
    });

    expect(String(onStorage.headers["content-security-policy"])).toContain("default-src 'none'");
    expect(String(onApp.headers["content-security-policy"])).toContain("default-src 'self'");
  });
});

describe("the browser is told what it needs to reach the storage host", () => {
  it("puts the storage origin in the CSP the SPA is served under", async () => {
    // The outage in one assertion: with STORAGE_HOST unset this header read
    // `connect-src 'self'` and the browser refused every upload before it left
    // the device.
    const response = await app.inject({
      method: "GET",
      url: "/nonexistent-spa-route",
      headers: { host: APP_HOST },
    });

    const csp = String(response.headers["content-security-policy"] ?? "");
    expect(csp).toContain(`connect-src 'self' https://${STORAGE_HOST}`);
    expect(csp).toContain(`img-src 'self' https://${STORAGE_HOST}`);
  });

  it("answers the cross-origin preflight the upload PUT triggers", async () => {
    /*
     * `content-type: image/webp` is not a CORS-safelisted value, so the browser
     * sends OPTIONS first and will not send the PUT unless this answers. The
     * preflight arrives on the storage host, which is the one host whose routes
     * are restricted — so it has to pass the guard as well as CORS.
     */
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/uploads/not-a-real-token",
      headers: {
        host: STORAGE_HOST,
        origin: `https://${APP_HOST}`,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers["access-control-allow-origin"]).toBe(`https://${APP_HOST}`);
    expect(String(response.headers["access-control-allow-methods"] ?? "")).toContain("PUT");
    expect(String(response.headers["access-control-allow-headers"] ?? "")).toContain(
      "content-type",
    );
  });

  it("lets the application origin display what the storage host serves", async () => {
    // Without `cross-origin`, the upload succeeds and the thumbnail then fails
    // to render — a broken image with no error anyone would connect to a header.
    const response = await app.inject({
      method: "GET",
      url: "/api/uploads/not-a-real-token",
      headers: { host: STORAGE_HOST },
    });

    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    // The signed token is in the path, so it must not travel in a referrer.
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });
});
