import {
  isLockingStatus,
  requiresStepUp,
  roleHasPermission,
  type InspectionStatus,
  type Permission,
  type UserRole,
} from "@c26/contracts";
import { AppError, forbidden } from "./envelope/index.ts";

/**
 * Authorisation layers 2 and 3 (PLAN/04 §2.2).
 *
 * Layer 1 is the client not rendering a menu, which K-07 keeps because it makes
 * a cleaner UI than disabled items. But hiding is not enforcing: anyone calling
 * the server directly walked straight past it in the legacy system. These are
 * the layers that actually hold.
 */

export interface Actor {
  id: bigint;
  username: string;
  displayName: string;
  role: UserRole;
  sessionId: string;
  /** Set when this session has passed a step-up check within the last 15 minutes. */
  elevatedUntil: Date | null;
  /** Region assignment (D-13). Empty means unrestricted. */
  provinceIds: bigint[];
  cityIds: bigint[];
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!roleHasPermission(actor.role, permission)) {
    throw forbidden(permission);
  }

  // PLAN/13 §4. A 12-hour session means an unlocked phone left in a garage grants
  // twelve hours of access; for a handful of actions that is too loose. QC
  // decisions are deliberately not on the list — they happen too often, and the
  // friction would exceed the protection.
  if (requiresStepUp(permission)) {
    const elevated = actor.elevatedUntil !== null && actor.elevatedUntil.getTime() > Date.now();
    if (!elevated) {
      throw new AppError("STEP_UP_REQUIRED", { context: { permission } });
    }
  }
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return roleHasPermission(actor.role, permission);
}

// ── Data scope (layer 3) ────────────────────────────────────────────────────

/**
 * Written once, spread into every inspection query.
 *
 * Repeating a scope condition inline is the single most common way an
 * authorisation leak is born: one query forgets it, and the whole model
 * collapses (PLAN/04 §2.2).
 */
export function inspectionScope(actor: Actor): {
  deletedAt: null;
  submittedById?: bigint;
  status?: InspectionStatus;
} {
  switch (actor.role) {
    case "supplier":
      // PLAN/03 §8: a supplier sees only their own work, enforced here rather
      // than by hiding it in the UI.
      return { deletedAt: null, submittedById: actor.id };
    case "admin":
      return { deletedAt: null };
    case "manager":
      // Reporting sees finished work only; a manager has no business reading
      // drafts or pending queues.
      return { deletedAt: null, status: "passed_qc" };
    case "operator":
      // PLAN/10 §2.1. An operator maintains the system; they do not read or
      // change business data. If they could alter a QC decision, the audit trail
      // would stop being evidence.
      throw forbidden("submission.read.all");
  }
}

export function vehicleScope(actor: Actor): { deletedAt: null; createdById?: bigint } {
  switch (actor.role) {
    case "supplier":
      // PLAN/11 §6 rule 3: a supplier only sees vehicles they have inspected. If
      // every supplier could browse the whole fleet by plate, the system would
      // become a directory of the customer's vehicles — a privacy problem nobody
      // asked for.
      return { deletedAt: null, createdById: actor.id };
    case "admin":
      return { deletedAt: null };
    case "manager":
      return { deletedAt: null };
    case "operator":
      throw forbidden("submission.read.all");
  }
}

/**
 * V-12: a supplier may only work in the regions assigned to them.
 *
 * No rows at all means no restriction. A province row grants every city in it;
 * rows combine as a union, never an intersection (PLAN/04 §3).
 */
export function assertCityInScope(
  actor: Actor,
  city: { id: bigint; provinceId: bigint },
): void {
  if (actor.role !== "supplier") return;
  if (actor.provinceIds.length === 0 && actor.cityIds.length === 0) return;

  const allowed =
    actor.cityIds.some((id) => id === city.id) ||
    actor.provinceIds.some((id) => id === city.provinceId);

  if (!allowed) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "cityId",
          code: "NOT_ALLOWED",
          message: "Kota ini berada di luar wilayah penugasan Anda.",
        },
      ],
    });
  }
}

/**
 * Ownership check for supplier-only actions on a specific record.
 *
 * Throws NOT_FOUND rather than FORBIDDEN_ROLE on purpose: telling a supplier
 * that a Serial Number exists but belongs to someone else leaks its existence.
 */
export function assertOwnership(
  actor: Actor,
  record: { submittedById: bigint },
): void {
  if (actor.role !== "supplier") return;
  if (record.submittedById !== actor.id) throw new AppError("NOT_FOUND");
}

/** Convenience used by the inspection list to explain why a plate is blocked. */
export function statusBlocksNewInspection(status: InspectionStatus): boolean {
  return isLockingStatus(status);
}
