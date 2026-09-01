/**
 * Authorisation layers 2 and 3 (PLAN/04 §2.2).
 *
 * The legacy system restricted access by not rendering a menu, which is a good
 * UI decision and no enforcement at all: a direct call to the server walked
 * straight past it. These tests cover what actually holds.
 */

import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES } from "@c26/contracts";
import {
  assertOwnership,
  hasPermission,
  inspectionScope,
  requirePermission,
  vehicleScope,
  type Actor,
} from "./authorization.ts";
import { AppError } from "./envelope/index.ts";

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  id: 1n,
  username: "user1",
  displayName: "User Satu",
  role: "supplier",
  sessionId: "session",
  elevatedUntil: null,
  provinceIds: [],
  cityIds: [],
  ...overrides,
});

describe("PLAN/04 §2.1 — the permission matrix", () => {
  it("gives an operator no QC or tire-spec permission", () => {
    // Not an oversight but the whole point of the role split (PLAN/10 §2.1). An
    // operator maintains the system; they do not make business decisions inside
    // it. If they could change a QC decision, the audit trail would stop being
    // evidence — and evidence is why D-15 is being fixed.
    expect(hasPermission(actor({ role: "operator" }), "qc.review")).toBe(false);
    expect(hasPermission(actor({ role: "operator" }), "qc.revert")).toBe(false);
    expect(hasPermission(actor({ role: "operator" }), "tirespec.write")).toBe(false);
  });

  it("gives a manager the export permission", () => {
    // D-14: in the legacy system the one role whose entire job was reporting was
    // also the only one that could not export anything.
    expect(hasPermission(actor({ role: "manager" }), "report.export")).toBe(true);
  });

  it("gives a supplier no access to another supplier's data", () => {
    expect(hasPermission(actor({ role: "supplier" }), "submission.read.all")).toBe(false);
  });

  it("gives only admin and operator the ability to manage users", () => {
    const canManage = USER_ROLES.filter((role) => hasPermission(actor({ role }), "user.manage"));
    expect(canManage.sort()).toEqual(["admin", "operator"]);
  });

  it("gives only an operator the ops permissions", () => {
    for (const permission of PERMISSIONS.filter((p) => p.startsWith("ops."))) {
      const roles = USER_ROLES.filter((role) => ROLE_PERMISSIONS[role].includes(permission));
      expect(roles).toEqual(["operator"]);
    }
  });

  it("throws FORBIDDEN_ROLE rather than returning false silently", () => {
    expect(() => requirePermission(actor({ role: "supplier" }), "qc.review")).toThrow(AppError);
  });
});

describe("PLAN/13 §4 — step-up on dangerous actions", () => {
  it("refuses user management on a session that has not re-verified", () => {
    // A 12-hour session means an unlocked phone left in a garage grants twelve
    // hours of access. For a handful of actions that is too loose.
    try {
      requirePermission(actor({ role: "admin" }), "user.manage");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("STEP_UP_REQUIRED");
    }
  });

  it("allows it while the elevation window is open", () => {
    const elevated = actor({ role: "admin", elevatedUntil: new Date(Date.now() + 60_000) });
    expect(() => requirePermission(elevated, "user.manage")).not.toThrow();
  });

  it("refuses it again once the window has passed", () => {
    const expired = actor({ role: "admin", elevatedUntil: new Date(Date.now() - 1000) });
    expect(() => requirePermission(expired, "user.manage")).toThrow(AppError);
  });

  it("does not demand step-up for a QC decision", () => {
    // Deliberately absent from the list: QC decisions happen too often, and the
    // friction would exceed the protection (PLAN/13 §4).
    expect(() => requirePermission(actor({ role: "admin" }), "qc.review")).not.toThrow();
  });
});

describe("PLAN/04 §2.2 — layer 3, data scope", () => {
  it("restricts a supplier to their own inspections", () => {
    expect(inspectionScope(actor({ role: "supplier", id: 42n }))).toEqual({
      deletedAt: null,
      submittedById: 42n,
    });
  });

  it("gives an admin every non-deleted inspection", () => {
    expect(inspectionScope(actor({ role: "admin" }))).toEqual({ deletedAt: null });
  });

  it("restricts a manager to finished work", () => {
    // Reporting has no business reading drafts or a pending queue.
    expect(inspectionScope(actor({ role: "manager" }))).toEqual({
      deletedAt: null,
      status: "passed_qc",
    });
  });

  it("refuses an operator any business data at all", () => {
    expect(() => inspectionScope(actor({ role: "operator" }))).toThrow(AppError);
    expect(() => vehicleScope(actor({ role: "operator" }))).toThrow(AppError);
  });

  it("restricts vehicle visibility for a supplier", () => {
    // PLAN/11 §6 rule 3. If every supplier could browse the fleet by plate, the
    // system would become a directory of the customer's vehicles.
    expect(vehicleScope(actor({ role: "supplier", id: 7n }))).toEqual({
      deletedAt: null,
      createdById: 7n,
    });
  });
});

describe("PLAN/04 §2.2 — a record out of scope answers NOT_FOUND", () => {
  it("throws NOT_FOUND, not FORBIDDEN, for another supplier's record", () => {
    // Answering "this exists but you may not see it" leaks the existence of
    // another supplier's Serial Number.
    try {
      assertOwnership(actor({ role: "supplier", id: 1n }), { submittedById: 2n });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("passes for the owner", () => {
    expect(() => assertOwnership(actor({ id: 1n }), { submittedById: 1n })).not.toThrow();
  });

  it("does not apply ownership rules to an admin", () => {
    expect(() => assertOwnership(actor({ role: "admin" }), { submittedById: 999n })).not.toThrow();
  });
});
