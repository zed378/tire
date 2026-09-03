import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SessionProvider, useSession } from "./lib/session.tsx";
import { ToastProvider, ErrorBanner } from "./components/ui/feedback.tsx";
import { Button } from "./components/ui/primitives.tsx";
import { PageLoading } from "./components/ui/page-loading.tsx";
import { LoginPage } from "./features/auth/login-page.tsx";
import { RegisterPage } from "./features/auth/register-page.tsx";
import { StyleguidePage } from "./features/styleguide/styleguide-page.tsx";
import { StepUpDialog } from "./features/auth/step-up-dialog.tsx";
import { LandingPage } from "./features/landing/landing-page.tsx";
import { ThemeProvider } from "./lib/theme.tsx";

/**
 * Routing (PLAN/01 §4.1).
 *
 * Closes B-07: the legacy application lived at a single URL inside an iframe
 * sandbox, so nothing could be bookmarked, the browser's Back button did not
 * work, and a link to one Serial Number could not be shared. Every screen here
 * has a real URL.
 *
 * What is imported here is what a signed-out visitor downloads: the landing
 * page, the two auth screens, and the session logic that decides between them.
 * Everything behind a session is one lazy chunk — see `routes/protected-routes`
 * for the measurement that made it one.
 */
const ProtectedRoutes = lazy(() =>
  import("./routes/protected-routes.tsx").then((module) => ({
    default: module.ProtectedRoutes,
  })),
);

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
      {/* TEMPORARY — removed in the final phase of the redesign. Public by
          design so it can be reviewed without signing in; carries no data. */}
      <Route path="/__styleguide" element={<StyleguidePage />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <RequireSession>
            <Suspense fallback={<PageLoading />}>
              <ProtectedRoutes />
            </Suspense>
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
