import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { USER_ROLE_LABELS, type Permission } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { useSession } from "../../lib/session.tsx";
import { Button } from "../ui/primitives.tsx";

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  permission: Permission | null;
}

const NAV_ENTRIES: NavEntry[] = [
  {
    to: "/inspections",
    label: "Pengajuan",
    permission: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 3a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V3zm2 0v10h8V3H6zm2 2h4v2H8V5zm0 4h4v2H8V9z" />
      </svg>
    ),
  },
  {
    to: "/qc",
    label: "Quality Control",
    permission: "qc.review",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a6 6 0 00-6 6v3l-1.5 3h15L16 11V8a6 6 0 00-6-6zM8 15a2 2 0 104 0H8z" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Pelaporan",
    permission: "report.view",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3 3h14v2H3V3zm0 4h14v2H3V7zm0 4h14v2H3v-2zm0 4h10v2H3v-2z" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Pengguna",
    permission: "user.manage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 4a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4zM4 18a4 4 0 0112 0v1H4v-1z" />
      </svg>
    ),
  },
  {
    to: "/master-data",
    label: "Master Data",
    permission: "masterdata.manage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm3 2h4v2H8V5zm0 4h4v2H8V9zm0 4h3v2H8v-2z" />
      </svg>
    ),
  },
  {
    to: "/audit",
    label: "Jejak Audit",
    permission: "audit.read",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3 3a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V3zm3 0v4h10V3H6zm0 6v6h10V9H6z" />
      </svg>
    ),
  },
  {
    to: "/ops",
    label: "Operasional",
    permission: "ops.health.read",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a6 6 0 00-6 6v3.28A6 6 0 0010 18a6 6 0 006-6V8a6 6 0 00-6-6zm-2 10a2 2 0 110-4 2 2 0 010 4zm8 0a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    ),
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const { user, can, logout } = useSession();

  const entries = NAV_ENTRIES.filter(
    (entry) => entry.permission === null || can(entry.permission),
  );

  return (
    <aside className="flex h-dvh w-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:w-64 md:border-r transition-colors duration-200">
      <div className="flex h-16 items-center justify-between gap-2 px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Commercial 2026</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Tire Data System</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          aria-label="Tutup menu"
          onClick={onNavigate}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.to}>
              <NavLink
                to={entry.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-cyan-400 dark:border dark:border-cyan-500/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
                  )
                }
              >
                <span className="flex-shrink-0">{entry.icon}</span>
                <span>{entry.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-800 p-3">
        <div className="mb-2 rounded-md bg-slate-50 dark:bg-slate-950 p-2 border dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.displayName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {user === null ? "" : USER_ROLE_LABELS[user.role]}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-center dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => {
            void logout();
          }}
        >
          Keluar
        </Button>
      </div>
    </aside>
  );
}
