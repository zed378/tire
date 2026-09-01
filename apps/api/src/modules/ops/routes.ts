import type { FastifyInstance } from "fastify";
import { cleanupOrphansSchema, jobActionSchema, jobListQuerySchema, logSearchSchema } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import {
  cancelJobs,
  cleanupOrphans,
  getHealth,
  listJobs,
  listOrphanUploads,
  retryJobs,
  searchLogs,
} from "./ops-service.ts";

export function registerOpsRoutes(app: FastifyInstance): void {
  /**
   * Public: the uptime monitor polls it every minute (PLAN/01 §6). It reports
   * status and version and nothing that would help an attacker.
   */
  app.get(
    "/api/health",
    wrapRoute(async () => {
      const report = await getHealth();
      return { status: report.status, version: report.version };
    }),
  );

  app.get(
    "/api/ops/health",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.health.read");
      return getHealth();
    }),
  );

  app.get(
    "/api/ops/jobs",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.health.read");
      return listJobs(jobListQuerySchema.parse(request.query));
    }),
  );

  // Both mutations require step-up (PLAN/13 §4) via `ops.job.retry`.
  app.post(
    "/api/ops/jobs/retry",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.job.retry");
      const { jobIds } = jobActionSchema.parse(request.body);
      return retryJobs(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        jobIds,
      );
    }),
  );

  app.post(
    "/api/ops/jobs/cancel",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.job.retry");
      const { jobIds } = jobActionSchema.parse(request.body);
      return cancelJobs(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        jobIds,
      );
    }),
  );

  app.get(
    "/api/ops/logs",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.log.search");
      const { requestId } = logSearchSchema.parse(request.query);
      return searchLogs(requestId);
    }),
  );

  app.get(
    "/api/ops/orphans",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.orphan.cleanup");
      return listOrphanUploads();
    }),
  );

  app.post(
    "/api/ops/orphans/cleanup",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "ops.orphan.cleanup");
      const { storageKeys } = cleanupOrphansSchema.parse(request.body);
      return cleanupOrphans(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        storageKeys,
      );
    }),
  );
}
