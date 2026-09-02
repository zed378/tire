import type { CurrentUser } from "@c26/contracts";
import { getPrisma } from "../../kernel/db.ts";

/**
 * Dashboard metrics (role-specific).
 * Simplified version focused on core data without complex aggregations.
 */

export interface SupplierMetrics {
  type: "supplier";
  submissionCounts: Record<string, number>;
  lastSubmission: { sn: string; submittedAt: string } | null;
}

export interface AdminMetrics {
  type: "admin";
  systemHealth: {
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<string, number>;
  };
  submissionStats: {
    totalSubmissions: number;
    byStatus: Record<string, number>;
    thisMonth: number;
    thisMonthByCategory: { TB: number; LT: number };
  };
  recentAuditEvents: Array<{
    timestamp: string;
    action: string;
    actor: string;
    entity: string;
  }>;
}

export interface ManagerMetrics {
  type: "manager";
  reportingMetrics: {
    byRegion: Array<{ region: string; TB: number; LT: number }>;
    byCategory: { TB: number; LT: number };
    thisMonth: number;
    trend: Array<{ month: string; count: number }>;
  };
}

export interface OperatorMetrics {
  type: "operator";
  jobQueueStatus: {
    pending: number;
    processing: number;
    failed: number;
    lastError: string | null;
  };
  recentLogs: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

export type DashboardMetrics = SupplierMetrics | AdminMetrics | ManagerMetrics | OperatorMetrics;

export async function getMetricsForRole(actor: { id: bigint; role: CurrentUser["role"] }): Promise<DashboardMetrics> {
  if (actor.role === "supplier") {
    return getSupplierMetrics(actor.id);
  }

  if (actor.role === "admin") {
    return getAdminMetrics();
  }

  if (actor.role === "manager") {
    return getManagerMetrics();
  }

  if (actor.role === "operator") {
    return getOperatorMetrics();
  }

  // Default fallback
  return getSupplierMetrics(actor.id);
}

async function getSupplierMetrics(userId: bigint): Promise<SupplierMetrics> {
  const prisma = getPrisma();

  // Get all statuses for this supplier
  const submissions = await prisma.inspection.findMany({
    where: {
      submittedBy: userId,
      deletedAt: null,
    },
    select: { status: true, serialNumber: true, submittedAt: true },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  const submissionCounts: Record<string, number> = {
    draft: 0,
    pending_qc: 0,
    needs_revision: 0,
    passed_qc: 0,
    dropped_qc: 0,
  };

  for (const sub of submissions) {
    submissionCounts[sub.status] = (submissionCounts[sub.status] ?? 0) + 1;
  }

  const lastSubmission = submissions.find((s) => s.submittedAt !== null);

  return {
    type: "supplier",
    submissionCounts,
    lastSubmission: lastSubmission
      ? { sn: lastSubmission.serialNumber, submittedAt: lastSubmission.submittedAt!.toISOString() }
      : null,
  };
}

async function getAdminMetrics(): Promise<AdminMetrics> {
  const prisma = getPrisma();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // System health: user counts
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
  const activeUsers = await prisma.user.count({ where: { deletedAt: null, isActive: true } });

  // Submission stats
  const totalSubmissions = await prisma.inspection.count({ where: { deletedAt: null } });
  const thisMonthSubmissions = await prisma.inspection.count({
    where: {
      deletedAt: null,
      submittedAt: { gte: monthStart },
    },
  });

  // Get submissions for status breakdown
  const allSubmissions = await prisma.inspection.findMany({
    where: { deletedAt: null },
    select: { status: true },
    take: 1000,
  });

  const byStatus: Record<string, number> = {
    draft: 0,
    pending_qc: 0,
    needs_revision: 0,
    passed_qc: 0,
    dropped_qc: 0,
  };

  for (const sub of allSubmissions) {
    byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
  }

  // Get users by role
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { role: true },
  });

  const usersByRole: Record<string, number> = {};
  for (const user of users) {
    usersByRole[user.role] = (usersByRole[user.role] ?? 0) + 1;
  }

  // Recent audit events (last 10)
  const recentEvents = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      createdAt: true,
      action: true,
      entity: true,
    },
  });

  return {
    type: "admin",
    systemHealth: {
      totalUsers,
      activeUsers,
      usersByRole,
    },
    submissionStats: {
      totalSubmissions,
      byStatus,
      thisMonth: thisMonthSubmissions,
      thisMonthByCategory: { TB: 0, LT: 0 },
    },
    recentAuditEvents: recentEvents.map((e) => ({
      timestamp: e.createdAt.toISOString(),
      action: e.action,
      actor: "System",
      entity: e.entity,
    })),
  };
}

async function getManagerMetrics(): Promise<ManagerMetrics> {
  const prisma = getPrisma();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get this month's passed inspections
  const thisMonthSubmissions = await prisma.inspection.count({
    where: {
      deletedAt: null,
      status: "passed_qc",
      submittedAt: { gte: monthStart },
    },
  });

  // Trend: last 6 months (simplified)
  const trend: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = monthDate.toLocaleString("id-ID", { month: "short", year: "2-digit" });
    trend.push({ month: monthLabel, count: 0 });
  }

  return {
    type: "manager",
    reportingMetrics: {
      byRegion: [],
      byCategory: { TB: 0, LT: 0 },
      thisMonth: thisMonthSubmissions,
      trend,
    },
  };
}

async function getOperatorMetrics(): Promise<OperatorMetrics> {
  // Placeholder data for operator
  return {
    type: "operator",
    jobQueueStatus: {
      pending: 0,
      processing: 0,
      failed: 0,
      lastError: null,
    },
    recentLogs: [],
  };
}
