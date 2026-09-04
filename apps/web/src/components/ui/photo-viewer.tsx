import { useEffect, type ReactNode } from "react";
import type { PhotoRecord } from "@c26/contracts";
import { formatDateTime } from "../../lib/format.ts";
import { Dialog } from "./feedback.tsx";
import { Button } from "./primitives.tsx";

/**
 * One photograph at a size where you can actually judge it.
 *
 * The grids elsewhere show 64px and 160px thumbnails, which is enough to see
 * that a photograph exists and not nearly enough to see that it is blurred —
 * and "foto buram" is the commonest QC rejection there is. A reviewer deciding
 * from a thumbnail is guessing.
 *
 * Built on the shared `Dialog` rather than a bespoke overlay, so it inherits the
 * modal contract that is already tested: `aria-modal`, a labelled title, a focus
 * trap, Escape, and focus handed back to the thumbnail that opened it. A
 * lightbox is exactly the kind of component that gets built as a bare div and
 * quietly has none of those.
 */

export function PhotoViewer({
  photos,
  openId,
  onOpenChange,
  onDelete,
  deleting = false,
}: {
  photos: PhotoRecord[];
  /** The photograph being shown, or `null` when the viewer is closed. */
  openId: number | null;
  onOpenChange: (photoId: number | null) => void;
  /** Omitted where deleting is not allowed — QC review, or a submitted draft. */
  onDelete?: (photoId: number) => void;
  deleting?: boolean;
}): ReactNode {
  const index = photos.findIndex((photo) => photo.id === openId);
  const photo = index === -1 ? undefined : photos[index];

  // Arrow keys, because a reviewer works through a set of photographs and
  // reaching for the mouse between each one is the slow way to do it.
  useEffect(() => {
    if (photo === undefined) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = photos[index + step];
      if (next !== undefined) {
        event.preventDefault();
        onOpenChange(next.id);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [photo, photos, index, onOpenChange]);

  if (photo === undefined) return null;

  const label = photo.tirePositionLabel ?? photo.slot;
  const previous = photos[index - 1];
  const next = photos[index + 1];

  return (
    <Dialog
      open
      size="wide"
      title={label}
      description={
        photo.capturedAt === null
          ? `Foto ${String(index + 1)} dari ${String(photos.length)} · waktu pengambilan tidak tersedia`
          : `Foto ${String(index + 1)} dari ${String(photos.length)} · diambil ${formatDateTime(photo.capturedAt)}`
      }
      onClose={() => {
        onOpenChange(null);
      }}
    >
      <img
        src={photo.url}
        alt={`Foto ${label}, ${String(index + 1)} dari ${String(photos.length)}`}
        // `contain` rather than `cover`: a photograph judged for blur must not
        // be cropped by the frame it happens to be shown in.
        className="max-h-[70vh] w-full rounded-md bg-surface-sunken object-contain"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={previous === undefined}
            onClick={() => {
              if (previous !== undefined) onOpenChange(previous.id);
            }}
          >
            ← Sebelumnya
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={next === undefined}
            onClick={() => {
              if (next !== undefined) onOpenChange(next.id);
            }}
          >
            Berikutnya →
          </Button>
        </div>

        {onDelete === undefined ? null : (
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            loadingText="Menghapus…"
            onClick={() => {
              onDelete(photo.id);
            }}
          >
            Hapus Foto
          </Button>
        )}
      </div>
    </Dialog>
  );
}

/**
 * A thumbnail that opens the viewer.
 *
 * A `<button>` rather than an `<img>` with an `onClick`: it has to be reachable
 * by keyboard and announced as something that can be operated. The accessible
 * name says what will happen and to which photograph, because "image" repeated
 * eleven times down a list tells a screen-reader user nothing.
 *
 * Nothing is nested inside it — no delete cross in the corner. A control inside
 * a control is the `nested-interactive` defect the searchable select already
 * had, and deleting from the viewer is better anyway: you can see what you are
 * about to remove.
 */
export function PhotoThumbnail({
  photo,
  label,
  index,
  total,
  onOpen,
  className,
}: {
  photo: PhotoRecord;
  label: string;
  index: number;
  total: number;
  onOpen: () => void;
  className?: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lihat foto ${label}, ${String(index + 1)} dari ${String(total)}`}
      className={`block overflow-hidden rounded border border-line transition-colors hover:border-accent ${
        className ?? ""
      }`}
    >
      <img
        src={photo.thumbnailUrl ?? photo.url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </button>
  );
}
