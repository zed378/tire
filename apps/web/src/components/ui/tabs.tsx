import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/**
 * Underlined tab bar.
 *
 * The hand-rolled versions on the master data pages were a row of plain
 * buttons: no `role`, no `aria-selected`, and no arrow-key movement, so a
 * screen reader announced a group of unrelated buttons and gave no hint that
 * choosing one changed the panel below.
 *
 * The keyboard contract implemented here is the standard one — arrows move and
 * activate, Home and End jump to the ends, and only the selected tab is in the
 * tab order, so Tab moves past the whole bar to the panel rather than through
 * every tab in it.
 */

export interface TabItem<Value extends string> {
  value: Value;
  label: string;
  /** Optional count shown after the label, e.g. the number of rows behind it. */
  badge?: number;
}

export function Tabs<Value extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Names the tab bar for assistive technology, e.g. "Kategori master data". */
  label: string;
  className?: string;
}): ReactNode {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number): void => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const current = items.findIndex((item) => item.value === value);
    if (current === -1) return;

    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;

    if (next === null) return;
    event.preventDefault();

    const target = items[next];
    if (target === undefined) return;
    onChange(target.value);
    focusTab(next);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap gap-1 border-b border-line", className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`panel-${item.value}`}
            // Roving tabindex: Tab enters the bar once and then leaves it.
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(item.value);
            }}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-3 text-sm font-medium transition-colors",
              selected
                ? "border-accent text-accent-text"
                : "border-transparent text-muted hover:border-line-strong hover:text-body",
            )}
          >
            {item.label}
            {item.badge !== undefined ? (
              <span className="ml-1.5 text-xs text-subtle">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The region a tab controls. Pair with the `value` of the selected tab. */
export function TabPanel({ value, children }: { value: string; children: ReactNode }): ReactNode {
  return (
    <div id={`panel-${value}`} role="tabpanel" aria-labelledby={`tab-${value}`} tabIndex={0}>
      {children}
    </div>
  );
}
