import { ReactNode, useEffect, useState } from "react";
import { useSession } from "../../lib/session.tsx";
import { Spinner } from "../../components/ui/primitives.tsx";
import { SupplierWelcome } from "./supplier-welcome.tsx";
import { AdminWelcome } from "./admin-welcome.tsx";
import { ManagerWelcome } from "./manager-welcome.tsx";
import { OperatorWelcome } from "./operator-welcome.tsx";

export function WelcomePage(): ReactNode {
  const { user } = useSession();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/dashboard/metrics");
        if (!response.ok) throw new Error("Failed to fetch metrics");
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError("Gagal memuat dashboard metrics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-sm">Memuat dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!user || !metrics) {
    return <div>Data tidak tersedia</div>;
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Selamat datang, {user.displayName}!</h1>
        <p className="mt-2 text-slate-600">Peran: {getRoleLabel(user.role)}</p>
      </div>

      {/* Role-specific content */}
      {user.role === "supplier" && <SupplierWelcome metrics={metrics} />}
      {user.role === "admin" && <AdminWelcome metrics={metrics} />}
      {user.role === "manager" && <ManagerWelcome metrics={metrics} />}
      {user.role === "operator" && <OperatorWelcome metrics={metrics} />}
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    supplier: "Data Supplier",
    admin: "Admin",
    manager: "PM/PIC/SPV",
    operator: "Operator",
  };
  return labels[role] || role;
}
