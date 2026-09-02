import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { startQueueProcessor, subscribeToQueue, summarise } from "../../lib/photo/upload-queue.ts";
import { useSession } from "../../lib/session.tsx";
import { USER_ROLE_LABELS } from "@c26/contracts";
import { Sidebar } from "./sidebar.tsx";

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

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Buka menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
              </svg>
            </button>

            <div className="flex items-center gap-3 ml-auto">
              {queuedCount > 0 ? (
                <a
                  href="/upload-queue"
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                >
                  {queuedCount} foto menunggu
                </a>
              ) : null}

              <a
                href="/notifications"
                className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Notifikasi"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 2a5 5 0 00-5 5v3L3.5 13h13L15 10V7a5 5 0 00-5-5zM8 15a2 2 0 104 0H8z" />
                </svg>
              </a>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-slate-900">{user?.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {user === null ? "" : USER_ROLE_LABELS[user.role]}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                  onClick={() => void logout()}
                  aria-label="Keluar"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5 9a2 2 0 11-4 0 2 2 0 014 0zm7 0a2 2 0 11-4 0 2 2 0 014 0zm5 0a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-4">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
