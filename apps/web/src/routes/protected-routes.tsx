import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { Permission } from "@c26/contracts";
import { useSession } from "../lib/session.tsx";
import { AppShell } from "../components/layout/app-shell.tsx";
import { PageLoading } from "../components/ui/page-loading.tsx";
import { WelcomePage } from "../features/welcome/welcome-page.tsx";
import { InspectionListPage } from "../features/inspections/inspection-list-page.tsx";
import { NewInspectionPage } from "../features/inspections/new-inspection-page.tsx";
import { InspectionDetailPage } from "../features/inspections/inspection-detail-page.tsx";
import { UploadQueuePage } from "../features/inspections/upload-queue-page.tsx";
import { QcQueuePage } from "../features/qc/qc-queue-page.tsx";
import { QcReviewPage } from "../features/qc/qc-review-page.tsx";
import { TireSpecPage } from "../features/tire-specs/tire-spec-page.tsx";
import { NotificationsPage } from "../features/notifications/notifications-page.tsx";
import { ProfilePage } from "../features/auth/profile-page.tsx";
import { ChangePasswordPage } from "../features/auth/change-password-page.tsx";
import { MfaEnrollPage } from "../features/auth/mfa-enroll-page.tsx";

/**
 * Everything behind a session, in one chunk.
 *
 * WHY IT IS SPLIT: a signed-out visitor was downloading the entire signed-in
 * application — the shell, every inspection screen, QC, tire specs,
 * notifications — before the landing page could paint a word. Splitting it out
 * takes the initial JavaScript from 171.1 KB to 146.6 KB gzipped against the
 * 180 KB budget in `PLAN/06` §7, which is most of the headroom that budget had
 * left.
 *
 * WHAT IT DID NOT DO: it was tried as an LCP fix and it is not one. Measured
 * back to back on the reference profile — `scripts/measure-lcp.ts`, Lighthouse
 * mobile throttling — the landing page went 4.27s to 4.14s and login went 3.03s
 * to 3.21s. That is noise, not an improvement. The cost is the serial chain an
 * SPA has by construction (HTML, then JavaScript, then render, then the browser
 * discovers the photograph and only then fetches it), and 24 KB off the middle
 * link does not shorten it. The measured numbers and what is left to try are in
 * `docs/redesign-report.md`.
 *
 * `PLAN/14` anticipated a miss here and named IBM Plex Mono as the first thing
 * to drop. The measurement says otherwise — the element that paints last is the
 * photograph, on every route — so the typeface stays.
 *
 * The administration screens inside remain separately lazy. A supplier is the
 * majority user and never opens any of them.
 */

// Reporting is the heaviest route and the one fewest people open, so it is
// split out of the initial bundle to protect the 180 KB budget (PLAN/06 §7).
/*
 * Administration, master data and operations, split out of the initial
 * bundle.
 *
 * A supplier is the majority user and never opens any of these, yet was
 * downloading all of them on every visit. The budget is 180 KB gzipped and
 * enforced (PLAN/06 §7, gate G-12); this is what keeps the field device — a
 * mid-range phone two or three years old, per PLAN/06 §7 — from paying for
 * screens it has no permission to see.
 */
const UsersPage = lazy(() =>
  import("../features/users/users-page.tsx").then((module) => ({ default: module.UsersPage })),
);
const MasterDataPage = lazy(() =>
  import("../features/master-data/master-data-page.tsx").then((module) => ({ default: module.MasterDataPage })),
);
const VehicleBrandsPage = lazy(() =>
  import("../features/master-data/vehicle-brands-page.tsx").then((module) => ({ default: module.VehicleBrandsPage })),
);
const TireBrandPatternsPage = lazy(() =>
  import("../features/master-data/tire-brand-patterns-page.tsx").then((module) => ({ default: module.TireBrandPatternsPage })),
);
const TireSizesPage = lazy(() =>
  import("../features/master-data/tire-sizes-page.tsx").then((module) => ({ default: module.TireSizesPage })),
);
const AuditPage = lazy(() =>
  import("../features/audit/audit-page.tsx").then((module) => ({ default: module.AuditPage })),
);
const OpsPage = lazy(() =>
  import("../features/ops/ops-page.tsx").then((module) => ({ default: module.OpsPage })),
);

const ReportsPage = lazy(() =>
  import("../features/reports/reports-page.tsx").then((module) => ({ default: module.ReportsPage })),
);


export function ProtectedRoutes(): ReactNode {
  return (
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
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/password" element={<ChangePasswordPage />} />
        <Route path="profile/mfa" element={<MfaEnrollPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </AppShell>
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

function NotFound(): ReactNode {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold text-body">Halaman tidak ditemukan</p>
      <p className="mt-1 text-sm text-muted">Periksa kembali tautan yang Anda buka.</p>
    </div>
  );
}
