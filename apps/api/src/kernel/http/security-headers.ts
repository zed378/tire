/**
 * Security headers (PLAN/13 §7), previously set by a reverse proxy.
 *
 * Three response classes, because one policy cannot fit all three:
 *
 *   spa      the HTML shell and its assets. Needs a real CSP.
 *   api      JSON. Needs nothing at all, so it gets nothing at all.
 *   storage  images on the storage host. Same: nothing but images.
 *
 * `unsafe-inline` appears nowhere (decision A-07). That is not free — it is why
 * the dashboard chart is hand-written SVG rather than a charting library, and
 * why no component sets a `style` attribute. Retrofitting it after hundreds of
 * components exist is far harder than starting with it, which is why PLAN/13
 * puts it in F0.
 */

export type ResponseClass = "spa" | "api" | "storage";

export interface HeaderContext {
  /** Public origin of the storage host, e.g. `https://tire-store.zedth.my.id`. */
  storageOrigin: string;
  /** False in local development, where there is no TLS to pin. */
  secure: boolean;
}

/** Applied to every response whatever its class. */
function baseHeaders(context: HeaderContext): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    // The camera is needed for photo capture; nothing else is.
    "permissions-policy": "camera=(self), geolocation=(), microphone=()",
    ...(context.secure
      ? { "strict-transport-security": "max-age=31536000; includeSubDomains; preload" }
      : {}),
  };
}

export function securityHeadersFor(
  responseClass: ResponseClass,
  context: HeaderContext,
): Record<string, string> {
  const base = baseHeaders(context);

  if (responseClass === "api") {
    return {
      ...base,
      // JSON. It loads nothing and must never be framed.
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    };
  }

  if (responseClass === "storage") {
    return {
      ...base,
      "content-security-policy": "default-src 'none'; img-src 'self'; frame-ancestors 'none'",
      // These URLs carry a signed token in the path; keep them out of referrers.
      "referrer-policy": "no-referrer",
      "cross-origin-resource-policy": "cross-origin",
    };
  }

  // `frame-ancestors 'none'` is worth noting: the legacy system lived INSIDE an
  // Apps Script sandbox iframe (B-07). This one refuses to be framed at all.
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    // Joined from a list rather than interpolated into a string: `.trim()`
    // tidies the ends and leaves the middle, so an empty storage origin used to
    // emit `img-src 'self'  data: blob:` with a double space. Browsers split on
    // whitespace and did not care, but a header should say exactly what it
    // means — and the next directive that interpolates something optional will
    // not be so lucky.
    ["img-src", "'self'", context.storageOrigin, "data:", "blob:"].filter(Boolean).join(" "),
    // The API is same-origin now, so 'self' covers it. The storage origin is
    // listed for the photo PUT.
    ["connect-src", "'self'", context.storageOrigin].filter(Boolean).join(" "),
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return { ...base, "content-security-policy": directives.join("; ") };
}

/**
 * Cache policy for a static asset (PLAN/06 §5.1).
 *
 * The service worker is the one file that must never be cached: a stale worker
 * serves an old application that then talks to a new API, and the user has no
 * way to notice.
 */
export function cacheControlFor(path: string): string {
  if (path === "/sw.js" || path.endsWith("/sw.js")) return "no-cache, must-revalidate";
  // Vite fingerprints these, so the URL changes whenever the content does.
  if (path.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  // The HTML shell itself: always revalidate, or a deploy never reaches anyone.
  return "no-cache";
}
