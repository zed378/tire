import type { UserRole } from "@c26/contracts";
import type { Tx } from "./db.ts";

/**
 * The audit trail (PLAN/04 §6) — closes D-15 and B-12.
 *
 * Sheets version history is not an audit trail. It cannot answer the question
 * that actually matters when a QC decision is disputed months later: who changed
 * this, when, from what to what, and on what grounds.
 *
 * Four rules govern every call here:
 *
 *  1. Written in the SAME transaction as the change. Not after the commit, not
 *     as a job. A change that succeeds without a trail is a bug, so `tx` is a
 *     required parameter and there is no variant that takes the global client.
 *  2. `before` and `after` carry only the columns that changed.
 *  3. Password hashes, tokens, and TOTP secrets never appear — not even hashed.
 *  4. The table is append-only; the privilege is revoked at the database level
 *     (PLAN/13 §9), so there is no update or delete function in this file to
 *     find and misuse.
 */

/** Fields that must never be written, whatever a caller passes. */
const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "newPassword",
  "currentPassword",
  "temporaryPassword",
  "token",
  "tokenHash",
  "token_hash",
  "csrfToken",
  "csrf_token",
  "secretEnc",
  "secret_enc",
  "codeHash",
  "code_hash",
  "recoveryCodes",
]);

export type AuditAction =
  | "inspection.created"
  | "inspection.submitted"
  | "inspection.status_changed"
  | "inspection.deleted"
  | "inspection.draft_expired"
  | "vehicle.created"
  | "vehicle.updated"
  | "vehicle.plate_changed"
  | "vehicle.flagged_for_review"
  | "qc.decided"
  | "qc.reverted"
  | "tirespec.updated"
  | "photo.uploaded"
  | "photo.deleted"
  | "user.created"
  | "user.updated"
  | "user.role_changed"
  | "user.password_reset"
  | "user.password_changed"
  | "user.deactivated"
  | "user.deleted"
  | "masterdata.created"
  | "masterdata.updated"
  | "masterdata.deactivated"
  | "auth.login_succeeded"
  | "auth.login_failed"
  | "auth.locked"
  | "auth.sessions_revoked"
  | "auth.mfa_enrolled"
  | "auth.mfa_reset"
  | "auth.recovery_code_used"
  | "auth.step_up_succeeded"
  | "auth.step_up_failed"
  | "ops.job_retried"
  | "ops.job_cancelled"
  | "ops.orphans_cleaned";

export interface AuditActor {
  id: bigint | null;
  role: UserRole | null;
  requestId: string;
  ipAddress: string | null;
}

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId: bigint | number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

function sanitize(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;

  const clean: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    // BigInt is not JSON-serialisable, and every id in this schema is one.
    clean[key] = typeof entry === "bigint" ? entry.toString() : entry;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

/**
 * Reduces a before/after pair to only the keys whose values differ.
 *
 * PLAN/04 §6.2 rule 2. Storing the whole row on every edit makes the trail
 * unreadable at exactly the moment somebody needs to read it.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};

  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const previous = before[key];
    const isSame =
      previous instanceof Date && next instanceof Date
        ? previous.getTime() === next.getTime()
        : previous === next;
    if (isSame) continue;
    beforeDiff[key] = previous;
    afterDiff[key] = next;
  }

  return { before: beforeDiff, after: afterDiff };
}

export async function recordAudit(tx: Tx, actor: AuditActor, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      actorRole: actor.role,
      action: input.action,
      entity: input.entity,
      entityId: BigInt(input.entityId),
      before: sanitize(input.before) ?? undefined,
      after: sanitize(input.after) ?? undefined,
      requestId: actor.requestId,
      ipAddress: actor.ipAddress,
    },
  });
}
