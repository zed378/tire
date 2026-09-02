import type { FastifyInstance } from "fastify";
import {
  paginationSchema,
  createVehicleBrandSchema,
  updateVehicleBrandSchema,
  createTireBrandPatternSchema,
  updateTireBrandPatternSchema,
} from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import { getPrisma } from "../../kernel/db.ts";
import { VehicleBrandService } from "./vehicle-brand-service.js";
import { TireBrandPatternService } from "./tire-brand-pattern-service.js";

export function registerMasterBrandRoutes(app: FastifyInstance): void {
  const prisma = getPrisma();
  const vehicleService = new VehicleBrandService(prisma);
  const patternService = new TireBrandPatternService(prisma);

  // ── Vehicle Brands ──────────────────────────────────────────────────────

  /**
   * GET /api/vehicle-brands
   * List all vehicle brands with pagination
   */
  app.get(
    "/api/vehicle-brands",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const parsed = paginationSchema.parse(request.query);
      const result = await vehicleService.listVehicleBrands(parsed.page, parsed.perPage);

      return result;
    }),
  );

  /**
   * GET /api/vehicle-brands/:id
   * Get a specific vehicle brand
   */
  app.get(
    "/api/vehicle-brands/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      return vehicleService.getVehicleBrand(id);
    }),
  );

  /**
   * POST /api/vehicle-brands
   * Create a new vehicle brand
   */
  app.post(
    "/api/vehicle-brands",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const input = createVehicleBrandSchema.parse(request.body);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      return vehicleService.createVehicleBrand(actor, auditActor, input);
    }),
  );

  /**
   * PATCH /api/vehicle-brands/:id
   * Update a vehicle brand
   */
  app.patch(
    "/api/vehicle-brands/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      const input = updateVehicleBrandSchema.parse(request.body);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      return vehicleService.updateVehicleBrand(actor, auditActor, id, input);
    }),
  );

  /**
   * DELETE /api/vehicle-brands/:id
   * Delete a vehicle brand
   */
  app.delete(
    "/api/vehicle-brands/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      await vehicleService.deleteVehicleBrand(actor, auditActor, id);
      return null;
    }),
  );

  // ── Tire Brand Patterns ─────────────────────────────────────────────────

  /**
   * GET /api/tire-brand-patterns/:type
   * List tire brand patterns (TB or LT) with pagination
   */
  app.get(
    "/api/tire-brand-patterns/:type",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const type = (request.params as { type: string }).type as "TB" | "LT";
      const parsed = paginationSchema.parse(request.query);

      return patternService.listTireBrandPatterns(type, parsed.page, parsed.perPage);
    }),
  );

  /**
   * GET /api/tire-brand-patterns/detail/:id
   * Get a specific tire brand pattern
   */
  app.get(
    "/api/tire-brand-patterns/detail/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      return patternService.getTireBrandPattern(id);
    }),
  );

  /**
   * POST /api/tire-brand-patterns
   * Create a new tire brand pattern
   */
  app.post(
    "/api/tire-brand-patterns",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const input = createTireBrandPatternSchema.parse(request.body);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      return patternService.createTireBrandPattern(actor, auditActor, input);
    }),
  );

  /**
   * PATCH /api/tire-brand-patterns/:id
   * Update a tire brand pattern
   */
  app.patch(
    "/api/tire-brand-patterns/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      const input = updateTireBrandPatternSchema.parse(request.body);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      return patternService.updateTireBrandPattern(actor, auditActor, id, input);
    }),
  );

  /**
   * DELETE /api/tire-brand-patterns/:id
   * Delete a tire brand pattern
   */
  app.delete(
    "/api/tire-brand-patterns/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const id = Number((request.params as { id: string }).id);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      await patternService.deleteTireBrandPattern(actor, auditActor, id);
      return null;
    }),
  );
}
