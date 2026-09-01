import {
  DECISION_TO_STATUS,
  type Paginated,
  type QcDecisionInput,
  type QcQueueQuery,
  type QcReviewRecord,
  type QcStats,
  type InspectionListItem,
} from "@c26/contracts";
import type { AuditActor } from "../../kernel/audit.ts";
import type { Actor } from "../../kernel/authorization.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import { assertRevertAllowed, listInspections, transitionInspection } from "../inspections/index.ts";

/**
 * Quality control (PLAN/03 §7, PLAN/08 F4).
 *
 * Three defects converge here:
 *   D-01 — the filters never reached the data; a 2020 date range still returned
 *          a 2026 record and the counters never moved
 *   D-02 — a card titled "Riwayat" that contained no history, only a filter and
 *          three numbers
 *   D-11 — pass or drop and nothing in between, so one blurred photo sank an
 *          entire submission and the supplier started from zero
 */

/**
 * The work queue that was missing (D-02).
 *
 * It reuses `listInspections` rather than writing a second query: the scope
 * rules live in one place, and a second copy is where an authorisation leak
 * would eventually appear (PLAN/04 §2.2).
 */
export async function getQueue(
  actor: Actor,
  query: QcQueueQuery,
): Promise<Paginated<InspectionListItem>> {
  return listInspections(actor, {
    ...query,
    // Default view is the work waiting to be done, not everything ever recorded.
    status: query.status ?? ["pending_qc"],
    sort: "submitted_asc",
  });
}

/**
 * The three counters above the queue.
 *
 * They answer the same filter as the table below them. In the legacy system they
 * did not: the numbers stayed at 1/0/1 no matter what was selected, which is how
 * D-01 was found.
 */
export async function getStats(query: QcQueueQuery): Promise<QcStats> {
  const where = {
    deletedAt: null,
    ...(query.submittedFrom !== undefined || query.submittedTo !== undefined
      ? {
          submittedAt: {
            ...(query.submittedFrom !== undefined ? { gte: new Date(query.submittedFrom) } : {}),
            ...(query.submittedTo !== undefined ? { lte: new Date(query.submittedTo) } : {}),
          },
        }
      : {}),
    ...(query.cityId !== undefined || query.provinceId !== undefined
      ? {
          vehicle: {
            ...(query.cityId !== undefined ? { cityId: BigInt(query.cityId) } : {}),
            ...(query.provinceId !== undefined
              ? { city: { provinceId: BigInt(query.provinceId) } }
              : {}),
          },
        }
      : {}),
  };

  const grouped = await getPrisma().inspection.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const countOf = (status: string): number =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;

  return {
    pending: countOf("pending_qc"),
    passed: countOf("passed_qc"),
    dropped: countOf("dropped_qc"),
    needsRevision: countOf("needs_revision"),
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
  };
}

export async function decide(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  input: QcDecisionInput,
): Promise<{ status: string; reviewId: number | null }> {
  return withTransaction(async (tx) => {
    const inspection = await tx.inspection.findFirst({
      where: { serialNumber, deletedAt: null },
      select: { id: true },
    });
    if (inspection === null) throw new AppError("NOT_FOUND");

    const result = await transitionInspection(tx, actor, auditActor, {
      inspectionId: inspection.id,
      to: DECISION_TO_STATUS[input.decision],
      decision: input.decision,
      notes: input.notes,
      expectedStatus: input.expectedStatus,
    });

    // Per-photo comments. A supplier told "foto buram" with no indication of
    // which photo is barely better off than one told nothing.
    if (input.comments !== undefined && input.comments.length > 0 && result.reviewId !== null) {
      await tx.qcComment.createMany({
        data: input.comments.map((comment) => ({
          reviewId: result.reviewId as bigint,
          photoId: comment.photoId === undefined ? null : BigInt(comment.photoId),
          tirePositionId:
            comment.tirePositionId === undefined ? null : BigInt(comment.tirePositionId),
          body: comment.body,
        })),
      });
    }

    return { status: result.to, reviewId: result.reviewId === null ? null : Number(result.reviewId) };
  });
}

/**
 * Reverting a decision — new in the rewrite.
 *
 * Back to `pending_qc` only, and only while no tire specification has been
 * entered. It is recorded as its own event, so the trail shows a decision and
 * then its reversal rather than a status that quietly changed its mind.
 */
export async function revert(
  actor: Actor,
  auditActor: AuditActor,
  serialNumber: string,
  reason: string,
): Promise<{ status: string }> {
  return withTransaction(async (tx) => {
    const inspection = await tx.inspection.findFirst({
      where: { serialNumber, deletedAt: null },
      select: { id: true },
    });
    if (inspection === null) throw new AppError("NOT_FOUND");

    await assertRevertAllowed(tx, inspection.id);

    const result = await transitionInspection(tx, actor, auditActor, {
      inspectionId: inspection.id,
      to: "pending_qc",
      notes: reason,
    });

    return { status: result.to };
  });
}

export async function getReviewHistory(
  actor: Actor,
  serialNumber: string,
): Promise<QcReviewRecord[]> {
  const prisma = getPrisma();

  const inspection = await prisma.inspection.findFirst({
    where: { serialNumber, deletedAt: null },
    select: { id: true, submittedById: true },
  });
  if (inspection === null) throw new AppError("NOT_FOUND");

  // A supplier reads the reasons on their own inspection — that is the point of
  // closing D-11 — but never the identity of the reviewing admin (PLAN/03 §8).
  const isOwner = inspection.submittedById === actor.id;
  if (actor.role === "supplier" && !isOwner) throw new AppError("NOT_FOUND");

  const reviews = await prisma.qcReview.findMany({
    where: { inspectionId: inspection.id },
    orderBy: { reviewedAt: "desc" },
    include: {
      reviewer: { select: { displayName: true } },
      comments: {
        include: { tirePosition: { select: { positionLabel: true } } },
      },
    },
  });

  return reviews.map((review) => ({
    id: Number(review.id),
    decision: review.decision,
    statusBefore: review.statusBefore,
    statusAfter: review.statusAfter,
    notes: review.notes,
    reviewerName: actor.role === "supplier" ? "Tim Quality Control" : review.reviewer.displayName,
    reviewedAt: review.reviewedAt.toISOString(),
    comments: review.comments.map((comment) => ({
      id: Number(comment.id),
      photoId: comment.photoId === null ? null : Number(comment.photoId),
      tirePositionId: comment.tirePositionId === null ? null : Number(comment.tirePositionId),
      tirePositionLabel: comment.tirePosition?.positionLabel ?? null,
      body: comment.body,
    })),
  }));
}
