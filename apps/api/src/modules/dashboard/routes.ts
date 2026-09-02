import type { FastifyInstance } from "fastify";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/session-service.ts";
import { getMetricsForRole } from "./dashboard-service.ts";

export function registerDashboardRoutes(app: FastifyInstance): void {
  app.get(
    "/api/dashboard/metrics",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const metrics = await getMetricsForRole({ id: actor.id, role: actor.role });
      return metrics;
    }),
  );
}
