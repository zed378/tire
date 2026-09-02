import { describe, expect, it } from "vitest";
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_LABELS,
  isLockingStatus,
  LOCKING_STATUSES,
  MFA_RECOVERY_CODE_COUNT,
  PRESIGN_TTL_SECONDS,
  QC_DECISIONS,
  QC_DECISION_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
} from "./constants.ts";

/**
 * Values PLAN states as numbers, and the label maps that must stay complete.
 *
 * This file previously tested a `VALID_TRANSITIONS` export that does not exist:
 * the transition table lives in `status-machine.ts` as `TRANSITIONS`, and
 * `status-machine.test.ts` already covers it against PLAN/03 §7.1. That import
 * failed to compile, so `pnpm verify` could not get past typecheck — and the
 * duplicated coverage would not have been worth having even if it had.
 */

describe("PLAN-stated constants", () => {
  it("presigns an upload URL for ten minutes (PLAN/05 §7)", () => {
    expect(PRESIGN_TTL_SECONDS).toBe(600);
  });

  it("issues ten MFA recovery codes (PLAN/13 §2)", () => {
    expect(MFA_RECOVERY_CODE_COUNT).toBe(10);
  });
});

describe("label maps cover every value", () => {
  // A missing label renders as `undefined` in the interface rather than
  // failing, so completeness is asserted here instead of being noticed by a
  // field user (K-10).
  it("labels every inspection status", () => {
    for (const status of INSPECTION_STATUSES) {
      expect(INSPECTION_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(Object.keys(INSPECTION_STATUS_LABELS)).toHaveLength(INSPECTION_STATUSES.length);
  });

  it("labels every user role", () => {
    for (const role of USER_ROLES) {
      expect(USER_ROLE_LABELS[role]).toBeTruthy();
    }
    expect(Object.keys(USER_ROLE_LABELS)).toHaveLength(USER_ROLES.length);
  });

  it("labels every QC decision", () => {
    for (const decision of QC_DECISIONS) {
      expect(QC_DECISION_LABELS[decision]).toBeTruthy();
    }
    expect(Object.keys(QC_DECISION_LABELS)).toHaveLength(QC_DECISIONS.length);
  });
});

describe("isLockingStatus", () => {
  it("is true for exactly the locking statuses (PLAN/03 §6)", () => {
    for (const status of INSPECTION_STATUSES) {
      const expected = (LOCKING_STATUSES as readonly string[]).includes(status);
      expect(isLockingStatus(status)).toBe(expected);
    }
  });
});
