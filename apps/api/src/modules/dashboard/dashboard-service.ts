import type {
  AdminMetrics,
  CurrentUser,
  DashboardMetrics,
  InspectionStatus,
  ManagerMetrics,
  OperatorMetrics,
  SupplierMetrics,
  UserRole,
  VehicleCategory,
} from "@c26/contracts";
import { INSPECTION_STATUSES, USER_ROLES, VEHICLE_CATEGORIES } from "@c26/contracts";
import { getPrisma } from "../../kernel/db.ts";

/**
 * Numbers for the role-specific home screen.
 *
 * Read-only throughout, and scoped by role rather than by request parameters: a
 * supplier is counted over their own inspections, and nobody can ask for
 * someone else's figures because there is nothing to ask with.
 *
 * WHAT THIS IS NOT: a second reporting implementation. The regional breakdown a
 * manager sees comes from `mv_region_progress`, the same materialised view the
 * Pelaporan screen reads — PLAN/00 §3.2 maps the PM/SPV dashboard onto the
 * reporting module, and two aggregations of the same figures would eventually
 * disagree with no way to say which one was wrong.
 *
 * COUNTING IS DONE BY THE DATABASE, deliberately. An earlier version read rows
 * with `take: 1000` and tallied them in JavaScript, and returned hardcoded zeros
 * for the regional and queue figures. That is not a performance question, it is
 * a correctness one: PLAN/00 §1 projects more than a thousand inspections a
 * month, so the cap would have understated every total from the first month
 * onwards, silently. A dashboard that is quietly wrong is worse than one that
 * is missing, because someone will make a decision on it.
 *
 * The shape of everything returned is fixed by `packages/contracts/src/dashboard.ts`.
 */

/** Every status present and zeroed, so a tile never appears or disappears. */
function zeroedStatusCounts(): Record<InspectionStatus, number> {
  return Object.fromEntries(INSPECTION_STATUSES.map((status) => [status, 0])) as Record<
    InspectionStatus,
    number
  >;
}

