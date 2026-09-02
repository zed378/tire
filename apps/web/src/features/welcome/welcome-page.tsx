import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { USER_ROLE_LABELS, type DashboardMetrics } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { ErrorBanner } from "../../components/ui/feedback.tsx";
import { PageHeader, SkeletonRows } from "../../components/ui/primitives.tsx";
import { useSession } from "../../lib/session.tsx";
import { AdminWelcome } from "./admin-welcome.tsx";
import { ManagerWelcome } from "./manager-welcome.tsx";
import { OperatorWelcome } from "./operator-welcome.tsx";
import { SupplierWelcome } from "./supplier-welcome.tsx";

/**
 * The first screen after signing in.
 *
 * Every role gets a different one, because they have different jobs. Before
 * this existed, everyone landed on `/inspections` — a page the manager and
 * operator roles have no permission to read, so two of the four roles opened
 * the application onto a screen that bounced them straight back out.
 *
 * The metrics come from the server already narrowed by role: the client renders
 * whichever shape it is handed rather than asking for the one it expects. If
 * the two ever disagree, the server is right.
 */
export function WelcomePage(): ReactNode {
  const { user } = useSession();

  const metrics = useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: () => api.get<DashboardMetrics>("/api/dashboard/metrics"),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={user === null ? "Beranda" : `Selamat datang, ${user.displayName}`}
        description={user === null ? undefined : USER_ROLE_LABELS[user.role]}
      />

      {metrics.error !== null ? <ErrorBanner error={metrics.error} /> : null}

      {metrics.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Memuat ringkasan…</span>
          <SkeletonRows rows={4} />
        </div>
      ) : null}

      {metrics.data !== undefined ? <RoleSummary metrics={metrics.data} /> : null}
    </div>
  );
}

function RoleSummary({ metrics }: { metrics: DashboardMetrics }): ReactNode {
  // Narrowed on the discriminant, so adding a role to the union stops this
  // compiling rather than silently rendering nothing.
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
