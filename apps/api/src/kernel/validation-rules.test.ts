/**
 * Tests for V-08, V-11, V-12, and V-13 (PLAN/03 §4) — the rules that live on the
 * server side of the split.
 *
 * Gate G-04 counts these `describe` titles against the rule table in PLAN/03.
 * Together with the axle rules in packages/contracts, every numbered rule in the
 * document has a test that names it. That accounting is the direct answer to
 * D-04: a rule nobody wrote never failed, was never logged, and was never seen.
 */

import { describe, expect, it } from "vitest";
import {
  checkPhotoQuota,
  INSPECTION_STATUSES,
  isLockingStatus,
  LOCKING_STATUSES,
  MAX_PHOTOS_PER_INSPECTION,
  MAX_PHOTOS_PER_SLOT,
  validateCityInProvince,
} from "@c26/contracts";
import { assertCityInScope, statusBlocksNewInspection, type Actor } from "./authorization.ts";
import { AppError } from "./envelope/index.ts";

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  id: 1n,
  username: "supplier1",
  displayName: "Supplier Satu",
  role: "supplier",
  sessionId: "session",
  elevatedUntil: null,
  provinceIds: [],
  cityIds: [],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-08: a vehicle with a locking inspection cannot start another", () => {
  it.each(["pending_qc", "needs_revision", "passed_qc"] as const)("locks on %s", (status) => {
    expect(isLockingStatus(status)).toBe(true);
    expect(statusBlocksNewInspection(status)).toBe(true);
  });

  it("releases the lock on dropped_qc", () => {
    // Rejected means finished. A supplier who wants to try again creates a NEW
    // inspection, and `uq_locking_inspection` permits it because that index
    // excludes dropped_qc (PLAN/11 §5.4).
    expect(isLockingStatus("dropped_qc")).toBe(false);
  });

  it("does not lock on draft", () => {
    // PLAN/11 §5.6. A locking draft would hold a plate hostage forever, and
    // drafts are abandoned constantly in field work — a dropped signal, a flat
    // battery, a job handed to somebody else. V-08 is checked on the submit
    // transition instead.
    expect(isLockingStatus("draft")).toBe(false);
  });

  it("locks on needs_revision on purpose, not by oversight", () => {
    // If it did not lock, a supplier would start a fresh record rather than fix
    // the old one. The old record would hang in needs_revision forever, QC would
    // see a doubled queue, and the revision flow would go unused — D-11 back in
    // a new form (PLAN/11 §5.5).
    expect(isLockingStatus("needs_revision")).toBe(true);
  });

  it("covers exactly three of the five statuses", () => {
    const locking = INSPECTION_STATUSES.filter(isLockingStatus);
    expect(locking).toEqual([...LOCKING_STATUSES]);
    expect(locking).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-11: the chosen city must belong to the chosen province", () => {
  const cities = [
    { id: 1, provinceId: 10 },
    { id: 2, provinceId: 10 },
    { id: 3, provinceId: 20 },
  ];

  it("accepts a city inside the chosen province", () => {
    expect(validateCityInProvince(cities, 1, 10)).toEqual([]);
  });

  it("rejects a city from a different province", () => {
    const errors = validateCityInProvince(cities, 3, 10);
    expect(errors.map((e) => e.field)).toContain("cityId");
  });

  it("rejects a city that does not exist", () => {
    expect(validateCityInProvince(cities, 99, 10)).toHaveLength(1);
  });

  it("requires a province before a city", () => {
    expect(validateCityInProvince(cities, 1, null).map((e) => e.field)).toEqual(["provinceId"]);
  });

  it("requires a city once a province is chosen", () => {
    expect(validateCityInProvince(cities, null, 10).map((e) => e.field)).toEqual(["cityId"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-12: a supplier may only work in the regions assigned to them", () => {
  it("allows any city when no region is assigned", () => {
    // No rows at all means no restriction (PLAN/04 §3). This is the default, and
    // it must stay permissive — otherwise creating a supplier without regions
    // would silently produce an account that can do nothing.
    expect(() => assertCityInScope(actor(), { id: 5n, provinceId: 10n })).not.toThrow();
  });

  it("allows a city inside an assigned province", () => {
    expect(() =>
      assertCityInScope(actor({ provinceIds: [10n] }), { id: 5n, provinceId: 10n }),
    ).not.toThrow();
  });

  it("rejects a city outside every assigned province", () => {
    expect(() =>
      assertCityInScope(actor({ provinceIds: [10n] }), { id: 5n, provinceId: 20n }),
    ).toThrow(AppError);
  });

  it("allows a directly assigned city", () => {
    expect(() =>
      assertCityInScope(actor({ cityIds: [5n] }), { id: 5n, provinceId: 20n }),
    ).not.toThrow();
  });

  it("treats province and city assignments as a union, not an intersection", () => {
    const supplier = actor({ provinceIds: [10n], cityIds: [99n] });
    expect(() => assertCityInScope(supplier, { id: 5n, provinceId: 10n })).not.toThrow();
    expect(() => assertCityInScope(supplier, { id: 99n, provinceId: 30n })).not.toThrow();
    expect(() => assertCityInScope(supplier, { id: 7n, provinceId: 30n })).toThrow(AppError);
  });

  it("attaches the error to the cityId field so it renders inline", () => {
    try {
      assertCityInScope(actor({ cityIds: [1n] }), { id: 5n, provinceId: 20n });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).fieldErrors[0]?.field).toBe("cityId");
    }
  });

  it.each(["admin", "manager", "operator"] as const)("does not restrict %s", (role) => {
    expect(() =>
      assertCityInScope(actor({ role, cityIds: [1n] }), { id: 5n, provinceId: 20n }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-13: at most 10 photos per slot, and 30 per inspection", () => {
  it("allows an upload below both caps", () => {
    expect(checkPhotoQuota({ slotCount: 9, inspectionCount: 20 })).toBeNull();
  });

  it("rejects the eleventh photo in one slot", () => {
    const violation = checkPhotoQuota({ slotCount: MAX_PHOTOS_PER_SLOT, inspectionCount: 12 });
    expect(violation?.code).toBe("PHOTO_LIMIT_EXCEEDED");
    expect(violation?.message).toContain("per slot");
  });

  it("rejects the thirty-first photo in one inspection", () => {
    // New in the rewrite (PLAN/06 §6). Ten per slot restrains nothing once a
    // 6-axle vehicle has 22 positions: 84 GB a year versus 562 GB.
    const violation = checkPhotoQuota({
      slotCount: 1,
      inspectionCount: MAX_PHOTOS_PER_INSPECTION,
    });
    expect(violation?.message).toContain("per pengajuan");
  });

  it("reports the slot cap first when both are exceeded", () => {
    const violation = checkPhotoQuota({
      slotCount: MAX_PHOTOS_PER_SLOT,
      inspectionCount: MAX_PHOTOS_PER_INSPECTION,
    });
    expect(violation?.message).toContain("per slot");
  });

  it("keeps the caps at the documented values", () => {
    expect(MAX_PHOTOS_PER_SLOT).toBe(10);
    expect(MAX_PHOTOS_PER_INSPECTION).toBe(30);
  });
});
