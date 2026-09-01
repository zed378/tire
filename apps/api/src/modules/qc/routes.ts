import type { FastifyInstance } from "fastify";
import { qcDecisionSchema, qcQueueQuerySchema, qcRevertSchema } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import { decide, getQueue, getReviewHistory, getStats, revert } from "./qc-service.ts";

export function registerQcRoutes(app: FastifyInstance): void {
  app.get(
    "/api/qc/queue",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "qc.review");
      return getQueue(actor, qcQueueQuerySchema.parse(request.query));
    }),
  );

  app.get(
    "/api/qc/stats",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "qc.review");
      // Same filter as the table below it. In the legacy system these three
      // numbers ignored the filter entirely, which is how D-01 surfaced.
      return getStats(qcQueueQuerySchema.parse(request.query));
    }),
  );

  app.post<{ Params: { sn: string } }>(
    "/api/qc/:sn/decide",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "qc.review");

      return decide(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        qcDecisionSchema.parse(request.body),
      );
    }),
  );

  app.post<{ Params: { sn: string } }>(
    "/api/qc/:sn/revert",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "qc.revert");

      const { reason } = qcRevertSchema.parse(request.body);
      return revert(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        reason,
      );
    }),
  );

  /**
   * Readable by the supplier who owns the inspection: seeing the reason is the
   * whole point of closing D-11. The reviewing admin's name is not exposed to
   * them (PLAN/03 §8).
   */
  app.get<{ Params: { sn: string } }>(
    "/api/qc/:sn/reviews",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return getReviewHistory(actor, request.params.sn);
    }),
  );
}
