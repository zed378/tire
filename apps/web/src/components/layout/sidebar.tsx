import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Permission } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { useSession } from "../../lib/session.tsx";

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  permission: Permission | null;
  /** Nested entries, shown indented under their parent when it is reachable. */
  children?: { to: string; label: string; permission: Permission | null }[];
  /** `end` on a NavLink stops a parent matching every child route. */
  end?: boolean;
}

const NAV_ENTRIES: NavEntry[] = [
  {
    to: "/welcome",
    label: "Beranda",
    permission: null,
    end: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: "/inspections",
    label: "Pengajuan",
    permission: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: "/qc",
    label: "Quality Control",
    permission: "qc.review",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Pelaporan",
    permission: "report.view",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Pengguna",
    permission: "user.manage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/master-data",
    label: "Master Data",
    permission: "masterdata.manage",
    end: true,
    children: [
      { to: "/master-data/vehicle-brands", label: "Merk Kendaraan", permission: "masterdata.manage" },
      {
        to: "/master-data/tire-brand-patterns",
        label: "Merk & Pattern Ban",
        permission: "masterdata.manage",
      },
      { to: "/master-data/tire-sizes", label: "Ukuran Ban", permission: "masterdata.manage" },
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    to: "/audit",
    label: "Jejak Audit",
    permission: "audit.read",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    to: "/ops",
    label: "Operasional",
    permission: "ops.health.read",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

const LINK_BASE =
  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all min-h-11";
const LINK_ACTIVE =
  "bg-accent-soft text-accent-text font-semibold shadow-sm border border-accent/20";
const LINK_IDLE =
  "text-muted hover:bg-surface-sunken hover:text-body";

export function Sidebar({
  onNavigate,
  isMobile = false,
}: {
  onNavigate?: () => void;
  isMobile?: boolean;
}): ReactNode {
  const { can } = useSession();

  const entries = NAV_ENTRIES.filter(
    (entry) => entry.permission === null || can(entry.permission),
  );

  return (
    /*
     * On desktop the <aside> is an ordinary column in the flex row and the
     * document scrolls; the inner div is `sticky top-0 h-dvh`, which pins the
     * navigation while the page moves underneath it.
     *
     * The alternative — locking the whole shell to `h-dvh overflow-hidden` and
     * scrolling an inner container — also holds the sidebar still, but it takes
     * the scroll away from the document, and the browser gives up several things
     * with it: the mobile URL bar stops collapsing, scroll position is no longer
     * restored on Back, and pull-to-refresh dies. Field staff are on phones
     * (PLAN/00 §4), so those are not small losses.
     *
     * In the mobile drawer there is no page to scroll behind it, so it simply
     * fills the panel.
     */
    <aside
      className={cn(
        "flex-shrink-0 border-r border-line bg-surface select-none",
        isMobile ? "h-full w-full border-r-0" : "hidden w-64 md:block",
      )}
    >
      <div
        className={cn(
          "flex flex-col bg-surface",
          isMobile ? "h-full" : "sticky top-0 h-dvh",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <Link to="/welcome" onClick={onNavigate} className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-cyan-500 to-indigo-500 p-0.5 shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-surface">
                <svg className="h-5 w-5 text-accent-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeDasharray="3 3" className="animate-spin-very-slow" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wide text-body">
                COMMERCIAL<span className="text-accent-text">2026</span>
              </span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
                Tire Data System
              </span>
            </div>
          </Link>

          {isMobile ? (
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-body"
              aria-label="Tutup menu"
              onClick={onNavigate}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Navigation Links */}
        <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
            Menu Utama
          </div>
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.to}>
                <NavLink
                  to={entry.to}
                  end={entry.end}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(LINK_BASE, isActive ? LINK_ACTIVE : LINK_IDLE)}
                >
                  <span className="flex-shrink-0 text-current">{entry.icon}</span>
                  <span className="flex-1 truncate">{entry.label}</span>
                </NavLink>

                {entry.children !== undefined ? (
                  <ul className="mt-1 space-y-1 border-l-2 border-line pl-3 ml-5">
                    {entry.children
                      .filter((child) => child.permission === null || can(child.permission))
                      .map((child) => (
                        <li key={child.to}>
                          <NavLink
                            to={child.to}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              cn(
                                "flex min-h-9 items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                                isActive
                                  ? "bg-accent-soft text-accent-text font-semibold"
                                  : "text-muted hover:bg-surface-sunken hover:text-body",
                              )
                            }
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer Info */}
        <div className="flex-shrink-0 border-t border-line p-3">
          <div className="rounded-lg bg-surface-sunken/80 border border-line p-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-body">SYSTEM ONLINE</span>
              <span className="ml-auto text-[10px] font-mono text-muted">TLS 1.3</span>
            </div>
            <p className="mt-1 text-[10px] text-muted truncate">
              Fleet Telemetry &amp; QC Gate
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
