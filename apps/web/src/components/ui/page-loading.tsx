import { type ReactNode } from "react";
import { Spinner } from "./primitives.tsx";

/**
 * The placeholder shown while a route chunk is still arriving.
 *
 * It lives here rather than in `App.tsx` because both sides of the public /
 * protected split need it, and importing it back out of `App.tsx` would put the
 * whole application into the initial bundle again — which is the thing the
 * split exists to prevent.
 */
export function PageLoading(): ReactNode {
  return (
    <div className="flex items-center justify-center py-20 text-muted">
      <Spinner className="h-6 w-6" />
      <span className="ml-2 text-sm">Memuat…</span>
    </div>
  );
}
