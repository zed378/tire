import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Permission } from "@c26/contracts";
import { SessionProvider, useSession } from "./lib/session.tsx";
import { ToastProvider } from "./components/ui/feedback.tsx";
import { AppShell } from "./components/layout/app-shell.tsx";
import { Spinner } from "./components/ui/primitives.tsx";
import { LoginPage } from "./features/auth/login-page.tsx";
import { ChangePasswordPage } from "./features/auth/change-password-page.tsx";
import { MfaEnrollPage } from "./features/auth/mfa-enroll-page.tsx";
import { InspectionListPage } from "./features/inspections/inspection-list-page.tsx";
import { NewInspectionPage } from "./features/inspections/new-inspection-page.tsx";
import { InspectionDetailPage } from "./features/inspections/inspection-detail-page.tsx";
import { UploadQueuePage } from "./features/inspections/upload-queue-page.tsx";
import { QcQueuePage } from "./features/qc/qc-queue-page.tsx";
import { QcReviewPage } from "./features/qc/qc-review-page.tsx";
import { TireSpecPage } from "./features/tire-specs/tire-spec-page.tsx";
import { UsersPage } from "./features/users/users-page.tsx";
import { MasterDataPage } from "./features/master-data/master-data-page.tsx";
import { NotificationsPage } from "./features/notifications/notifications-page.tsx";
import { AuditPage } from "./features/audit/audit-page.tsx";
import { OpsPage } from "./features/ops/ops-page.tsx";

/**
 * Routing (PLAN/01 §4.1).
 *
 * Closes B-07: the legacy application lived at a single URL inside an iframe
 * sandbox, so nothing could be bookmarked, the browser's Back button did not
 * work, and a link to one Serial Number could not be shared. Every screen here
 * has a real URL.
 */

// The dashboard pulls in Recharts, which is large and only this route needs it.
const ReportsPage = lazy(() =>
  import("./features/reports/reports-page.tsx").then((module) => ({ default: module.ReportsPage })),
);

export function App(): ReactNode {
  return (
    <SessionProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </SessionProvider>
  );
}

function AppRoutes(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <RequireSession>
            <AppShell>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route index element={<Navigate to="/inspections" replace />} />

                  <Route path="inspections" element={<InspectionListPage />} />
                  <Route path="inspections/new" element={<NewInspectionPage />} />
                  <Route path="inspections/:sn" element={<InspectionDetailPage />} />
                  <Route path="inspections/:sn/tire-specs" element={<TireSpecPage />} />
                  <Route path="upload-queue" element={<UploadQueuePage />} />

                  <Route
                    path="qc"
                    element={
                      <RequirePermission permission="qc.review">
                        <QcQueuePage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="qc/:sn"
                    element={
                      <RequirePermission permission="qc.review">
                        <QcReviewPage />
                      </RequirePermission>
                    }
                  />

                  <Route
                    path="reports"
                    element={
                      <RequirePermission permission="report.view">
                        <ReportsPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <RequirePermission permission="user.manage">
                        <UsersPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="master-data"
                    element={
                      <RequirePermission permission="masterdata.manage">
                        <MasterDataPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <RequirePermission permission="audit.read">
                        <AuditPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="ops"
                    element={
                      <RequirePermission permission="ops.health.read">
                        <OpsPage />
                      </RequirePermission>
                    }
                  />

                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile/password" element={<ChangePasswordPage />} />
                  <Route path="profile/mfa" element={<MfaEnrollPage />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppShell>
          </RequireSession>
        }
      />
    </Routes>
  );
}

function RequireSession({ children }: { children: ReactNode }): ReactNode {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) return <PageLoading />;
  if (user === null) {
    // The intended destination is carried through, so a shared link to one
    // Serial Number still lands there after signing in.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * Layer 1 and a half.
 *
 * This stops a user reaching a screen they have no business on, but it is not
 * the enforcement: the server rejects the request regardless, which is what
 * makes it real (PLAN/04 §2.2).
 */
function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}): ReactNode {
  const { can } = useSession();
  if (!can(permission)) return <Navigate to="/inspections" replace />;
  return <>{children}</>;
}

function PageLoading(): ReactNode {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500">
      <Spinner className="h-6 w-6" />
      <span className="ml-2 text-sm">Memuat…</span>
    </div>
  );
}

function NotFound(): ReactNode {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold text-slate-800">Halaman tidak ditemukan</p>
      <p className="mt-1 text-sm text-slate-500">Periksa kembali tautan yang Anda buka.</p>
    </div>
  );
}
