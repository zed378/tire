import {
  DECISION_TO_STATUS,
  isValidTransition,
  transitionsFor,
  type InspectionStatus,
  type QcDecision,
} from "@c26/contracts";
import { recordAudit, type AuditActor } from "../../kernel/audit.ts";
import type { Actor } from "../../kernel/authorization.ts";
import type { Tx } from "../../kernel/db.ts";
import { AppError, invalidTransition } from "../../kernel/envelope/index.ts";
import { publishEvent } from "../../kernel/outbox.ts";

/**
 * THE ONLY PLACE AN INSPECTION'S STATUS CHANGES (PLAN/03 §7.2 rule 1).
 *
 * There is no `UPDATE inspections SET status = ...` anywhere else in the
 * codebase, and ESLint's `no-restricted-syntax` rule enforces that by rejecting
 * any Prisma update whose data object carries a `status` key outside this file.
 *
 * Four things happen here, in one transaction, always:
 *   1. the transition is checked against the table
 *   2. the actor's authority is checked
 *   3. the row is updated under a lock
 *   4. a qc_reviews row, an audit entry, and an outbox event are written
 *
 * Doing any one of them elsewhere is how a status column ends up with no history
 * behind it — which is exactly what the legacy system had.
 */

export interface TransitionInput {
  inspectionId: bigint;
  to: InspectionStatus;
  decision?: QcDecision;
  notes?: string;
  /** Optimistic concurrency: what the client believed the status was. */
  expectedStatus?: InspectionStatus;
}

export interface TransitionResult {
  from: InspectionStatus;
  to: InspectionStatus;
  reviewId: bigint | null;
}

/**
 * Outbox events emitted per resulting status (PLAN/12 §5).
 * `null` means the change is real but nobody needs to be interrupted by it.
 */
function eventFor(to: InspectionStatus, from: InspectionStatus): string | null {
  if (to === "pending_qc") {
    return from === "needs_revision" ? "inspection.resubmitted" : "inspection.submitted";
  }
  if (to === "passed_qc") return "inspection.passed_qc";
  if (to === "dropped_qc") return "inspection.dropped_qc";
  if (to === "needs_revision") return "inspection.needs_revision";
  return null;
}

