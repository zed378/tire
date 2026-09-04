import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION_HEADER, CSRF_COOKIE, CSRF_HEADER } from "@c26/contracts";

/**
 * The client half of `PLAN/05` §2 and §5.2.
 *
 * This module turns every server response into one of the three error channels,
 * and it sat at 17% coverage — the lowest of anything on the critical path. Two
 * of the rules it implements are absolute and had no test at all: rule 6, a
 * network failure becomes a banner and never a silent failure; rule 7, a 500
 * carries its `requestId` to the screen.
 *
 * Each test loads a fresh copy of the module. The step-up handler and the
 * version-mismatch handler are module-level state, and a handler registered by
 * one test would otherwise still be installed for the next.
 */

type ApiClient = typeof import("./api-client.ts");

let client: ApiClient;
let fetchMock: ReturnType<typeof vi.fn>;

function envelope(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function ok<T>(data: T): Response {
  return envelope({ ok: true, data, requestId: "req_test_0001" });
}

function failure(code: string, extra: Record<string, unknown> = {}): Response {
  return envelope({
    ok: false,
    code,
    message: "Pesan dari server.",
    requestId: "req_test_0002",
    ...extra,
  });
}

beforeEach(async () => {
  vi.resetModules();
  // `mockResolvedValue` would hand the SAME Response to every call, and a body
  // can only be read once — the second read fails as unparseable JSON, which
  // this module correctly turns into INTERNAL_ERROR. A factory per call.
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = `${CSRF_COOKIE}=token-from-cookie`;
  client = await import("./api-client.ts");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the success envelope", () => {
  it("returns the data and nothing around it", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(ok({ id: 7, name: "Hino" })));
    await expect(client.api.get("/api/vehicle-brands")).resolves.toEqual({ id: 7, name: "Hino" });
  });
});

describe("the error envelope", () => {
  it("throws an ApiError carrying the code, message and requestId", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(failure("NOT_FOUND")));

    await expect(client.api.get("/api/inspections/SN0")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Pesan dari server.",
      requestId: "req_test_0002",
    });
  });

  it("exposes field errors ready to hand to react-hook-form", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        failure("VALIDATION_ERROR", {
          errors: [{ field: "plateDisplay", code: "INVALID_FORMAT", message: "Format salah." }],
        }),
      ),
    );

    await expect(client.api.post("/api/vehicles")).rejects.toMatchObject({
      fieldErrors: [{ field: "plateDisplay", code: "INVALID_FORMAT", message: "Format salah." }],
    });
  });

  it("reports an empty list when the envelope names no field", async () => {
    // The forms branch on this: an empty list means "there is nothing to put
    // under a field", which is what sends the message to the page banner.
    fetchMock.mockImplementation(() => Promise.resolve(failure("FORBIDDEN_ROLE")));

    await client.api.get("/api/ops/health").catch((caught: unknown) => {
      expect(client.isApiError(caught)).toBe(true);
      if (client.isApiError(caught)) expect(caught.fieldErrors).toEqual([]);
    });
    expect.hasAssertions();
  });
});

describe("PLAN/05 §5.2 rule 6: a network failure is never silent", () => {
  it("turns a rejected fetch into SERVICE_UNAVAILABLE", async () => {
    // The garage case: the request never leaves the device. Anything other than
    // an error here is a screen that silently shows nothing.
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.api.get("/api/inspections")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      requestId: "offline",
    });
  });

  it("turns a response that is not JSON into INTERNAL_ERROR", async () => {
    // A proxy error page, or a gateway timeout served as HTML. Parsing it as an
    // envelope would throw somewhere far from here.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response("<html>502 Bad Gateway</html>", {
          status: 502,
          headers: { "x-request-id": "req_from_header" },
        }),
      ),
    );

    await expect(client.api.get("/api/inspections")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      // Rule 7 still applies: the id the user quotes has to come from
      // somewhere, and the header is all there is when the body is unreadable.
      requestId: "req_from_header",
    });
  });

  it("says `unknown` rather than inventing an id", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("not json", { status: 500 })),
    );

    await expect(client.api.get("/api/inspections")).rejects.toMatchObject({
      requestId: "unknown",
    });
  });
});

