import { type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { PHOTOS, type PhotoName } from "../../lib/photo-manifest.ts";
import "../../styles/lqip.css";

/**
 * A photograph, in every format and size that was actually generated for it.
 *
 * AVIF first, WebP next, JPEG last — the browser takes the first it can decode,
 * so an old one still gets a picture and a current one gets a file a third of
 * the size. The widths come from `photo-manifest.ts`, which the image pipeline
 * writes, so this can never advertise a rendition that does not exist: the
 * tread macro stops at 1280 because its source is 1280 wide.
 *
 * `width` and `height` are always set. Without them the page reflows when each
 * photograph arrives, and on the landing page that means the text a reader is
 * part-way through moving under them.
 *
 * The blur placeholder is a background class from a generated stylesheet, not
 * an inline style — see the note in `scripts/process-images.ts` for why the
 * obvious version does not work under this CSP.
 */
export function Photo({
  name,
  alt,
  sizes,
  priority = false,
  className,
  imgClassName,
}: {
  name: PhotoName;
  /**
   * Indonesian, and descriptive rather than decorative — it is read aloud.
   * Pass an empty string for a photograph that carries no information, and it
   * is hidden from assistive technology instead of described badly.
   */
  alt: string;
  /** What `sizes` the slot occupies. Getting this wrong wastes the srcset. */
  sizes: string;
  /** The hero only. Everything else loads lazily. */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}): ReactNode {
  const photo = PHOTOS[name];
  const widest = photo.widths[photo.widths.length - 1] ?? 640;
  const height = Math.round(widest / photo.aspect);

  const srcSet = (ext: string): string =>
    photo.widths.map((w) => `/img/${name}-${String(w)}.${ext} ${String(w)}w`).join(", ");

  return (
    <picture className={cn(`lqip-${name}`, className)}>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet("webp")} sizes={sizes} />
      <img
        src={`/img/${name}-${String(widest)}.jpg`}
        srcSet={srcSet("jpg")}
        sizes={sizes}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        width={widest}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
        className={imgClassName}
      />
    </picture>
  );
}
