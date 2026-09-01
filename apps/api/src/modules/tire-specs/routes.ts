import type { FastifyInstance } from "fastify";
import { copyTireSpecSchema, saveTireSpecsSchema } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import { copySpec, getSheet, saveSpecs } from "./tire-spec-service.ts";

export function registerTireSpecRoutes(app: FastifyInstance): void {
  app.get<{ Params: { sn: string } }>(
    "/api/inspections/:sn/tire-specs",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return getSheet(actor, request.params.sn);
    }),
  );

  app.put<{ Params: { sn: string } }>(
    "/api/inspections/:sn/tire-specs",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "tirespec.write");

      return saveSpecs(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        saveTireSpecsSchema.parse(request.body),
      );
    }),
  );

  app.post<{ Params: { sn: string } }>(
    "/api/inspections/:sn/tire-specs/copy",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "tirespec.write");

      return copySpec(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        copyTireSpecSchema.parse(request.body),
      );
    }),
  );
}
