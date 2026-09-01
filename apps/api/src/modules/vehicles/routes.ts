import type { FastifyInstance } from "fastify";
import { vehicleSearchSchema } from "@c26/contracts";
import { AppError, wrapRoute } from "../../kernel/envelope/index.ts";
import { RATE_LIMITS } from "../../kernel/http/rate-limits.ts";
import { requireActor } from "../auth/index.ts";
import { getVehicle, searchVehicles } from "./vehicle-service.ts";

export function registerVehicleRoutes(app: FastifyInstance): void {
  /**
   * PLAN/11 §6. The supplier types a plate and either confirms the vehicle the
   * system found or fills the full form. The match is never applied silently:
   * plates get reassigned to other vehicles, so treating a plate hit as proof of
   * identity would create a new class of error rather than remove one.
   *
   * Rate-limited per PLAN/13 §6 — without it, this endpoint answers "is plate X
   * registered?" often enough to map a customer's whole fleet.
   */
  app.get(
    "/api/vehicles/search",
    { config: { rateLimit: RATE_LIMITS.vehicleSearch } },
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      const input = vehicleSearchSchema.parse(request.query);

      if (input.plate === undefined && input.chassisNumber === undefined) {
        throw new AppError("VALIDATION_ERROR", {
          fieldErrors: [
            { field: "plate", code: "REQUIRED", message: "Masukkan plat nomor atau nomor rangka." },
          ],
        });
      }

      return searchVehicles(actor, input);
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/api/vehicles/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      return getVehicle(actor, BigInt(request.params.id));
    }),
  );
}
