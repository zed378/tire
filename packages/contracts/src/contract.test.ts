import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  checkPhotoQuota,
  ERROR_CODES,
  ERROR_DEFINITIONS,
  EVENT_TYPES,
  fieldErrorFor,
  formatSerialNumber,
  httpStatusFor,
  isErrorEnvelope,
  isLockingStatus,
  MAX_PHOTOS_PER_INSPECTION,
  MAX_PHOTOS_PER_SLOT,
  NOTIFICATION_TEMPLATES,
  PERMISSIONS,
  permissionsFor,
  renderTemplate,
  requiresStepUp,
  ROLE_PERMISSIONS,
  roleHasPermission,
  SERIAL_SEQUENCE_DIGITS,
  UNMUTABLE_EVENT_TYPES,
  USER_ROLES,
  validateCityInProvince,
} from "./index.ts";

/**
 * The contract itself: the error table, the permission matrix, the storage key
 * layout, and the notification catalogue.
 *
 * These are shared by both sides, so a mistake here is a mistake in two places
 * at once — which is precisely why they live in one package.
 */

describe("PLAN/05 §3 — the error table", () => {
  it("maps every code to the documented HTTP status", () => {
    expect(httpStatusFor("VALIDATION_ERROR")).toBe(422);
    expect(httpStatusFor("FORBIDDEN_ROLE")).toBe(403);
    expect(httpStatusFor("ACCOUNT_LOCKED")).toBe(423);
    expect(httpStatusFor("DUPLICATE_PLATE")).toBe(409);
    expect(httpStatusFor("SERVICE_UNAVAILABLE")).toBe(503);
  });

  it("answers 404, not 403, for a resource outside the caller's scope", () => {
    // Answering "this exists but you may not see it" leaks the existence of
    // another supplier's Serial Number (PLAN/04 §2.2).
    expect(httpStatusFor("NOT_FOUND")).toBe(404);
  });

  it("gives every code an Indonesian message ready to display", () => {
    // K-10, and the reason D-07 exists: the legacy form produced English browser
    // tooltips in an Indonesian interface.
    for (const code of ERROR_CODES) {
      const definition = ERROR_DEFINITIONS[code];
      expect(definition.message.length).toBeGreaterThan(10);
      expect(definition.message).not.toMatch(/please|invalid input|error occurred/i);
    }
  });

  it("uses one identical message for every login failure", () => {
    // PLAN/04 §4.3: distinguishing unknown username from wrong password tells an
    // attacker which usernames exist.
    expect(ERROR_DEFINITIONS.INVALID_CREDENTIALS.message).toBe("User ID atau Password salah.");
  });

  it("routes each code to the right display channel", () => {
    expect(ERROR_DEFINITIONS.VALIDATION_ERROR.channel).toBe("inline");
    expect(ERROR_DEFINITIONS.DUPLICATE_PLATE.channel).toBe("inline");
    expect(ERROR_DEFINITIONS.INVALID_CREDENTIALS.channel).toBe("banner-login");
    expect(ERROR_DEFINITIONS.INTERNAL_ERROR.channel).toBe("banner");
  });
});

describe("PLAN/05 §2 — the envelope", () => {
  it("distinguishes the two shapes", () => {
    expect(isErrorEnvelope({ ok: true, data: 1, requestId: "r" })).toBe(false);
    expect(
      isErrorEnvelope({ ok: false, code: "NOT_FOUND", message: "x", requestId: "r" }),
    ).toBe(true);
  });

  it("finds the error belonging to one field", () => {
    const envelope = {
      ok: false as const,
      code: "VALIDATION_ERROR" as const,
      message: "x",
      requestId: "r",
      errors: [
        { field: "plateDisplay", code: "INVALID_FORMAT" as const, message: "salah" },
        { field: "cityId", code: "REQUIRED" as const, message: "wajib" },
      ],
    };

    expect(fieldErrorFor(envelope, "cityId")?.message).toBe("wajib");
    expect(fieldErrorFor(envelope, "tidakAda")).toBeUndefined();
  });
});

describe("PLAN/04 §2.1 — the permission matrix", () => {
  it("gives an operator no business-data permission", () => {
    // PLAN/10 §2.1. An operator maintains the system; they do not make business
    // decisions inside it. If they could change a QC decision, the audit trail
    // would stop being evidence — and evidence is why D-15 is being fixed.
    for (const permission of ["qc.review", "qc.revert", "tirespec.write"] as const) {
      expect(roleHasPermission("operator", permission)).toBe(false);
    }
  });

  it("gives a manager the export permission", () => {
    // D-14: the one role whose entire job was reporting was also the only one
    // that could not export anything.
    expect(roleHasPermission("manager", "report.export")).toBe(true);
  });

  it("gives a supplier no visibility of other suppliers' work", () => {
    expect(roleHasPermission("supplier", "submission.read.all")).toBe(false);
    expect(roleHasPermission("supplier", "submission.read.own")).toBe(true);
  });

  it("assigns every declared permission to at least one role", () => {
    // A permission nobody holds is either dead code or a missing grant, and both
    // are worth noticing.
    for (const permission of PERMISSIONS) {
      const holders = USER_ROLES.filter((role) => ROLE_PERMISSIONS[role].includes(permission));
      expect(holders.length).toBeGreaterThan(0);
    }
  });

  it("returns the same list through the helper as through the table", () => {
    for (const role of USER_ROLES) {
      expect(permissionsFor(role)).toEqual(ROLE_PERMISSIONS[role]);
    }
  });

  it("requires step-up for user management but not for a QC decision", () => {
    // PLAN/13 §4: QC decisions happen too often, and the friction would outweigh
    // the protection.
    expect(requiresStepUp("user.manage")).toBe(true);
    expect(requiresStepUp("qc.review")).toBe(false);
  });
});

