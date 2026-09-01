import type { FastifyInstance } from "fastify";
import {
  createUserSchema,
  deleteUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { RATE_LIMITS } from "../../kernel/http/rate-limits.ts";
import { requireActor, resetMfa } from "../auth/index.ts";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  resetPassword,
  updateUser,
} from "./user-service.ts";

/** User management routes (PLAN/05 §6). `user.manage` requires step-up (PLAN/13 §4). */
export function registerUserRoutes(app: FastifyInstance): void {
  app.get(
    "/api/users",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      // Reading the list does not need elevation; only the mutations below do,
      // so the permission check here is the plain role check.
      if (!["admin", "operator"].includes(actor.role)) {
        requirePermission(actor, "user.manage");
      }
      return listUsers(userListQuerySchema.parse(request.query));
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/api/users/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      if (!["admin", "operator"].includes(actor.role)) {
        requirePermission(actor, "user.manage");
      }
      return getUser(BigInt(request.params.id));
    }),
  );

  app.post(
    "/api/users",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "user.manage");

      const input = createUserSchema.parse(request.body);
      const created = await createUser(
        {
          id: actor.id,
          role: actor.role,
          requestId: request.requestId,
          ipAddress: request.clientIp,
        },
        input,
      );

      // The temporary password is returned exactly once, for the admin to pass
      // on out of band. It is never stored in readable form.
      return created;
    }, 201),
  );

  app.patch<{ Params: { id: string } }>(
    "/api/users/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "user.manage");

      return updateUser(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        BigInt(request.params.id),
        updateUserSchema.parse(request.body),
      );
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/api/users/:id/reset-password",
    { config: { rateLimit: RATE_LIMITS.passwordReset } },
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "user.manage");

      return resetPassword(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        BigInt(request.params.id),
      );
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/api/users/:id/reset-mfa",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "user.manage");

      await resetMfa({ id: actor.id, role: actor.role }, BigInt(request.params.id), {
        requestId: request.requestId,
        ipAddress: request.clientIp,
      });
      return { reset: true };
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/api/users/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "user.manage");

      const { confirmUsername } = deleteUserSchema.parse(request.body);
      await deleteUser(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        BigInt(request.params.id),
        confirmUsername,
      );
      return { deleted: true };
    }),
  );
}