describe("the request it actually sends", () => {
  it("carries the CSRF token on a write and not on a read", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(ok(null)));

    await client.api.get("/api/inspections");
    const readHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(readHeaders?.[CSRF_HEADER]).toBeUndefined();

    await client.api.post("/api/inspections", { a: 1 });
    const writeHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(writeHeaders?.[CSRF_HEADER]).toBe("token-from-cookie");
  });

  it("declares JSON only when there is a body", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(ok(null)));

    await client.api.get("/api/inspections");
    const readHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(readHeaders?.["content-type"]).toBeUndefined();

    await client.api.post("/api/inspections", { a: 1 });
    const writeHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(writeHeaders?.["content-type"]).toBe("application/json");
  });

  it("sends the session cookie same-origin, never to another host", async () => {
    // `include` would let an accidental absolute URL carry the session cookie
    // off this origin. This is the tighter of the two settings on purpose.
    fetchMock.mockImplementation(() => Promise.resolve(ok(null)));
    await client.api.get("/api/inspections");

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).credentials).toBe("same-origin");
  });
});

describe("the query string", () => {
  async function urlFor(query: Record<string, unknown>): Promise<URL> {
    fetchMock.mockImplementation(() => Promise.resolve(ok(null)));
    await client.api.get("/api/inspections", query as never);
    return new URL(String(fetchMock.mock.calls[0]?.[0]));
  }

  it("drops an undefined value rather than sending the word", async () => {
    // `?status=undefined` is a filter the server would try to honour.
    const url = await urlFor({ page: 2, status: undefined });
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("repeats the key for an array, rather than joining it", async () => {
    const url = await urlFor({ status: ["draft", "pending_qc"] });
    expect(url.searchParams.getAll("status")).toEqual(["draft", "pending_qc"]);
  });

  it("stringifies numbers and booleans", async () => {
    const url = await urlFor({ page: 3, unreadOnly: true });
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("unreadOnly")).toBe("true");
  });
});

describe("handlers the application installs", () => {
  it("announces a session that has ended", async () => {
    const onExpired = vi.fn();
    client.setSessionExpiredHandler(onExpired);
    fetchMock.mockImplementation(() => Promise.resolve(failure("SESSION_EXPIRED")));

    await expect(client.api.get("/api/auth/me")).rejects.toBeDefined();
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("announces a client older than the API it is talking to", async () => {
    // PLAN/06 §5.1: a stale service worker serves an old client to a new API,
    // and the user has no way to notice.
    const onMismatch = vi.fn();
    client.setVersionMismatchHandler(onMismatch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        envelope(
          { ok: true, data: null, requestId: "req" },
          { headers: { "content-type": "application/json", [APP_VERSION_HEADER]: "9.9.9" } },
        ),
      ),
    );

    await client.api.get("/api/auth/me");
    expect(onMismatch).toHaveBeenCalledWith("9.9.9");
  });
});

describe("step-up (PLAN/13 §4)", () => {
  it("asks for a code and replays the original request", async () => {
    // The point of the whole mechanism: the user should not have to work out
    // that they must re-verify, find the button again, and press it twice.
    const askForCode = vi.fn().mockResolvedValue(true);
    client.setStepUpHandler(askForCode);

    fetchMock
      .mockResolvedValueOnce(failure("STEP_UP_REQUIRED"))
      .mockResolvedValueOnce(ok({ deleted: true }));

    await expect(client.api.delete("/api/users/2")).resolves.toEqual({ deleted: true });
    expect(askForCode).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up rather than looping when the elevation keeps being refused", async () => {
    const askForCode = vi.fn().mockResolvedValue(true);
    client.setStepUpHandler(askForCode);

    fetchMock.mockImplementation(() => Promise.resolve(failure("STEP_UP_REQUIRED")));

    await expect(client.api.delete("/api/users/2")).rejects.toMatchObject({
      code: "STEP_UP_REQUIRED",
    });
    // Once, not once per attempt: the replay carries a flag that stops it
    // asking again.
    expect(askForCode).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the error when the user cancels the dialog", async () => {
    const askForCode = vi.fn().mockResolvedValue(false);
    client.setStepUpHandler(askForCode);
    fetchMock.mockImplementation(() => Promise.resolve(failure("STEP_UP_REQUIRED")));

    await expect(client.api.delete("/api/users/2")).rejects.toMatchObject({
      code: "STEP_UP_REQUIRED",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
