import type { FastifyInstance } from "fastify";
import {
  createBrandSchema,
  createCitySchema,
  createProvinceSchema,
  updateMasterSchema,
} from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { AppError, wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";
import {
  createBrand,
  createCity,
  createProvince,
  getBundle,
  listPendingBrandReviews,
  updateMaster,
  type MasterTable,
} from "./master-data-service.ts";

const MASTER_TABLES: readonly MasterTable[] = [
  "provinces",
  "cities",
  "vehicle-brands",
  "tire-brands",
];

function parseTable(value: string): MasterTable {
  if (!(MASTER_TABLES as readonly string[]).includes(value)) throw new AppError("NOT_FOUND");
  return value as MasterTable;
}

export function registerMasterDataRoutes(app: FastifyInstance): void {
  // Readable by anyone signed in: every form needs it, and it holds no
  // per-supplier data.
  app.get(
    "/api/masterdata",
    wrapRoute(async (request) => {
      requireActor(request);
      return getBundle();
    }),
  );

  app.post<{ Params: { table: string } }>(
    "/api/masterdata/:table",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      const table = parseTable(request.params.table);
      const auditActor = {
        id: actor.id,
        role: actor.role,
        requestId: request.requestId,
        ipAddress: request.clientIp,
      };

      switch (table) {
        case "provinces":
          return createProvince(auditActor, createProvinceSchema.parse(request.body));
        case "cities":
          return createCity(auditActor, createCitySchema.parse(request.body));
        case "vehicle-brands":
        case "tire-brands":
          return createBrand(auditActor, table, createBrandSchema.parse(request.body));
      }
    }, 201),
  );

  app.patch<{ Params: { table: string; id: string } }>(
    "/api/masterdata/:table/:id",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");

      await updateMaster(
        { id: actor.id, role: actor.role, requestId: request.requestId, ipAddress: request.clientIp },
        parseTable(request.params.table),
        BigInt(request.params.id),
        updateMasterSchema.parse(request.body),
      );
      return { updated: true };
    }),
  );

  app.get(
    "/api/masterdata/brand-reviews",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "masterdata.manage");
      return listPendingBrandReviews();
    }),
  );
}
