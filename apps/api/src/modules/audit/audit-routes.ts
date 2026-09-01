import type { FastifyInstance } from "fastify";
import { auditQuerySchema, type AuditEntry, type AuditQuery, type Paginated } from "@c26/contracts";
import { requirePermission } from "../../kernel/authorization.ts";
import { getPrisma } from "../../kernel/db.ts";
import { wrapRoute } from "../../kernel/envelope/index.ts";
import { requireActor } from "../auth/index.ts";

/**
 * Reading the audit trail (PLAN/04 §6.3).
 *
 * There is no write endpoint here, and there is no update or delete anywhere in
 * the codebase: the table is append-only and the privilege is revoked at the
 * database level (PLAN/13 §9). An audit trail the application can edit is not
 * evidence.
 *
 * Opening this from an inspection's detail page also finishes off D-02 sideways:
 * the QC card titled "Riwayat" finally has a history to show.
 */
async function queryAudit(query: AuditQuery): Promise<Paginated<AuditEntry>> {
  const prisma = getPrisma();

  const where = {
    ...(query.entity !== undefined ? { entity: query.entity } : {}),
    ...(query.entityId !== undefined ? { entityId: BigInt(query.entityId) } : {}),
    ...(query.actorId !== undefined ? { actorId: BigInt(query.actorId) } : {}),
    ...(query.action !== undefined ? { action: { contains: query.action } } : {}),
    ...(query.from !== undefined || query.to !== undefined
      ? {
          createdAt: {
            ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
            ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { displayName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      action: row.action,
      entity: row.entity,
      entityId: Number(row.entityId),
      actorId: row.actorId === null ? null : Number(row.actorId),
      actorName: row.actor?.displayName ?? null,
      actorRole: row.actorRole,
      before: row.before as Record<string, unknown> | null,
      after: row.after as Record<string, unknown> | null,
      requestId: row.requestId,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

export function registerAuditRoutes(app: FastifyInstance): void {
  app.get(
    "/api/audit",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "audit.read");
      return queryAudit(auditQuerySchema.parse(request.query));
    }),
  );

  /** "Riwayat Perubahan" on an inspection detail page. */
  app.get<{ Params: { sn: string } }>(
    "/api/inspections/:sn/audit",
    wrapRoute(async (request) => {
      const actor = requireActor(request);
      requirePermission(actor, "audit.read");

      const inspection = await getPrisma().inspection.findFirst({
        where: { serialNumber: request.params.sn },
        select: { id: true },
      });
      if (inspection === null) return { items: [], page: 1, perPage: 0, total: 0, totalPages: 1 };

      return queryAudit({
        ...auditQuerySchema.parse(request.query),
        entity: "inspection",
        entityId: Number(inspection.id),
      });
    }),
  );
}
