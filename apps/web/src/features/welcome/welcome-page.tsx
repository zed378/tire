import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { USER_ROLE_LABELS, type DashboardMetrics } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { ErrorBanner } from "../../components/ui/feedback.tsx";
import { SkeletonRows } from "../../components/ui/primitives.tsx";
import { useSession } from "../../lib/session.tsx";
import { AdminWelcome } from "./admin-welcome.tsx";
import { ManagerWelcome } from "./manager-welcome.tsx";
import { OperatorWelcome } from "./operator-welcome.tsx";
import { SupplierWelcome } from "./supplier-welcome.tsx";

export function WelcomePage(): ReactNode {
  const { user } = useSession();

  const metrics = useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: () => api.get<DashboardMetrics>("/api/dashboard/metrics"),
  });

  // Current date formatted in Indonesian locale
  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Modern Greeting Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {user === null ? "Dashboard" : USER_ROLE_LABELS[user.role]}
              </span>
              <span className="text-xs text-muted">• {todayFormatted}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-body">
              Selamat datang kembali, {user?.displayName}!
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted">
              Monitoring data inspeksi ban, verifikasi QC, dan status armada kendaraan komersial.
            </p>
          </div>
        </div>
      </div>

      {metrics.error !== null ? <ErrorBanner error={metrics.error} /> : null}

      {metrics.isPending ? (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">Memuat ringkasan dashboard…</span>
          <SkeletonRows rows={4} />
        </div>
      ) : null}

      {metrics.data !== undefined ? <RoleSummary metrics={metrics.data} /> : null}
    </div>
  );
}

function RoleSummary({ metrics }: { metrics: DashboardMetrics }): ReactNode {
  switch (metrics.type) {
    case "supplier":
      return <SupplierWelcome metrics={metrics} />;
    case "admin":
      return <AdminWelcome metrics={metrics} />;
    case "manager":
      return <ManagerWelcome metrics={metrics} />;
    case "operator":
      return <OperatorWelcome metrics={metrics} />;
  }
}
