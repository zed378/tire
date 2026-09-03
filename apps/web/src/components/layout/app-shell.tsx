import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { USER_ROLE_LABELS, type NotificationRecord, type Paginated } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { startQueueProcessor, subscribeToQueue, summarise } from "../../lib/photo/upload-queue.ts";
import { useSession } from "../../lib/session.tsx";
import { Sidebar } from "./sidebar.tsx";
import { ThemeToggle } from "../ui/theme-toggle.tsx";

/**
 * The frame every authenticated screen sits in.
 *
 * Identity and the way out are in the header, once.
 * The sidebar stays fixed on the left and never scrolls with page content.
 */
export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const location = useLocation();
  const { user, logout } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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

  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      api.get<Paginated<NotificationRecord>>("/api/notifications", {
        unreadOnly: true,
        perPage: 1,
      }),
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data?.total ?? 0;

  return (
    <div className="min-h-dvh bg-canvas md:flex">
      {/* Accessibility skip link */}
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-dialog focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Lewati ke konten
      </a>

      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Right Main Content Area */}
      <div className="flex min-h-dvh w-full min-w-0 flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-header flex-shrink-0 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-body md:hidden"
              aria-label="Buka menu navigasi"
              aria-expanded={sidebarOpen}
              onClick={() => {
                setSidebarOpen((open) => !open);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
              {queuedCount > 0 ? (
                <Link
                  to="/upload-queue"
                  className="flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-3 py-1 text-xs font-medium text-warning-text hover:opacity-90 transition-opacity"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                  {queuedCount} foto antrean
                </Link>
              ) : null}

              <ThemeToggle />

              <Link
                to="/notifications"
                className="relative rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-body transition-colors"
                aria-label={
                  unreadCount > 0
                    ? `Notifikasi, ${String(unreadCount)} belum dibaca`
                    : "Notifikasi"
                }
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute 0 top-1 right-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white shadow-sm"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              {/* User Profile & Logout */}
              <div className="flex items-center gap-2 border-l border-line pl-3">
                {/* The identity block is the way to the account screen — where
                    the session list and "keluar dari semua perangkat" live. It
                    used to be inert text. */}
                <Link
                  to="/profile"
                  className="hidden rounded-md px-1.5 py-1 text-right transition-colors hover:bg-surface-sunken sm:block"
                >
                  <span className="block text-xs font-semibold leading-tight text-body">
                    {user?.displayName}
                  </span>
                  <span className="block text-[11px] leading-tight text-muted">
                    {user === null ? "" : USER_ROLE_LABELS[user.role]}
                  </span>
                </Link>

                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger-text transition-colors"
                  onClick={() => void logout()}
                  aria-label="Keluar dari akun"
                  title="Keluar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content Viewport */}
        <main
          id="konten-utama"
          tabIndex={-1}
          className="w-full min-w-0 flex-1 focus:outline-none"
        >
          <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay & Drawer */}
      {sidebarOpen ? (
        <>
          <button
            type="button"
            aria-label="Tutup menu"
            className="fixed inset-0 z-drawer-scrim bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />
          <div className="fixed inset-y-0 left-0 z-drawer w-72 max-w-[85vw] shadow-2xl md:hidden">
            <Sidebar
              onNavigate={() => {
                setSidebarOpen(false);
              }}
              isMobile
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
