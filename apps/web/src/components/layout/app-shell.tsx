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
 * Identity and the way out are in the header, once. They used to be in both the
 * header and the sidebar footer, which meant a user's name rendered twice on
 * every desktop screen and there were two Keluar controls — and the header's
 * carried a three-dots glyph rather than anything resembling logout.
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

  // Only the count is wanted, so ask for a single row and read the total. The
  // bell was previously indistinguishable whether or not anything was waiting
  // behind it, which is most of the reason to have a bell.
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
    <div className="flex min-h-dvh bg-canvas">
      {/*
       * First thing in the tab order: a keyboard user should not have to walk
       * the whole navigation on every page to reach what they came for.
       */}
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Lewati ke konten
      </a>

      <Sidebar />

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-40 flex-shrink-0 border-b border-line bg-surface">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              className="rounded-md p-2 text-muted hover:bg-surface-sunken hover:text-body md:hidden"
              aria-label="Buka menu"
              aria-expanded={sidebarOpen}
              onClick={() => {
                setSidebarOpen((open) => !open);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
              </svg>
            </button>

            <div className="ml-auto flex items-center gap-2">
              {queuedCount > 0 ? (
                <Link
                  to="/upload-queue"
                  className="rounded-full border border-warning-line bg-warning-soft px-3 py-1 text-xs font-medium text-warning-text"
                >
                  {queuedCount} foto menunggu
                </Link>
              ) : null}

              <ThemeToggle />

              <Link
                to="/notifications"
                className="relative rounded-md p-2 text-muted hover:bg-surface-sunken hover:text-body"
                aria-label={
                  unreadCount > 0
                    ? `Notifikasi, ${String(unreadCount)} belum dibaca`
                    : "Notifikasi"
                }
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 2a5 5 0 00-5 5v3L3.5 13h13L15 10V7a5 5 0 00-5-5zM8 15a2 2 0 104 0H8z" />
                </svg>
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-5 text-white"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              <div className="flex items-center gap-2 border-l border-line pl-2">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-body">{user?.displayName}</p>
                  <p className="text-xs text-muted">
                    {user === null ? "" : USER_ROLE_LABELS[user.role]}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted hover:bg-surface-sunken hover:text-body"
                  onClick={() => void logout()}
                  aria-label="Keluar"
                  title="Keluar"
                >
                  {/* A door with an arrow leaving it. The previous glyph was
                      three dots, which says "more", not "sign out". */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="konten-utama" tabIndex={-1} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6">{children}</div>
        </main>
      </div>

      {sidebarOpen ? (
        <>
          <button
            type="button"
            aria-label="Tutup menu"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl md:hidden">
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
