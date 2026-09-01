import type { FastifyInstance } from "fastify";
import { createExportSchema, regionProgressQuerySchema } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import { getExportStatus, getRegionProgress, listExports, requestExport } from "./report-service.ts";

export function registerReportRoutes(app: FastifyInstance): void {
  app.get(
    "/api/reports/region-progress",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "report.view");
      return getRegionProgress(regionProgressQuerySchema.parse(request.query));
    }),
  );

  /**
   * D-14: `report.export` is granted to `manager` as well as `admin`. The role
   * whose entire job is reporting was the only one in the legacy system that
   * could not export anything.
   */
  app.post(
    "/api/reports/export",
    wrapRoute(async (request, reply) => {
      const actor = requireActor(request);
      requirePermission(actor, "report.export");

      const accepted = await requestExport(
        actor,
        request.requestId,
        createExportSchema.parse(request.body),
      );

      // 202, not 200: the work has been accepted, not finished. That distinction
      // is what lets the client show honest progress instead of a lie.
      void reply.status(202);
      return accepted;
    }, 202),
  );

  app.get<{ Params: { jobId: string } }>(
    "/api/exports/:jobId",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return getExportStatus(actor, request.params.jobId);
    }),
  );

  app.get(
    "/api/exports",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "report.export");
      return listExports(actor);
    }),
  );
}
