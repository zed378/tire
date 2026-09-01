import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { USER_ROLE_LABELS, type Permission } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { useSession } from "../../lib/session.tsx";
import { setVersionMismatchHandler } from "../../lib/api-client.ts";
import { startQueueProcessor, subscribeToQueue, summarise } from "../../lib/photo/upload-queue.ts";
import { Banner } from "../ui/feedback.tsx";
import { Button } from "../ui/primitives.tsx";

/**
 * The application shell.
 *
 * Navigation is layer 1 of PLAN/04 §2.2: an entry the user has no permission for
 * is not rendered at all. K-07 keeps that from the legacy system deliberately —
 * it reads better than a row of disabled menu items — while the route guard and
 * the query scope do the actual enforcing.
 */

interface NavEntry {
  to: string;
  label: string;
  permission: Permission | null;
}

const NAV_ENTRIES: NavEntry[] = [
  { to: "/inspections", label: "Pengajuan", permission: null },
  { to: "/qc", label: "Quality Control", permission: "qc.review" },
  { to: "/reports", label: "Pelaporan", permission: "report.view" },
  { to: "/users", label: "Pengguna", permission: "user.manage" },
  { to: "/master-data", label: "Master Data", permission: "masterdata.manage" },
  { to: "/audit", label: "Jejak Audit", permission: "audit.read" },
  { to: "/ops", label: "Operasional", permission: "ops.health.read" },
];

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const { user, logout, can } = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => setVersionMismatchHandler(setNewVersion), []);

  useEffect(() => {
    const stopProcessor = startQueueProcessor();
    const unsubscribe = subscribeToQueue((items) => {
      const summary = summarise(items);
      setQueuedCount(summary.pending + summary.uploading + summary.failed);
    });

    return () => {
      stopProcessor();
      unsubscribe();
    };
  }, []);

  const entries = NAV_ENTRIES.filter(
    (entry) => entry.permission === null || can(entry.permission),
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Buka menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
              </svg>
            </button>
            <span className="font-semibold text-slate-900">Commercial 2026</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {entries.map((entry) => (
              <NavItem key={entry.to} to={entry.to} label={entry.label} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {queuedCount > 0 ? (
              <NavLink
                to="/upload-queue"
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
              >
                {queuedCount} foto menunggu
              </NavLink>
            ) : null}

            <NavLink
              to="/notifications"
              className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Notifikasi"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 2a5 5 0 00-5 5v3L3.5 13h13L15 10V7a5 5 0 00-5-5zM8 15a2 2 0 104 0H8z" />
              </svg>
              {user !== null && user.unreadNotifications > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
              ) : null}
            </NavLink>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.displayName}</p>
              <p className="text-xs text-slate-500">
                {user === null ? "" : USER_ROLE_LABELS[user.role]}
              </p>
            </div>

            <Button variant="ghost" onClick={() => void logout()}>
              Keluar
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-slate-200 px-4 py-2 md:hidden">
            {entries.map((entry) => (
              <NavItem key={entry.to} to={entry.to} label={entry.label} block />
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        {newVersion !== null ? (
          <Banner tone="info" title="Versi baru tersedia">
            <p>
              Muat ulang halaman untuk melanjutkan dengan versi {newVersion}.
              {queuedCount > 0
                ? " Selesaikan unggahan yang tertunda terlebih dahulu — memuat ulang di tengah unggahan berisiko kehilangan pekerjaan."
                : null}
            </p>
            {queuedCount === 0 ? (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Muat ulang sekarang
              </Button>
            ) : null}
          </Banner>
        ) : null}

        {user?.mustChangePassword === true ? (
          <Banner tone="warning" title="Password wajib diganti">
            Anda masih memakai password sementara.{" "}
            <NavLink to="/profile/password" className="font-medium underline">
              Ganti sekarang
            </NavLink>
            .
          </Banner>
        ) : null}

        {user?.mfaEnrollmentRequired === true ? (
          <Banner tone="warning" title="Autentikasi dua faktor wajib diaktifkan">
            Peran {USER_ROLE_LABELS[user.role]} mewajibkan autentikasi dua faktor.{" "}
            <NavLink to="/profile/mfa" className="font-medium underline">
              Daftarkan sekarang
            </NavLink>
            .
          </Banner>
        ) : null}

        {children}
      </main>
    </div>
  );
}

function NavItem({ to, label, block = false }: { to: string; label: string; block?: boolean }): ReactNode {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-2 text-sm font-medium",
          block && "block",
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
        )
      }
    >
      {label}
    </NavLink>
  );
}
