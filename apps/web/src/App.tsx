import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Permission } from "@c26/contracts";
import { SessionProvider, useSession } from "./lib/session.tsx";
import { ToastProvider } from "./components/ui/feedback.tsx";
import { AppShell } from "./components/layout/app-shell.tsx";
import { Button, Spinner } from "./components/ui/primitives.tsx";
import { ErrorBanner } from "./components/ui/feedback.tsx";
import { LoginPage } from "./features/auth/login-page.tsx";
import { RegisterPage } from "./features/auth/register-page.tsx";
import { ChangePasswordPage } from "./features/auth/change-password-page.tsx";
import { MfaEnrollPage } from "./features/auth/mfa-enroll-page.tsx";
import { StepUpDialog } from "./features/auth/step-up-dialog.tsx";
import { LandingPage } from "./features/landing/landing-page.tsx";
import { WelcomePage } from "./features/welcome/welcome-page.tsx";
import { InspectionListPage } from "./features/inspections/inspection-list-page.tsx";
import { NewInspectionPage } from "./features/inspections/new-inspection-page.tsx";
import { InspectionDetailPage } from "./features/inspections/inspection-detail-page.tsx";
import { UploadQueuePage } from "./features/inspections/upload-queue-page.tsx";
import { QcQueuePage } from "./features/qc/qc-queue-page.tsx";
import { QcReviewPage } from "./features/qc/qc-review-page.tsx";
import { TireSpecPage } from "./features/tire-specs/tire-spec-page.tsx";
import { UsersPage } from "./features/users/users-page.tsx";
import { MasterDataPage } from "./features/master-data/master-data-page.tsx";
import { VehicleBrandsPage } from "./features/master-data/vehicle-brands-page.tsx";
import { TireBrandPatternsPage } from "./features/master-data/tire-brand-patterns-page.tsx";
import { TireSizesPage } from "./features/master-data/tire-sizes-page.tsx";
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

// Reporting is the heaviest route and the one fewest people open, so it is
// split out of the initial bundle to protect the 180 KB budget (PLAN/06 §7).
const ReportsPage = lazy(() =>
  import("./features/reports/reports-page.tsx").then((module) => ({ default: module.ReportsPage })),
);

import { ThemeProvider } from "./lib/theme.tsx";

export function App(): ReactNode {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ToastProvider>
          {/* Mounted once: any request answered with STEP_UP_REQUIRED opens this
              and is replayed after a successful verification (PLAN/13 §4). */}
          <StepUpDialog />
          <AppRoutes />
        </ToastProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function AppRoutes(): ReactNode {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <RequireSession>
            <AppShell>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="welcome" element={<WelcomePage />} />
                  <Route index element={<Navigate to="/welcome" replace />} />

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
                    path="master-data/vehicle-brands"
                    element={
                      <RequirePermission permission="masterdata.manage">
                        <VehicleBrandsPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="master-data/tire-brand-patterns"
                    element={
                      <RequirePermission permission="masterdata.manage">
                        <TireBrandPatternsPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="master-data/tire-sizes"
                    element={
                      <RequirePermission permission="masterdata.manage">
                        <TireSizesPage />
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
  const { user, loading, unreachable, error, retry } = useSession();
  const location = useLocation();

  if (loading) return <PageLoading />;

  /**
   * The API could not be reached, so we do not know whether there is a session.
   *
   * Showing the login screen here would be a lie, and a destructive one: it
   * reads as "you have been signed out" when nothing of the sort happened. That
   * is exactly what used to happen whenever the dev server restarted mid-session
   * — three times in a row, with no explanation.
   */
  if (unreachable) return <SessionUnavailable error={error} onRetry={() => void retry()} />;

  if (user === null) {
    // The intended destination is carried through, so a shared link to one
    // Serial Number still lands there after signing in.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  /**
   * Two things must be settled before anything else is reachable.
   *
   * PLAN/04 §4.1: the system-generated initial password is single-use.
   * PLAN/13 §3.1: a role that requires MFA "tidak dapat menyelesaikan login
   * tanpa mendaftarkannya" — enrolment comes before any access, not alongside it.
   *
   * Letting an admin browse first and only fail on their first privileged action
   * produced exactly the confusion it was meant to prevent: a 403
   * STEP_UP_REQUIRED on "Tambah Pengguna", with no way to satisfy it, because
   * there was no second factor to step up with.
   */
  const onboarding = ["/profile/password", "/profile/mfa"];
  if (!onboarding.includes(location.pathname)) {
    if (user.mustChangePassword) return <Navigate to="/profile/password" replace />;
    if (user.mfaEnrollmentRequired) return <Navigate to="/profile/mfa" replace />;
  }

  // Redirect from public routes to welcome if authenticated
  if (location.pathname === "/login" || location.pathname === "/register" || location.pathname === "/") {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

/**
 * Shown when the session cannot be determined.
 *
 * Deliberately not a redirect. The user keeps their place, sees what actually
 * happened, and gets the requestId to quote — the support flow PLAN/10 §3.3
 * builds on. A silent bounce to /login gives them none of that.
 */
function SessionUnavailable({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}): ReactNode {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <ErrorBanner error={error} />
      <p className="mt-3 text-sm text-muted">
        Sesi Anda kemungkinan besar masih aktif — sistem hanya sedang tidak dapat dihubungi.
        Coba lagi sebentar.
      </p>
      <Button className="mt-4 w-full" onClick={onRetry}>
        Coba Lagi
      </Button>
    </div>
  );
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
  if (!can(permission)) return <PermissionDenied />;
  return <>{children}</>;
}

/**
 * Shown instead of bouncing the user somewhere else.
 *
 * The redirect this replaces sent everyone to /inspections, which was wrong in
 * two ways. It gave no reason, so a mistyped or stale link looked like a broken
 * application. And /inspections is itself unreadable for the manager and
 * operator roles, so the destination was frequently one more dead end.
 *
 * Same principle as SessionUnavailable above: say what happened, and leave the
 * user somewhere they can act from.
 */
function PermissionDenied(): ReactNode {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-lg font-semibold text-body">Halaman ini bukan untuk peran Anda</p>
      <p className="mt-1 text-sm text-muted">
        Akun Anda tidak memiliki akses ke halaman tersebut. Bila menurut Anda ini keliru,
        hubungi admin.
      </p>
      <Link
        to="/welcome"
        className="mt-4 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}

function PageLoading(): ReactNode {
  return (
    <div className="flex items-center justify-center py-20 text-muted">
      <Spinner className="h-6 w-6" />
      <span className="ml-2 text-sm">Memuat…</span>
    </div>
  );
}

function NotFound(): ReactNode {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold text-body">Halaman tidak ditemukan</p>
      <p className="mt-1 text-sm text-muted">Periksa kembali tautan yang Anda buka.</p>
    </div>
  );
}
