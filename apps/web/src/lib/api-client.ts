import {
  APP_VERSION_HEADER,
  CSRF_COOKIE,
  CSRF_HEADER,
  ERROR_DEFINITIONS,
  type ErrorEnvelope,
  type Envelope,
} from "@c26/contracts";

/**
 * The single HTTP client (PLAN/05 §5).
 *
 * Every response is one of the two envelope shapes, so every caller handles
 * failure the same way. This is what D-08 cost the legacy system: errors there
 * were `alert()` calls that could not be logged, monitored, or tested, and some
 * failures — clicking Submit Keputusan QC with no status selected — left no
 * trace at all.
 */

export class ApiError extends Error {
  readonly envelope: ErrorEnvelope;

  constructor(envelope: ErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
    this.envelope = envelope;
  }

  get code(): ErrorEnvelope["code"] {
    return this.envelope.code;
  }

  /** Field-level errors, ready to hand to react-hook-form. */
  get fieldErrors(): NonNullable<ErrorEnvelope["errors"]> {
    return this.envelope.errors ?? [];
  }

  /** Shown in small copyable text on every 500 (PLAN/05 §5.2 rule 7). */
  get requestId(): string {
    return this.envelope.requestId;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** The CSRF cookie is readable by design — that is the double-submit pattern. */
function csrfToken(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match?.[1] === undefined ? "" : decodeURIComponent(match[1]);
}

let onVersionMismatch: ((serverVersion: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

/**
 * Asks the user for a fresh authenticator code and returns whether they gave a
 * valid one. Installed by the step-up dialog in App.tsx.
 */
let onStepUpRequired: (() => Promise<boolean>) | null = null;

export function setVersionMismatchHandler(handler: (serverVersion: string) => void): void {
  onVersionMismatch = handler;
}

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export function setStepUpHandler(handler: () => Promise<boolean>): void {
  onStepUpRequired = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  signal?: AbortSignal;
  /** Internal: set when replaying a request after a successful step-up. */
  afterStepUp?: boolean;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      // Same-origin: Caddy proxies /api on the application's own hostname, and
      // in development Vite proxies it too. `same-origin` rather than `include`
      // is the tighter setting — it guarantees the session cookie cannot be
      // carried to another host by an accidental absolute URL.
      credentials: "same-origin",
      headers: {
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "GET" ? {} : { [CSRF_HEADER]: csrfToken() }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    // A network failure becomes a banner, never a silent failure
    // (PLAN/05 §5.2 rule 6).
    throw new ApiError({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
      message: ERROR_DEFINITIONS.SERVICE_UNAVAILABLE.message,
      requestId: "offline",
    });
  }

  // A stale service worker can serve an old client to a new API (PLAN/06 §5.1).
  const serverVersion = response.headers.get(APP_VERSION_HEADER);
  if (serverVersion !== null && serverVersion !== import.meta.env.VITE_APP_VERSION) {
    onVersionMismatch?.(serverVersion);
  }

  let envelope: Envelope<T>;
  try {
    // `response.json()` is typed `any`; the envelope shape is asserted here
    // because the server contract guarantees it (PLAN/05 §2) and there is no
    // runtime schema to parse against on this path without paying for it on
    // every request.
    const parsed: unknown = await response.json();
    envelope = parsed as Envelope<T>;
  } catch {
    throw new ApiError({
      ok: false,
      code: "INTERNAL_ERROR",
      message: ERROR_DEFINITIONS.INTERNAL_ERROR.message,
      requestId: response.headers.get("x-request-id") ?? "unknown",
    });
  }

  if (envelope.ok) return envelope.data;

  if (envelope.code === "SESSION_EXPIRED") onSessionExpired?.();

  /**
   * Step-up (PLAN/13 §4): the action is allowed, it just needs a fresh second
   * factor. The user is asked for a code and the original request is replayed —
   * they should not have to work out that they must re-verify, then find the
   * button again, then press it a second time.
   *
   * Replayed at most once, so a persistently refused elevation surfaces as the
   * error it is instead of looping.
   */
  if (
    envelope.code === "STEP_UP_REQUIRED" &&
    onStepUpRequired !== null &&
    options.afterStepUp !== true
  ) {
    const elevated = await onStepUpRequired();
    if (elevated) return apiRequest<T>(path, { ...options, afterStepUp: true });
  }

  throw new ApiError(envelope);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]): Promise<T> =>
    apiRequest<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown): Promise<T> => apiRequest<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, { method: "DELETE", body }),
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Page-level message for an error, ready to render in a banner. */
export function bannerMessageFor(error: unknown): string {
  if (isApiError(error)) return error.envelope.message;
  return ERROR_DEFINITIONS.INTERNAL_ERROR.message;
}
