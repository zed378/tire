import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE, STEP_UP_TTL_MINUTES } from "@c26/contracts";
import { loadConfig } from "../../kernel/config.ts";
import { getPrisma, type Tx } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import type { Actor } from "../../kernel/authorization.ts";
import {
  deviceLabelFrom,
  hashSessionToken,
  issueCsrfToken,
  issueSessionToken,
  renewedExpiry,
  sessionLifetime,
} from "../../kernel/security/session-token.ts";
import { setCsrfCookie, clearCsrfCookie } from "../../kernel/http/csrf.ts";

/**
 * Session lifecycle (PLAN/04 §4.2, PLAN/13 §2, §5).
 *
 * Opaque server sessions, not JWTs. The whole reason is revocability: PLAN/04 §5
 * requires that downgrading a role cuts off access immediately, and only a
 * server session can do that. `revokeAllSessions` below is that requirement in
 * one function.
 */

export interface CreateSessionInput {
  userId: bigint;
  userAgent: string | undefined;
  ipAddress: string | null;
  mfaSatisfied: boolean;
}

export interface CreatedSession {
  sessionId: string;
  tokenValue: string;
  csrfToken: string;
  deviceLabel: string;
  expiresAt: Date;
  /** True when this device/subnet has not been seen before (PLAN/13 §5). */
  isNewDevice: boolean;
}

export async function createSession(tx: Tx, input: CreateSessionInput): Promise<CreatedSession> {
  const token = issueSessionToken();
  const csrfToken = issueCsrfToken();
  const { expiresAt, absoluteExpiresAt } = sessionLifetime();
  const deviceLabel = deviceLabelFrom(input.userAgent);

  const priorDevices = await tx.session.findMany({
    where: { userId: input.userId },
    select: { deviceLabel: true, ipAddress: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  const isNewDevice = !priorDevices.some((prior) => prior.deviceLabel === deviceLabel);

  const session = await tx.session.create({
    data: {
      userId: input.userId,
      tokenHash: token.hash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress,
      deviceLabel,
      mfaSatisfied: input.mfaSatisfied,
      csrfToken,
      expiresAt,
      absoluteExpiresAt,
    },
    select: { id: true },
  });

  return {
    sessionId: session.id,
    tokenValue: token.value,
    csrfToken,
    deviceLabel,
    expiresAt,
    isNewDevice,
  };
}

export function attachSessionCookies(
  reply: FastifyReply,
  session: { tokenValue: string; csrfToken: string; expiresAt: Date },
): void {
  const config = loadConfig();
  const secure = config.APP_ENV !== "local";

  reply.setCookie(SESSION_COOKIE, session.tokenValue, {
    httpOnly: true, // JavaScript cannot read it — that is the point (PLAN/06 §5)
    secure,
    // Strict, not Lax. No flow in this system needs the looser setting: there is
    // no email-link login and no third-party OAuth (PLAN/13 §2.1).
    sameSite: "strict",
    path: "/",
    // Omitted when COOKIE_DOMAIN is empty, giving a host-only cookie. That is
    // what keeps the session off tire-store.zedth.my.id entirely.
    ...(config.COOKIE_DOMAIN === "" ? {} : { domain: config.COOKIE_DOMAIN }),
    expires: session.expiresAt,
  });

  setCsrfCookie(reply, session.csrfToken, config.COOKIE_DOMAIN, secure);
}

export function clearSessionCookies(reply: FastifyReply): void {
  const config = loadConfig();
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
    ...(config.COOKIE_DOMAIN === "" ? {} : { domain: config.COOKIE_DOMAIN }),
  });
  clearCsrfCookie(reply, config.COOKIE_DOMAIN);
}

/**
 * Resolves the session cookie into an Actor.
 *
 * Returns null rather than throwing, so a route can be optionally authenticated.
 * `requireActor` below is what routes use.
 */
export async function resolveActor(request: FastifyRequest): Promise<Actor | null> {
  const tokenValue = request.cookies[SESSION_COOKIE];
  if (tokenValue === undefined || tokenValue === "") return null;

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(tokenValue) },
    include: {
      user: {
        include: { regions: { select: { provinceId: true, cityId: true } } },
      },
    },
  });

  if (session === null) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  // Deactivating or deleting a user must take effect on the next request, not
  // whenever their session happens to expire.
  if (!session.user.isActive || session.user.deletedAt !== null) return null;

  // Sliding renewal, bounded by the absolute ceiling. Written outside the
  // request's own transaction on purpose: session bookkeeping must not roll back
  // a business operation, nor be rolled back by one.
  const nextExpiry = renewedExpiry(session.absoluteExpiresAt);
  if (nextExpiry.getTime() - session.expiresAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: nextExpiry, lastSeenAt: new Date() },
    });
  }

  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
    sessionId: session.id,
    elevatedUntil: session.elevatedUntil,
    provinceIds: session.user.regions
      .map((r) => r.provinceId)
      .filter((id): id is bigint => id !== null),
    cityIds: session.user.regions.map((r) => r.cityId).filter((id): id is bigint => id !== null),
  };
}

export function requireActor(request: FastifyRequest): Actor {
  if (request.actor === null) throw new AppError("SESSION_EXPIRED");
  return request.actor;
}

/** Marks a session as step-up verified for the next 15 minutes (PLAN/13 §4). */
export async function elevateSession(sessionId: string): Promise<Date> {
  const elevatedUntil = new Date(Date.now() + STEP_UP_TTL_MINUTES * 60 * 1000);
  await getPrisma().session.update({ where: { id: sessionId }, data: { elevatedUntil } });
  return elevatedUntil;
}

export async function revokeSession(tx: Tx, sessionId: string): Promise<void> {
  await tx.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes every session for a user.
 *
 * Called on role change, password reset, deactivation, and MFA reset. This is
 * the capability PLAN/13 §1.1 chose server sessions to obtain; with a JWT the
 * old token would keep working until it expired.
 */
export async function revokeAllSessions(
  tx: Tx,
  userId: bigint,
  options: { exceptSessionId?: string } = {},
): Promise<number> {
  const result = await tx.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId !== undefined ? { NOT: { id: options.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
