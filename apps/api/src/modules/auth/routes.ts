import type { FastifyInstance } from "fastify";
import {
  changePasswordSchema,
  loginSchema,
  permissionsFor,
  ROLES_REQUIRING_MFA,
  totpCodeSchema,
  type CurrentUser,
} from "@c26/contracts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError, wrapRoute } from "../../kernel/envelope/index.ts";
import { RATE_LIMITS } from "../../kernel/http/rate-limits.ts";
import {
  assertTotpOrThrow,
  auditStepUp,
  changePassword,
  listSessions,
  login,
} from "./auth-service.ts";
import { confirmEnrollment, remainingRecoveryCodes, startEnrollment } from "./mfa-service.ts";
import {
  attachSessionCookies,
  clearSessionCookies,
  elevateSession,
  requireActor,
  revokeAllSessions,
  revokeSession,
} from "./session-service.ts";

/**
 * Authentication routes (PLAN/05 §6).
 *
 * There is deliberately no route that authenticates without verifying a
 * password. D-16 is the reason it is worth writing down: the legacy login page
 * carried three buttons that logged in as Supplier, Admin, or PM/SPV with no
 * credentials at all.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    "/api/auth/login",
    { config: { rateLimit: RATE_LIMITS.login } },
    wrapRoute(async (request, reply) => {
      const input = loginSchema.parse(request.body);

      const outcome = await login(input, {
        requestId: request.requestId,
        ipAddress: request.clientIp,
        userAgent: request.headers["user-agent"],
      });

      if (outcome.session !== null) attachSessionCookies(reply, outcome.session);
      return outcome.result;
    }),
  );

  app.post(
    "/api/auth/logout",
    wrapRoute(async (request, reply) => {
      const actor = request.actor;
      if (actor !== null) {
        await withTransaction(async (tx) => revokeSession(tx, actor.sessionId));
      }
      // Clearing the cookies is half of it; the client wipes its own state on
      // the other side. D-17 found the legacy tab state surviving a logout and
      // login, which meant the session boundary was not being respected at all.
      clearSessionCookies(reply);
      return { loggedOut: true };
    }),
  );

  app.post(
    "/api/auth/logout-all",
    wrapRoute(async (request, reply) => {
      const actor = requireActor(request);
      const count = await withTransaction(async (tx) => revokeAllSessions(tx, actor.id));
      clearSessionCookies(reply);
      return { revokedSessions: count };
    }),
  );

  app.get(
    "/api/auth/me",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const prisma = getPrisma();

      const [user, unread] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: actor.id },
          include: {
            mfa: true,
            regions: { include: { province: true, city: true } },
          },
        }),
        prisma.notification.count({
          where: { recipientId: actor.id, channel: "in_app", readAt: null },
        }),
      ]);

      const mfaEnrolled = user.mfa !== null && user.mfa.confirmedAt !== null;
      const mfaRequired = ROLES_REQUIRING_MFA.includes(user.role);

      const currentUser: CurrentUser = {
        id: Number(user.id),
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        mfaEnrolled,
        mfaEnrollmentRequired: mfaRequired && !mfaEnrolled,
        permissions: [...permissionsFor(user.role)],
        regions: user.regions.map((region) => ({
          provinceId: region.provinceId === null ? null : Number(region.provinceId),
          cityId: region.cityId === null ? null : Number(region.cityId),
          name: region.city?.name ?? region.province?.name ?? "",
        })),
        unreadNotifications: unread,
      };

      return currentUser;
    }),
  );

  app.post(
    "/api/auth/change-password",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const input = changePasswordSchema.parse(request.body);

      await changePassword(actor.id, actor.sessionId, input, {
        requestId: request.requestId,
        ipAddress: request.clientIp,
      });

      return { changed: true };
    }),
  );

  // ── MFA ───────────────────────────────────────────────────────────────────

  app.post(
    "/api/auth/mfa/enroll",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return startEnrollment({ id: actor.id, username: actor.username });
    }),
  );

  app.post(
    "/api/auth/mfa/confirm",
    { config: { rateLimit: RATE_LIMITS.mfaVerify } },
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const { code } = totpCodeSchema.parse(request.body);

      return confirmEnrollment({ id: actor.id, role: actor.role }, code, {
        requestId: request.requestId,
        ipAddress: request.clientIp,
      });
    }),
  );

  app.get(
    "/api/auth/mfa/status",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const mfa = await getPrisma().userMfa.findUnique({ where: { userId: actor.id } });
      return {
        enrolled: mfa !== null && mfa.confirmedAt !== null,
        required: ROLES_REQUIRING_MFA.includes(actor.role),
        remainingRecoveryCodes: await remainingRecoveryCodes(actor.id),
      };
    }),
  );

  /**
   * Step-up verification (PLAN/13 §4).
   *
   * The client calls this in response to a 403 STEP_UP_REQUIRED and then retries
   * the original request. It asks for a code rather than throwing the user out
   * of the application.
   */
  app.post(
    "/api/auth/step-up",
    { config: { rateLimit: RATE_LIMITS.mfaVerify } },
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const { code } = totpCodeSchema.parse(request.body);

      try {
        await assertTotpOrThrow(actor.id, code);
      } catch (error) {
        await withTransaction(async (tx) =>
          auditStepUp(tx, actor, { requestId: request.requestId, ipAddress: request.clientIp }, false),
        );
        throw error;
      }

      const elevatedUntil = await elevateSession(actor.sessionId);
      await withTransaction(async (tx) =>
        auditStepUp(tx, actor, { requestId: request.requestId, ipAddress: request.clientIp }, true),
      );

      return { elevatedUntil: elevatedUntil.toISOString() };
    }),
  );

  // ── Device and session management (PLAN/13 §5) ────────────────────────────

  app.get(
    "/api/auth/sessions",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return listSessions(actor.id, actor.sessionId);
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/api/auth/sessions/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const target = await getPrisma().session.findUnique({ where: { id: request.params.id } });

      // Scope check, not a role check: a session belonging to someone else is
      // simply not visible.
      if (target === null || target.userId !== actor.id) throw new AppError("NOT_FOUND");

      await withTransaction(async (tx) => revokeSession(tx, target.id));
      return { revoked: true };
    }),
  );
}
