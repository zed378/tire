/**
 * The one place a validation rule lives.
 *
 * Both `apps/api` and `apps/web` import from here, which is what makes drift
 * between client and server validation structurally impossible rather than
 * merely discouraged (PLAN/01 §4.4). The legacy system's D-07 — HTML5
 * `required` producing English browser tooltips in an Indonesian UI, bypassable
 * by anyone — is closed by this package existing, not by remembering to check.
 *
 * This package must never import anything from `apps/`. ESLint enforces it.
 */

export * from "./constants.ts";
export * from "./errors.ts";
export * from "./envelope.ts";
export * from "./permissions.ts";
export * from "./status-machine.ts";
export * from "./axle/index.ts";
export * from "./vehicle.ts";
export * from "./inspection.ts";
export * from "./auth.ts";
export * from "./user.ts";
export * from "./master-data.ts";
export * from "./photo.ts";
export * from "./qc.ts";
export * from "./tire-spec.ts";
export * from "./report.ts";
export * from "./notification.ts";
export * from "./ops.ts";