describe("PLAN/11 §5.4 — which statuses lock a vehicle", () => {
  it.each(["pending_qc", "needs_revision", "passed_qc"] as const)("locks on %s", (status) => {
    expect(isLockingStatus(status)).toBe(true);
  });

  it.each(["draft", "dropped_qc"] as const)("does not lock on %s", (status) => {
    expect(isLockingStatus(status)).toBe(false);
  });
});

describe("PLAN/02 §7.1 — serial numbers", () => {
  it("pads the sequence to five digits", () => {
    // Not four. At 1,200 inspections a month the four-digit form is exhausted in
    // month nine, and numbers would start colliding inside the first year.
    expect(formatSerialNumber(2026, 1)).toBe("SN2026-00001");
    expect(formatSerialNumber(2026, 9999)).toBe("SN2026-09999");
    expect(SERIAL_SEQUENCE_DIGITS).toBe(5);
  });

  it("keeps growing past the padded width rather than truncating", () => {
    expect(formatSerialNumber(2026, 123456)).toBe("SN2026-123456");
  });
});

describe("PLAN/03 §2.3 — storage keys are built from the code, never the label", () => {
  it("uses the position code for a tire photograph", () => {
    // The legacy system used the Indonesian label as its Drive path, so every
    // wording fix in the UI risked breaking photo matching.
    expect(
      buildStorageKey({
        year: 2026,
        serialNumber: "SN2026-00042",
        slot: "tire_position",
        positionCode: "DRIVE_1_R_OUT",
        uuid: "abc",
        mimeType: "image/webp",
      }),
    ).toBe("inspections/2026/SN2026-00042/DRIVE_1_R_OUT/abc.webp");
  });

  it("uses the slot name for a general photograph", () => {
    expect(
      buildStorageKey({
        year: 2026,
        serialNumber: "SN2026-00042",
        slot: "side",
        positionCode: null,
        uuid: "abc",
        mimeType: "image/jpeg",
      }),
    ).toBe("inspections/2026/SN2026-00042/side/abc.jpg");
  });
});

describe("V-13 helper — photo caps", () => {
  it("allows an upload below both caps", () => {
    expect(checkPhotoQuota({ slotCount: 1, inspectionCount: 1 })).toBeNull();
  });

  it("stops at ten per slot and thirty per inspection", () => {
    expect(checkPhotoQuota({ slotCount: MAX_PHOTOS_PER_SLOT, inspectionCount: 1 })).not.toBeNull();
    expect(
      checkPhotoQuota({ slotCount: 1, inspectionCount: MAX_PHOTOS_PER_INSPECTION }),
    ).not.toBeNull();
  });
});

describe("V-11 helper — city and province", () => {
  const cities = [
    { id: 1, provinceId: 10 },
    { id: 2, provinceId: 20 },
  ];

  it("accepts a matching pair and rejects a mismatched one", () => {
    expect(validateCityInProvince(cities, 1, 10)).toEqual([]);
    expect(validateCityInProvince(cities, 2, 10)).toHaveLength(1);
  });
});

describe("PLAN/12 §5 — the notification catalogue", () => {
  it("has a template for every event type", () => {
    // A missing template would stall the outbox behind one unknown event, and a
    // stalled outbox stops every notification without raising an error.
    for (const eventType of EVENT_TYPES) {
      expect(NOTIFICATION_TEMPLATES[eventType].title.length).toBeGreaterThan(0);
      expect(NOTIFICATION_TEMPLATES[eventType].body.length).toBeGreaterThan(0);
    }
  });

  it("keeps the three action-demanding events unmutable", () => {
    // `inspection.needs_revision` is on the list because it is the only
    // notification that demands the supplier do something. Silencing it brings
    // D-11 back in a new shape.
    expect(UNMUTABLE_EVENT_TYPES).toContain("inspection.needs_revision");
    expect(UNMUTABLE_EVENT_TYPES).toContain("user.password_reset");
    expect(UNMUTABLE_EVENT_TYPES).toContain("user.login_from_new_device");
  });

  it("substitutes template values and leaves unknown keys empty", () => {
    expect(renderTemplate("SN {{serialNumber}} · {{missing}}", { serialNumber: "SN2026-00001" })).toBe(
      "SN SN2026-00001 · ",
    );
  });
});
