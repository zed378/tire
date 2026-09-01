import type { InspectionStatus, QcDecision, UserRole } from "./constants.ts";

/**
 * The inspection status machine (PLAN/03 §7).
 *
 * Shared between client and server so a button is never offered for a transition
 * the server will refuse. The server still checks: this table is the definition,
 * and `transitionInspection()` on the API side is the only code allowed to act
 * on it.
 *
 * Transitions that are deliberately absent are as much a part of the design as
 * the ones present:
 *
 *  - `dropped_qc -> anything`. Rejected means finished. A supplier who wants to
 *    try again creates a NEW inspection, which `uq_locking_inspection` permits
 *    because that index excludes `dropped_qc`.
 *  - `passed_qc -> dropped_qc` directly. Reversing a decision must return to
 *    `pending_qc` first, so it is recorded as two separate events in the
 *    history rather than one silent overwrite.
 *  - `anything -> draft`. A draft only exists before the first submission.
 */

export interface Transition {
  from: InspectionStatus;
  to: InspectionStatus;
  /** What the UI calls this action. */
  label: string;
  roles: readonly UserRole[];
  /** True when only the supplier who created it may do this. */
  ownerOnly: boolean;
}

export const TRANSITIONS: readonly Transition[] = [
  {
    from: "draft",
    to: "pending_qc",
    label: "Kirim Pengajuan",
    roles: ["supplier"],
    ownerOnly: true,
  },
  {
    from: "pending_qc",
    to: "passed_qc",
    label: "Pass QC",
    roles: ["admin"],
    ownerOnly: false,
  },
  {
    from: "pending_qc",
    to: "needs_revision",
    label: "Kembalikan untuk Revisi",
    roles: ["admin"],
    ownerOnly: false,
  },
  {
    from: "pending_qc",
    to: "dropped_qc",
    label: "Drop QC",
    roles: ["admin"],
    ownerOnly: false,
  },
  {
    from: "needs_revision",
    to: "pending_qc",
    label: "Kirim Ulang",
    roles: ["supplier"],
    ownerOnly: true,
  },
  {
    from: "passed_qc",
    to: "pending_qc",
    label: "Batalkan Keputusan QC",
    roles: ["admin"],
    ownerOnly: false,
  },
];

export function isValidTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function transitionsFrom(status: InspectionStatus): readonly Transition[] {
  return TRANSITIONS.filter((t) => t.from === status);
}

export function transitionsFor(status: InspectionStatus, role: UserRole): readonly Transition[] {
  return TRANSITIONS.filter((t) => t.from === status && t.roles.includes(role));
}

/** Maps a QC decision onto the status it produces. */
export const DECISION_TO_STATUS: Record<QcDecision, InspectionStatus> = {
  pass: "passed_qc",
  drop: "dropped_qc",
  revision: "needs_revision",
};

/** Statuses from which no transition leads anywhere. */
export function isFinal(status: InspectionStatus): boolean {
  return transitionsFrom(status).length === 0;
}