function zeroedCategoryCounts(): Record<VehicleCategory, number> {
  return Object.fromEntries(VEHICLE_CATEGORIES.map((category) => [category, 0])) as Record<
    VehicleCategory,
    number
  >;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getMetricsForRole(actor: {
  id: bigint;
  role: CurrentUser["role"];
}): Promise<DashboardMetrics> {
  // A switch over the union rather than a chain of ifs ending in a fallback: if
  // a role is ever added, this stops compiling instead of quietly serving
  // somebody else's dashboard to them.
  switch (actor.role) {
    case "supplier":
      return getSupplierMetrics(actor.id);
    case "admin":
      return getAdminMetrics();
    case "manager":
      return getManagerMetrics();
    case "operator":
      return getOperatorMetrics();
  }
}

async function getSupplierMetrics(userId: bigint): Promise<SupplierMetrics> {
  const prisma = getPrisma();

  const [statusCounts, lastSubmission] = await Promise.all([
    prisma.inspection.groupBy({
      by: ["status"],
      where: { submittedById: userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.inspection.findFirst({
      where: { submittedById: userId, deletedAt: null, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      select: { serialNumber: true, submittedAt: true },
    }),
  ]);

  const submissionCounts = zeroedStatusCounts();
  for (const row of statusCounts) {
    submissionCounts[row.status] = row._count._all;
  }

  return {
    type: "supplier",
    submissionCounts,
    lastSubmission:
      lastSubmission?.submittedAt == null
        ? null
        : {
            serialNumber: lastSubmission.serialNumber,
            submittedAt: lastSubmission.submittedAt.toISOString(),
          },
  };
}

async function getAdminMetrics(): Promise<AdminMetrics> {
  const prisma = getPrisma();
  const monthStart = startOfCurrentMonth();

  const [totalUsers, activeUsers, usersByRole, totalInspections, byStatus, thisMonth, auditEvents] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.inspection.count({ where: { deletedAt: null } }),
      prisma.inspection.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      // Category lives on the vehicle, not the inspection — PLAN/11 split the
      // two — and Prisma cannot group by a field across a relation. So this one
      // reads rows and tallies them. It is bounded to a single month rather
      // than to an arbitrary row cap, which is what makes that safe.
      prisma.inspection.findMany({
        where: { deletedAt: null, submittedAt: { gte: monthStart } },
        select: { vehicle: { select: { category: true } } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          createdAt: true,
          action: true,
          entity: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);

  const byRole = Object.fromEntries(USER_ROLES.map((role) => [role, 0])) as Record<UserRole, number>;
  for (const row of usersByRole) {
    byRole[row.role] = row._count._all;
  }

  const statusCounts = zeroedStatusCounts();
  for (const row of byStatus) {
    statusCounts[row.status] = row._count._all;
  }

  const thisMonthByCategory = zeroedCategoryCounts();
  for (const inspection of thisMonth) {
    thisMonthByCategory[inspection.vehicle.category] += 1;
  }

  return {
    type: "admin",
    users: { total: totalUsers, active: activeUsers, byRole },
    inspections: {
      total: totalInspections,
      byStatus: statusCounts,
      thisMonth: thisMonth.length,
      thisMonthByCategory,
    },
    recentAuditEvents: auditEvents.map((event) => ({
      occurredAt: event.createdAt.toISOString(),
      action: event.action,
      // `actor_id` is nullable and the row outlives the account, by design — an
      // audit entry must not disappear with the user who caused it.
      actor: event.actor?.displayName ?? "Tidak diketahui",
      entity: event.entity,
    })),
  };
}

interface RegionRow {
  province_name: string;
  city_name: string;
  category: string;
  unit_count: bigint;
}

interface TrendRow {
  month: Date;
  unit_count: bigint;
}

async function getManagerMetrics(): Promise<ManagerMetrics> {
  const prisma = getPrisma();
  const monthStart = startOfCurrentMonth();

  const [regionRows, trendRows] = await Promise.all([
    prisma.$queryRaw<RegionRow[]>`
      SELECT p.name AS province_name,
             c.name AS city_name,
             mv.category::text AS category,
             sum(mv.unit_count) AS unit_count
        FROM mv_region_progress mv
        JOIN cities c    ON c.id = mv.city_id
        JOIN provinces p ON p.id = mv.province_id
       WHERE mv.day >= ${monthStart}
       GROUP BY 1, 2, 3
       ORDER BY 1, 2
    `,
    prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc('month', mv.day) AS month,
             sum(mv.unit_count) AS unit_count
        FROM mv_region_progress mv
       WHERE mv.day >= date_trunc('month', now()) - interval '5 months'
       GROUP BY 1
       ORDER BY 1
    `,
  ]);

  const byRegion = new Map<string, ManagerMetrics["byRegion"][number]>();
  const byCategory = zeroedCategoryCounts();

  for (const row of regionRows) {
    const region = `${row.city_name}, ${row.province_name}`;
    const entry = byRegion.get(region) ?? { region, tb: 0, lt: 0, total: 0 };
    const count = Number(row.unit_count);

    // TB versus LT is the axis the whole management dashboard is built on
    // (K-04), so the two are kept apart all the way to the screen.
    if (row.category === "TB") {
      entry.tb += count;
      byCategory.TB += count;
    } else {
      entry.lt += count;
      byCategory.LT += count;
    }
    entry.total += count;
    byRegion.set(region, entry);
  }

  // Months with nothing in them are simply absent from the view, and a trend
  // line with holes in it reads as missing data rather than as a quiet month.
  // Every month in the window is emitted, zeros included.
  const trendByMonth = new Map<string, number>();
  for (const row of trendRows) {
    trendByMonth.set(monthKey(row.month), Number(row.unit_count));
  }

  const now = new Date();
  const trend: ManagerMetrics["trend"] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    trend.push({
      month: month.toLocaleString("id-ID", { month: "short", year: "2-digit" }),
      count: trendByMonth.get(monthKey(month)) ?? 0,
    });
  }

  return {
    type: "manager",
    thisMonth: byCategory.TB + byCategory.LT,
    byCategory,
    // Busiest city first: the point of the list is to see where the work is.
    byRegion: [...byRegion.values()].sort((a, b) => b.total - a.total),
    trend,
  };
}

function monthKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface JobCountRow {
  state: string;
  count: bigint;
}

async function getOperatorMetrics(): Promise<OperatorMetrics> {
  const prisma = getPrisma();

  // pg-boss owns its own schema, so its queue is read rather than modelled. The
  // previous version returned hardcoded zeros with a note saying it would be
  // filled in later: an operations panel that always reports a healthy queue is
  // worse than one that reports nothing at all.
  const [jobRows, outboxPending, orphanedUploads] = await Promise.all([
    prisma.$queryRaw<JobCountRow[]>`
      SELECT state::text AS state, count(*) AS count
        FROM pgboss.job
       WHERE state IN ('created', 'retry', 'active', 'failed')
       GROUP BY 1
    `,
    prisma.outbox.count({ where: { processedAt: null } }),
    // An upload that was presigned, never confirmed, and is now past its expiry
    // is an orphan: bytes on disk no row will ever claim (PLAN/10 §3.1).
    prisma.pendingUpload.count({ where: { expiresAt: { lt: new Date() } } }),
  ]);

  const byState = new Map(jobRows.map((row) => [row.state, Number(row.count)]));

  return {
    type: "operator",
    jobs: {
      // `created` and `retry` are both waiting to run. That distinction matters
      // to pg-boss, not to the person reading the panel.
      pending: (byState.get("created") ?? 0) + (byState.get("retry") ?? 0),
      active: byState.get("active") ?? 0,
      failed: byState.get("failed") ?? 0,
    },
    outboxPending,
    orphanedUploads,
  };
}
