import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
 *
 * ZOOM IS A TRANSFORM ON THE IMAGE, not a swap to a larger file: the stored
 * photograph is already the largest one there is (`PHOTO_MAX_EDGE_PX`), so
 * magnifying it is the whole of the feature. At 1,920px on the long edge there
 * is real detail to find — a sidewall marking, a crack — which is why the edge
 * was raised from 1,600px in the first place.
 *
 * FULLSCREEN USES THE BROWSER'S OWN API rather than a CSS overlay pretending to
 * be one. On a phone that is the difference between the photograph and the
 * photograph with the browser chrome still eating a third of the screen.
 */

/**
 * Steps rather than a continuous slider, for two reasons.
 *
 * The first is the hands: this is operated with gloves on, and a slider is a
 * precision gesture. The second is the CSP. Decision A-07 allows no inline
 * styles, so a computed `style={{ width }}` is silently dropped by the browser
 * and caught by gate G-14 — which means the widths have to be a fixed set of
 * classes Tailwind can compile ahead of time. Discrete steps were the better
 * control anyway; the policy just removed the alternative.
 */
const ZOOM_STEPS = [
  { factor: 1, width: "w-full" },
  { factor: 1.5, width: "w-[150%]" },
  { factor: 2, width: "w-[200%]" },
  { factor: 3, width: "w-[300%]" },
  { factor: 4, width: "w-[400%]" },
] as const;

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

  const frame = useRef<HTMLDivElement>(null);
  const [zoomStep, setZoomStep] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const zoom = ZOOM_STEPS[zoomStep] ?? ZOOM_STEPS[0];

  // A new photograph starts unzoomed. Carrying a 4× magnification into the next
  // one shows a corner of it and looks like a broken image.
  useEffect(() => {
    setZoomStep(0);
  }, [openId]);

  // Fullscreen can be left by pressing Escape or by the operating system, and
  // neither goes through the button. The element is the source of truth.
  useEffect(() => {
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen();
      return;
    }
    // Older Safari has no `requestFullscreen` on an arbitrary element. The
    // button is simply not offered there rather than throwing on a tap.
    void frame.current?.requestFullscreen?.().catch(() => {
      setFullscreen(false);
    });
  }, []);

  // Arrow keys, because a reviewer works through a set of photographs and
  // reaching for the mouse between each one is the slow way to do it.
  useEffect(() => {
    if (photo === undefined) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // `+` and `-` zoom, arrows move between photographs. Both are what a
      // reviewer's hands already expect from every other image viewer.
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoomStep((current) => Math.min(current + 1, ZOOM_STEPS.length - 1));
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        setZoomStep((current) => Math.max(current - 1, 0));
        return;
      }

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
      {/*
        The frame is what goes fullscreen, and it is what scrolls once the image
        is larger than it. `overflow-auto` is the pan: at 4× the photograph is
        wider than the frame, and dragging the scrollbars is a gesture that
        already exists on every device rather than one this has to invent.
      */}
      <div
        ref={frame}
        className={
          fullscreen
            ? "flex h-screen w-screen items-center justify-center overflow-auto bg-black"
            : "max-h-[70vh] overflow-auto rounded-md bg-surface-sunken"
        }
      >
        <img
          src={photo.url}
          alt={`Foto ${label}, ${String(index + 1)} dari ${String(photos.length)}`}
          // `contain` rather than `cover`: a photograph judged for blur must not
          // be cropped by the frame it happens to be shown in. At 1× it fits;
          // beyond that `width` grows and the frame scrolls.
          className={
            zoom.factor === 1
              ? "max-h-[70vh] w-full object-contain"
              : `max-w-none object-contain ${zoom.width}`
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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

          {/*
            Zoom out, the current factor, zoom in. The factor is shown rather
            than implied: at 2× on a photograph that already fills the frame,
            nothing on screen otherwise says why it stopped growing.
          */}
          <div className="ml-2 flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Perkecil"
              disabled={zoomStep === 0}
              onClick={() => {
                setZoomStep((current) => Math.max(current - 1, 0));
              }}
            >
              −
            </Button>
            <span className="min-w-12 text-center font-data text-xs text-muted">
              {zoom.factor.toLocaleString("id-ID")}×
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Perbesar"
              disabled={zoomStep === ZOOM_STEPS.length - 1}
              onClick={() => {
                setZoomStep((current) => Math.min(current + 1, ZOOM_STEPS.length - 1));
              }}
            >
              +
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleFullscreen}
          >
            {fullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
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
