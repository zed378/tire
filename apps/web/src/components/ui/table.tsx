import { type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/**
 * A data table that becomes a list of cards on a small screen.
 *
 * Both shapes are rendered from one column definition, so a column cannot be
 * added to the desktop view and forgotten on the phone. Which one is visible is
 * decided by CSS, not by JavaScript measuring the viewport — that keeps it
 * correct on first paint and when the device is rotated.
 *
 * The alternative, a horizontally scrolling table, is what the reports page had.
 * It works, but on a 360px screen it hides most of the columns behind a gesture
 * with nothing on screen to suggest it. Supplier and QC staff both use phones
 * (PLAN/00 §4), so the small-screen form has to be readable rather than merely
 * present.
 *
 * DENSITY IS SPLIT BETWEEN THE TWO SHAPES, deliberately. The desktop table is
 * read by scanning a column, so tight rows put more of the data in one glance
 * and the separators do the work padding was doing. The cards are read one at a
 * time and touched with a thumb, so they keep their spacing: `PLAN/00` §4 is
 * about phones in garages, and a dense card is a card whose rows are hard to
 * hit.
 */

export interface Column<Row> {
  /** Stable key, also used as the React key for the cell. */
  key: string;
  header: string;
  /** Cell contents for a row. */
  cell: (row: Row) => ReactNode;
  /** Right-align numeric columns; they are read by magnitude. */
  align?: "left" | "right";
  /** Hide this column in the small-screen card. Use for repeated context. */
  hideOnCard?: boolean;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /**
   * Describes the table for someone who cannot see it. Visually hidden, but
   * present — a table with no caption is announced only as "table".
   */
  caption: string;
  /** Shown in place of both layouts when there are no rows. */
  empty?: ReactNode;
  className?: string;
}): ReactNode {
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  return (
    <div className={className}>
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-sunken">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                // Tight rows are easy to lose your place in on a wide table. A
                // hover tint tracks the eye across without costing any height.
                className="border-b border-line last:border-0 hover:bg-surface-sunken"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-2.5 py-1.5 text-body",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Small screens: one card per row, each cell labelled. */}
      <ul className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-line bg-surface p-3">
            <dl className="space-y-1.5">
              {columns
                .filter((column) => column.hideOnCard !== true)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-subtle">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-body">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
