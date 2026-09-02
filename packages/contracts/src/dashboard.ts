/**
 * Dashboard metrics (role-specific).
 *
 * Each role sees different data based on their permissions and responsibilities.
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
