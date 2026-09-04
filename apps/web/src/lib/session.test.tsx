import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider, useSession } from "./session.tsx";

/**
 * Who is signed in, and the difference between "nobody" and "we could not ask".
 *
 * That distinction is the whole point of this module. `null` is a real answer —
 * the server said there is no session — and anything else is a failure to ask,
 * which must not be reported as an answer. Conflating them signs a working user
 * out because their signal dropped for a moment, which on a phone in a garage is
 * not a rare event.
 */

const CURRENT_USER = {
  id: 1,
  username: "zawawi",
  displayName: "Zawawi",
  role: "supplier",
  mustChangePassword: false,
  mfaEnrolled: false,
  mfaEnrollmentRequired: false,
  permissions: ["submission.create", "photo.upload.own"],
  regions: [],
  unreadNotifications: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

function envelope(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function wrapper({ children }: { children: ReactNode }): ReactNode {
  // Retries off: this suite is about which answer arrives, not about how many
  // times it is asked for.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a signed-in user", () => {
  it("is reported once the server answers", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(envelope({ ok: true, data: CURRENT_USER, requestId: "req" })),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.user?.username).toBe("zawawi");
    });
    expect(result.current.unreachable).toBe(false);
  });

  it("answers `can` from the permissions the server sent", () => {
    // Layer 1 of PLAN/04 §2.2: hiding a menu is a courtesy, and the server
    // enforces the same rule regardless. It still has to be right.
    fetchMock.mockImplementation(() =>
      Promise.resolve(envelope({ ok: true, data: CURRENT_USER, requestId: "req" })),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    return waitFor(() => {
      expect(result.current.can("submission.create")).toBe(true);
      expect(result.current.can("user.manage")).toBe(false);
    });
  });
});

describe("no session", () => {
  it("treats SESSION_EXPIRED as an answer, not a failure", async () => {
    // The server said there is nobody signed in. That is a fact, and the login
    // screen is the right response — not an error banner.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        envelope(
          { ok: false, code: "SESSION_EXPIRED", message: "Sesi berakhir.", requestId: "req" },
          401,
        ),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.unreachable).toBe(false);
  });

  it("treats NOT_FOUND the same way", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        envelope({ ok: false, code: "NOT_FOUND", message: "Tidak ada.", requestId: "req" }, 404),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.unreachable).toBe(false);
  });
});

describe("the server could not be asked", () => {
  /*
   * These wait longer than the others on purpose.
   *
   * The session query rides out a transient failure before giving up — three
   * retries at 500ms, 1s and 2s — because `pnpm dev` restarts the API on every
   * file change and a restarting API is not a logout. So "unreachable" is a
   * conclusion reached after about three and a half seconds, not immediately,
   * and a test that waited one second would be asserting the wrong thing about
   * a system that is working correctly.
   */
  const AFTER_RETRIES = { timeout: 10_000 };
  it("is unreachable, not signed out", async () => {
    // The distinction that matters. Reporting this as "signed out" would throw a
    // supplier back to the login screen because their signal dropped.
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreachable).toBe(true);
    }, AFTER_RETRIES);
    expect(result.current.user).toBeNull();
    expect(result.current.error).not.toBeNull();
  }, 15_000);

  it("is unreachable when the server answers 500", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        envelope(
          { ok: false, code: "INTERNAL_ERROR", message: "Kesalahan sistem.", requestId: "req" },
          500,
        ),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreachable).toBe(true);
    }, AFTER_RETRIES);
  }, 15_000);

  it("offers a retry rather than only an apology", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.unreachable).toBe(true);
    }, AFTER_RETRIES);

    fetchMock.mockImplementation(() =>
      Promise.resolve(envelope({ ok: true, data: CURRENT_USER, requestId: "req" })),
    );
    await result.current.retry();

    await waitFor(() => {
      expect(result.current.user?.username).toBe("zawawi");
    }, AFTER_RETRIES);
  }, 20_000);
});

describe("useSession outside a provider", () => {
  it("says so rather than reporting nobody signed in", () => {
    // Returning a null user would render the login screen for a bug in the
    // component tree, which is a very confusing thing to debug.
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });
});
