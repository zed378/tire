import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/**
 * Animates its children in the first time they scroll into view.
 *
 * WHY IT IS BUILT THIS WAY, and not with a motion library: the CSP is
 * `style-src 'self'` with no `unsafe-inline` (PLAN/13 §7). Framer Motion and
 * everything like it animate by writing to `element.style`, which the browser
 * refuses — the same reason Recharts could not be used for the dashboard. So
 * the movement is CSS keyframes, and the only thing JavaScript does is add a
 * class when the element appears.
 *
 * CONTENT IS NEVER HIDDEN WAITING FOR JAVASCRIPT. The usual pattern sets
 * `opacity: 0` in CSS and clears it from an observer, which leaves the page
 * blank for anyone whose JavaScript failed or whose browser lacks
 * IntersectionObserver. Here the element is plain and visible; the animation
 * class is only ever added. The worst case is that something appears without
 * having animated, which nobody will notice.
 */
export function Reveal({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  /** One of a fixed set of steps — a computed delay would need a style attribute. */
  delay?: 1 | 2 | 3 | 4;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null || shown) return;

    // Older Safari, and any browser where this is disabled: show it and move on.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // A little before it reaches the fold, so the movement finishes as it
      // arrives rather than starting once it is already being read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={cn(
        shown && "animate-fade-up",
        shown && delay !== undefined && DELAY[delay],
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Staggering, as fixed classes.
 *
 * `animation-delay` cannot be computed into a `style` attribute here, so the
 * steps are enumerated. Four is enough for every list on these pages.
 */
const DELAY: Record<1 | 2 | 3 | 4, string> = {
  1: "[animation-delay:80ms]",
  2: "[animation-delay:160ms]",
  3: "[animation-delay:240ms]",
  4: "[animation-delay:320ms]",
};
