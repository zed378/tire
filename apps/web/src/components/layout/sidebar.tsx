import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2 2 8v10h6v-5h4v5h6V8l-8-6z" />
      </svg>
    ),
  },
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
        <path d="M10 1 3 4v5c0 4 3 7.4 7 9 4-1.6 7-5 7-9V4l-7-3zm-1 12L5.5 9.5 7 8l2 2 4-4 1.5 1.5L9 13z" />
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
    end: true,
    // These three had no route into them except a row of chips on the parent
    // page, so nothing in the navigation said they existed and nothing showed
    // where you were once inside one.
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

const LINK_BASE =
  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors min-h-11";
const LINK_ACTIVE = "bg-accent-soft text-accent-text";
const LINK_IDLE = "text-muted hover:bg-surface-sunken hover:text-body";

/**
 * Primary navigation.
 *
 * Entries the current user has no permission for are not rendered at all,
 * rather than rendered and disabled (K-07). The server enforces the same rules
 * independently — hiding a menu is not authorisation (PLAN/04 §2.2).
 *
 * Identity and logout live in the header, not here: having them in both places
 * meant the user's name and role appeared twice on every desktop screen.
 */
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
    <aside
      className={cn(
        "flex h-dvh flex-shrink-0 flex-col border-r border-line bg-surface",
        isMobile ? "w-full border-r-0" : "hidden w-64 md:flex",
      )}
    >
      <div className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-on-accent shadow-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-body">Commercial 2026</span>
            <span className="text-xs text-muted">Tire Data System</span>
          </div>
        </div>

        {isMobile ? (
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-body"
            aria-label="Tutup menu"
            onClick={onNavigate}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.to}>
              <NavLink
                to={entry.to}
                end={entry.end}
                onClick={onNavigate}
                className={({ isActive }) => cn(LINK_BASE, isActive ? LINK_ACTIVE : LINK_IDLE)}
              >
                <span className="flex-shrink-0">{entry.icon}</span>
                <span>{entry.label}</span>
              </NavLink>

              {entry.children !== undefined ? (
                <ul className="mt-1 space-y-1 border-l border-line pl-3 ml-5">
                  {entry.children
                    .filter((child) => child.permission === null || can(child.permission))
                    .map((child) => (
                      <li key={child.to}>
                        <NavLink
                          to={child.to}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              "flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors",
                              isActive ? LINK_ACTIVE : LINK_IDLE,
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
    </aside>
  );
}
