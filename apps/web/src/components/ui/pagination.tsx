import { type ReactNode } from "react";
import { Button } from "./primitives.tsx";

/**
 * Previous/next paging with a position readout.
 *
 * Three pages had grown their own copy of this — the inspection list, the QC
 * queue, and the audit trail — and they had already drifted apart in wording
 * and in whether the buttons disabled at the ends.
 *
 * `aria-live="polite"` on the readout matters: without it, a keyboard user who
 * presses "Berikutnya" hears nothing at all, because the button they are
 * standing on does not change.
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}): ReactNode {
  // One page of results needs no controls; showing them disabled is noise.
  if (totalPages <= 1) return null;

  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-wrap items-center justify-between gap-3 pt-4"
    >
      <p aria-live="polite" className="text-sm text-muted">
        Halaman {page} dari {totalPages}
        {totalItems === undefined ? null : ` · ${String(totalItems)} data`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || atStart}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          Sebelumnya
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || atEnd}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
