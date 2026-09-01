import type { UserRole } from "./constants.ts";

/**
 * The permission matrix (PLAN/04 §2.1).
 *
 * Written once here and imported by both sides, so navigation hiding (layer 1),
 * route guards (layer 2), and tests all read the same table. The three-layer
 * model from PLAN/04 §2.2 still holds: hiding a menu is a courtesy, the route
 * guard is the enforcement, and the query scope is the last line.
 *
 * Two rows deserve attention. `report.export` is granted to `manager`, closing
 * D-14 — the role whose entire job is reporting was the only one that could not
 * export anything. And every `qc.*` and `tirespec.write` cell is empty for
 * `operator`: that is not an oversight but the point of the role split. An
 * operator maintains the system; they do not make business decisions inside it.
 * If an operator could change a QC decision, the audit trail would stop being
 * evidence — and evidence is the reason D-15 is being fixed at all.
 */

export const PERMISSIONS = [
  "submission.create",
  "submission.read.own",
  "submission.read.all",
  "submission.update.own_draft",
  "submission.resubmit",
  "photo.upload.own",
  "photo.read",
  "qc.review",
  "qc.revert",
  "tirespec.write",
  "masterdata.manage",
  "user.manage",
  "report.view",
  "report.export",
  "audit.read",
  "notification.read.own",
  "notification.preferences.manage",
  "ops.health.read",
  "ops.job.retry",
  "ops.log.search",
  "ops.orphan.cleanup",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  supplier: [
    "submission.create",
    "submission.read.own",
    "submission.update.own_draft",
    "submission.resubmit",
    "photo.upload.own",
    "photo.read",
    "notification.read.own",
    "notification.preferences.manage",
  ],
  admin: [
    "submission.read.all",
    "photo.read",
    "qc.review",
    "qc.revert",
    "tirespec.write",
    "masterdata.manage",
    "user.manage",
    "report.view",
    "report.export",
    "audit.read",
    "notification.read.own",
    "notification.preferences.manage",
  ],
  manager: [
    "report.view",
    "report.export",
    "notification.read.own",
    "notification.preferences.manage",
  ],
  operator: [
    "user.manage",
    "audit.read",
    "notification.read.own",
    "notification.preferences.manage",
    "ops.health.read",
    "ops.job.retry",
    "ops.log.search",
    "ops.orphan.cleanup",
  ],
};

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Actions that require a fresh MFA verification (PLAN/13 §4).
 *
 * A 12-hour session means an unlocked phone left in a garage grants twelve hours
 * of access. For a handful of actions that is too loose. QC decisions are
 * deliberately absent: they happen too often, and the friction would outweigh
 * the protection.
 */
export const STEP_UP_PERMISSIONS: readonly Permission[] = [
  "user.manage",
  "ops.job.retry",
  "ops.orphan.cleanup",
];

export function requiresStepUp(permission: Permission): boolean {
  return STEP_UP_PERMISSIONS.includes(permission);
}
