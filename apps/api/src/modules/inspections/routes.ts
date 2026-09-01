import type { FastifyInstance } from "fastify";
import {
  createInspectionSchema,
  inspectionListQuerySchema,
  previewPositionsSchema,
  saveDraftSchema,
} from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import {
  createInspection,
  getInspectionDetail,
  listInspections,
  previewPositions,
  saveDraft,
  submitInspection,
} from "./inspection-service.ts";

export function registerInspectionRoutes(app: FastifyInstance): void {
  app.get(
    "/api/inspections",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      // D-10: a supplier finally sees their own submissions. The scope is
      // applied in the query, not by hiding a menu.
      return listInspections(actor, inspectionListQuerySchema.parse(request.query));
    }),
  );

  app.get<{ Params: { sn: string } }>(
    "/api/inspections/:sn",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return getInspectionDetail(actor, request.params.sn);
    }),
  );

  app.post(
    "/api/inspections",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "submission.create");

      return createInspection(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        createInspectionSchema.parse(request.body),
      );
    }, 201),
  );

  app.patch<{ Params: { sn: string } }>(
    "/api/inspections/:sn",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "submission.update.own_draft");

      await saveDraft(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        saveDraftSchema.parse(request.body),
      );
      return { saved: true };
    }),
  );

  app.post<{ Params: { sn: string } }>(
    "/api/inspections/:sn/submit",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "submission.create");

      return submitInspection(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
      );
    }),
  );

  /**
   * PLAN/05 §6. The client derives positions locally too — it must, to build
   * photo slots offline (PLAN/06 §2) — but this endpoint is what the server
   * decides by. Both sides call the same function from @c26/contracts, so they
   * cannot disagree; this route exists so the client can verify rather than
   * assume.
   */
  app.post(
    "/api/inspections/preview-positions",
    // Synchronous on purpose: the engine is pure logic with no I/O, so there is
    // nothing to await (PLAN/01 §2.3 rule 3).
    wrapRoute((request) => {
      requireActor(request);
      return Promise.resolve(previewPositions(previewPositionsSchema.parse(request.body)));
    }),
  );
}
