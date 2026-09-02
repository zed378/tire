import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { setVersionMismatchHandler } from "../../lib/api-client.ts";
import { startQueueProcessor, subscribeToQueue, summarise } from "../../lib/photo/upload-queue.ts";
import { Banner } from "../ui/feedback.tsx";
import { Sidebar } from "./sidebar.tsx";

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    setSidebarOpen(false);
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

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-3">
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
              <div className="hidden md:flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-900">Commercial 2026</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-4">
            {newVersion !== null ? (
              <Banner tone="info" title="Versi baru tersedia">
                <p>
                  Muat ulang halaman untuk melanjutkan dengan versi {newVersion}.
                  {queuedCount > 0
                    ? " Selesaikan unggahan yang tertunda terlebih dahulu — memuat ulang di tengah unggahan berisiko kehilangan pekerjaan."
                    : null}
                </p>
                {queuedCount === 0 ? (
                  <button
                    type="button"
                    className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      window.location.reload();
                    }}
                  >
                    Muat ulang sekarang
                  </button>
                ) : null}
              </Banner>
            ) : null}

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
