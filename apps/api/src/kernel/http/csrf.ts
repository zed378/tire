import type { FastifyReply, FastifyRequest } from "fastify";
import { CSRF_COOKIE, CSRF_HEADER } from "@c26/contracts";
import { AppError } from "../envelope/index.ts";
import { safeEqual } from "../security/password.ts";

/**
 * Double-submit CSRF protection (PLAN/13 §2.2).
 *
 * The split into a static SPA plus a separate API moved authentication onto a
 * different origin, which creates an attack surface a single-origin app does not
 * have. `SameSite=Strict` already closes almost all of it — and it can stay
 * Strict because tire.zedth.my.id and tire-api.zedth.my.id share a registrable
 * domain, so their requests are same-site.
 *
 * This is the second layer, the one that does not depend on browser behaviour:
 * the server sets a second cookie readable by JavaScript, the client echoes it
 * in a header, and a cross-origin attacker cannot read the cookie to build the
 * header.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function verifyCsrf(request: FastifyRequest): void {
  if (SAFE_METHODS.has(request.method)) return;

  const cookieToken = request.cookies[CSRF_COOKIE];
  const headerToken = request.headers[CSRF_HEADER];
  const header = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (
    cookieToken === undefined ||
    cookieToken === "" ||
    header === undefined ||
    header === "" ||
    !safeEqual(cookieToken, header)
  ) {
    throw new AppError("CSRF_MISMATCH");
  }
}

/** An empty domain means a host-only cookie; the attribute is omitted entirely. */
export function setCsrfCookie(reply: FastifyReply, token: string, domain: string, secure: boolean): void {
  reply.setCookie(CSRF_COOKIE, token, {
    // Deliberately NOT httpOnly: the client has to read it to build the header.
    // It is not a credential on its own — the session cookie is, and that one is
    // httpOnly precisely so XSS cannot reach it (PLAN/06 §5).
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    ...(domain === "" ? {} : { domain }),
  });
}

export function clearCsrfCookie(reply: FastifyReply, domain: string): void {
  reply.clearCookie(CSRF_COOKIE, { path: "/", ...(domain === "" ? {} : { domain }) });
}
