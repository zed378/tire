import type { FastifyInstance } from "fastify";
import { wrapRoute } from "../../kernel/envelope/index.ts";
// Through the module's public surface, never its internals (PLAN/01 §2.3
// rule 1). The linter enforces this; it was reaching into session-service.ts.
import { requireActor } from "../auth/index.ts";
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
