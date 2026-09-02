import { z } from "zod";
import { INSPECTION_STATUSES, USER_ROLES, VEHICLE_CATEGORIES } from "./constants.ts";

/**
 * The role-specific home screen (`GET /api/dashboard/metrics`).
 *
 * A discriminated union on `type`, so the client narrows on the role the server
 * actually resolved rather than on the role it believes the user has. The two
 * should agree; if they ever do not, the server is right.
 *
 * These schemas exist because the dashboard shipped without them: the service
 * declared its own TypeScript interfaces, the web app imported
 * `SupplierMetrics` and friends from `@c26/contracts` where they did not
 * exist, and neither side compiled. A validation shape is written once and
 * imported by both sides — that is the rule this closes.
 */

/**
 * A count for every member of a fixed set, all keys required.
 *
 * `z.record(z.enum(...), ...)` would be the obvious spelling, but Zod infers it
 * as `Partial<Record<...>>`, which would leave every tile on the dashboard
 * asking whether its own number exists. The server always emits the full set —
 * zeros included, so tiles never appear and disappear — and this keeps the type
 * saying so without restating the key list anywhere.
 */
function countsOf<Key extends string>(keys: readonly Key[]): z.ZodObject<Record<Key, z.ZodNumber>> {
  const shape = Object.fromEntries(keys.map((key) => [key, z.number().int()])) as Record<
    Key,
    z.ZodNumber
  >;
  return z.object(shape);
}

export const supplierMetricsSchema = z.object({
  type: z.literal("supplier"),
  /** Every status, including the ones at zero, so the tiles never shift about. */
  submissionCounts: countsOf(INSPECTION_STATUSES),
  lastSubmission: z
    .object({
      serialNumber: z.string(),
      submittedAt: z.string().datetime(),
    })
    .nullable(),
});

export const adminMetricsSchema = z.object({
  type: z.literal("admin"),
  users: z.object({
    total: z.number().int(),
    active: z.number().int(),
    byRole: countsOf(USER_ROLES),
  }),
  inspections: z.object({
    total: z.number().int(),
    byStatus: countsOf(INSPECTION_STATUSES),
    thisMonth: z.number().int(),
    thisMonthByCategory: countsOf(VEHICLE_CATEGORIES),
  }),
  recentAuditEvents: z.array(
    z.object({
      occurredAt: z.string().datetime(),
      action: z.string(),
      actor: z.string(),
      entity: z.string(),
    }),
  ),
});

export const managerMetricsSchema = z.object({
  type: z.literal("manager"),
  thisMonth: z.number().int(),
  byCategory: countsOf(VEHICLE_CATEGORIES),
  byRegion: z.array(
    z.object({
      region: z.string(),
      tb: z.number().int(),
      lt: z.number().int(),
      total: z.number().int(),
    }),
  ),
  /** Six months, oldest first. `month` is already formatted for display. */
  trend: z.array(z.object({ month: z.string(), count: z.number().int() })),
});

export const operatorMetricsSchema = z.object({
  type: z.literal("operator"),
  jobs: z.object({
    pending: z.number().int(),
    active: z.number().int(),
    failed: z.number().int(),
  }),
  outboxPending: z.number().int(),
  orphanedUploads: z.number().int(),
});

export const dashboardMetricsSchema = z.discriminatedUnion("type", [
  supplierMetricsSchema,
  adminMetricsSchema,
  managerMetricsSchema,
  operatorMetricsSchema,
]);

export type SupplierMetrics = z.infer<typeof supplierMetricsSchema>;
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;
export type ManagerMetrics = z.infer<typeof managerMetricsSchema>;
export type OperatorMetrics = z.infer<typeof operatorMetricsSchema>;
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
