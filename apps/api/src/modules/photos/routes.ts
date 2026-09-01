import type { FastifyInstance } from "fastify";
import { confirmUploadSchema, presignSchema } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { RATE_LIMITS } from "../../kernel/http/rate-limits.ts";
import { requireActor } from "../auth/index.ts";
import { confirmUpload, deletePhoto, listPhotos, presign } from "./photo-service.ts";

export function registerPhotoRoutes(app: FastifyInstance): void {
  app.post<{ Params: { sn: string } }>(
    "/api/inspections/:sn/photos/presign",
    { config: { rateLimit: RATE_LIMITS.presign } },
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "photo.upload.own");
      return presign(actor, request.params.sn, presignSchema.parse(request.body));
    }),
  );

  app.post<{ Params: { sn: string } }>(
    "/api/inspections/:sn/photos/confirm",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "photo.upload.own");

      return confirmUpload(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        request.params.sn,
        confirmUploadSchema.parse(request.body),
      );
    }, 201),
  );

  app.get<{ Params: { sn: string } }>(
    "/api/inspections/:sn/photos",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "photo.read");
      return listPhotos(actor, request.params.sn);
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/api/photos/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      await deletePhoto(
        actor,
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        BigInt(request.params.id),
      );
      return { deleted: true };
    }),
  );
}
