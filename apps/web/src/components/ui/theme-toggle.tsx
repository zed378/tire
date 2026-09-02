import { type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { useTheme } from "../../lib/theme.tsx";

/**
 * Light/dark switch.
 *
 * A real `<button>` with `aria-pressed`, not a `<span tabIndex={0}>` with a
 * keydown handler — the span had to reimplement Enter and Space by hand, was
 * announced as nothing in particular, and did not report its state.
 */
export function ThemeToggle({ className }: { className?: string }): ReactNode {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label="Mode gelap"
      title={isDark ? "Ubah ke tema terang" : "Ubah ke tema gelap"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line",
        "bg-surface text-muted transition-colors hover:bg-surface-sunken hover:text-body",
        className,
      )}
    >
      {isDark ? (
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
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
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
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}