export async function transitionInspection(
  tx: Tx,
  actor: Actor,
  auditActor: AuditActor,
  input: TransitionInput,
): Promise<TransitionResult> {
  /**
   * SELECT ... FOR UPDATE before anything else (PLAN/03 §7.2 rule 4).
   *
   * Two admins pressing a decision at the same moment must not produce two
   * qc_reviews rows carrying the same `status_before`. The row lock makes the
   * second one read the first one's result.
   */
  const locked = await tx.$queryRaw<{ id: bigint; status: InspectionStatus; submitted_by: bigint }[]>`
    SELECT id, status, submitted_by
      FROM inspections
     WHERE id = ${input.inspectionId} AND deleted_at IS NULL
     FOR UPDATE
  `;

  const current = locked[0];
  if (current === undefined) throw new AppError("NOT_FOUND");

  const from = current.status;

  // The client rendered its buttons against a status it read earlier. If that
  // has moved on, say so rather than silently applying a decision to a different
  // situation than the reviewer was looking at.
  if (input.expectedStatus !== undefined && input.expectedStatus !== from) {
    throw new AppError("CONCURRENT_MODIFICATION", {
      message: `Status pengajuan sudah berubah menjadi "${from}" sejak halaman ini dimuat. Muat ulang untuk melihat kondisi terbaru.`,
      context: { expected: input.expectedStatus, actual: from },
    });
  }

  // Rule 3: an illegal transition answers 409, it does not quietly do nothing.
  // Doing nothing is what the legacy system did — clicking Submit Keputusan QC
  // with no status selected left no trace anywhere.
  if (!isValidTransition(from, input.to)) throw invalidTransition(from, input.to);

  const allowed = transitionsFor(from, actor.role).some((t) => t.to === input.to);
  if (!allowed) throw new AppError("FORBIDDEN_ROLE");

  const transition = transitionsFor(from, actor.role).find((t) => t.to === input.to);
  if (transition?.ownerOnly === true && current.submitted_by !== actor.id) {
    // NOT_FOUND rather than FORBIDDEN, so the existence of another supplier's
    // inspection is not confirmed (PLAN/04 §2.2).
    throw new AppError("NOT_FOUND");
  }

  const now = new Date();
  await tx.inspection.update({
    where: { id: input.inspectionId },
    data: {
      status: input.to,
      // ck_submitted_at ties this to the status: only a draft has a null
      // submitted_at, and it stops being null the moment it leaves draft.
      ...(from === "draft" ? { submittedAt: now } : {}),
    },
  });

  let reviewId: bigint | null = null;

  // A QC decision is a history row, not an overwritten column. The legacy system
  // kept `Nama Admin QC` on the record, so a second decision erased the first and
  // nobody could tell there had been one.
  if (input.decision !== undefined) {
    if (DECISION_TO_STATUS[input.decision] !== input.to) {
      throw new AppError("BAD_REQUEST", {
        message: "Keputusan QC tidak sesuai dengan status tujuan.",
      });
    }

    const review = await tx.qcReview.create({
      data: {
        inspectionId: input.inspectionId,
        reviewerId: actor.id,
        decision: input.decision,
        statusBefore: from,
        statusAfter: input.to,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });
    reviewId = review.id;
  }

  await recordAudit(tx, auditActor, {
    action: from === "draft" ? "inspection.submitted" : "inspection.status_changed",
    entity: "inspection",
    entityId: input.inspectionId,
    before: { status: from },
    after: { status: input.to, decision: input.decision ?? null },
  });

  const eventType = eventFor(input.to, from);
  if (eventType !== null) {
    // In the same transaction. If this rolls back, the notification goes with
    // it — a notification about something that did not happen becomes
    // impossible rather than rare (PLAN/12 §2.1).
    /*
     * The payload has to carry everything the notification will need, because
     * nothing downstream can go and look it up.
     *
     * It used to carry only the id and the two statuses. Every template in
     * `NOTIFICATION_TEMPLATES` interpolates `serialNumber`, `plateDisplay` and —
     * for a submission — `supplierName`, so `renderTemplate` substituted empty
     * strings and an admin read "() dari  masuk antrean QC.". `linkFor` reads
     * `serialNumber` too, so the notification also led nowhere: no link, nothing
     * to click, no way to reach the inspection it was about.
     *
     * Read inside the transaction and inside the lock, so the values recorded
     * are the ones that were true at the moment of the transition. A notification
     * describes an event, not the present.
     */
    const context = await tx.inspection.findUnique({
      where: { id: input.inspectionId },
      select: {
        serialNumber: true,
        vehicle: { select: { plateDisplay: true } },
        submittedBy: { select: { displayName: true } },
      },
    });

    await publishEvent(tx, { id: actor.id, requestId: auditActor.requestId }, {
      type: eventType as Parameters<typeof publishEvent>[2]["type"],
      aggregateId: input.inspectionId,
      payload: {
        inspectionId: input.inspectionId.toString(),
        serialNumber: context?.serialNumber ?? "",
        plateDisplay: context?.vehicle.plateDisplay ?? "",
        supplierName: context?.submittedBy.displayName ?? "",
        statusBefore: from,
        statusAfter: input.to,
        notes: input.notes ?? null,
      },
    });
  }

  return { from, to: input.to, reviewId };
}

/**
 * Reverting a QC decision (PLAN/03 §7.1).
 *
 * Only back to `pending_qc`, and only while no tire specification has been
 * filled in. Going straight from `passed_qc` to `dropped_qc` is not offered on
 * purpose: reversal must be recorded as two separate events, not one silent
 * correction.
 */
export async function assertRevertAllowed(tx: Tx, inspectionId: bigint): Promise<void> {
  const filled = await tx.tireSpec.count({
    where: {
      tirePosition: { inspectionId },
      OR: [{ pattern: { not: null } }, { size: { not: null } }, { tireBrandId: { not: null } }],
    },
  });

  if (filled > 0) {
    throw new AppError("INVALID_STATE_TRANSITION", {
      message:
        "Keputusan QC tidak dapat dibatalkan karena spesifikasi ban sudah mulai diisi. Kosongkan spesifikasi terlebih dahulu.",
      context: { filledSpecs: filled },
    });
  }
}
