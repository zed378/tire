import type { FastifyInstance } from "fastify";
import { markReadSchema, notificationListQuerySchema, updatePreferencesSchema } from "@c26/contracts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import {
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  updatePreferences,
} from "./notification-service.ts";

export function registerNotificationRoutes(app: FastifyInstance): void {
  app.get(
    "/api/notifications",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return listNotifications(actor, notificationListQuerySchema.parse(request.query));
    }),
  );

  app.post(
    "/api/notifications/read",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const { ids } = markReadSchema.parse(request.body);
      return markRead(actor, ids);
    }),
  );

  app.post(
    "/api/notifications/read-all",
    wrapRoute(async (request) => markAllRead(requireActor(request))),
  );

  app.get(
    "/api/notifications/preferences",
    wrapRoute(async (request) => getPreferences(requireActor(request))),
  );

  app.put(
    "/api/notifications/preferences",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return updatePreferences(actor, updatePreferencesSchema.parse(request.body));
    }),
  );
}
