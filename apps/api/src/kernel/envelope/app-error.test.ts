import { describe, expect, it } from "vitest";
import {
  AppError,
  duplicatePlate,
  forbidden,
  invalidTransition,
  isAppError,
  notFound,
  validationError,
} from "./app-error.ts";

describe("AppError — basic construction", () => {
  it("has the correct name and defaults the message from ERROR_DEFINITIONS", () => {
    const err = new AppError("NOT_FOUND");
    expect(err.name).toBe("AppError");
    expect(err.message).toBe("Resource tidak ditemukan.");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.fieldErrors).toEqual([]);
    expect(err.context).toEqual({});
  });

  it("allows overriding the message", () => {
    const err = new AppError("VALIDATION_ERROR", {
      message: "pesan kustom",
    });
    expect(err.message).toBe("pesan kustom");
    expect(err.status).toBe(422);
  });

  it("passes the cause through to the Error base class", () => {
    const cause = new Error("underlying");
    const err = new AppError("INTERNAL_ERROR", { cause });
    expect((err.cause as Error).message).toBe("underlying");
  });
});

describe("isAppError guard", () => {
  it("recognises an AppError", () => {
    expect(isAppError(new AppError("NOT_FOUND"))).toBe(true);
  });

  it("rejects a plain Error", () => {
    expect(isAppError(new Error("boom"))).toBe(false);
  });

  it("rejects non-error values", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(42)).toBe(false);
  });
});

describe("validationError helper", () => {
  it("wraps field errors into a VALIDATION_ERROR", () => {
    const err = validationError([
      { field: "email", code: "REQUIRED", message: "Wajib diisi" },
    ]);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.status).toBe(422);
    expect(err.fieldErrors).toHaveLength(1);
  });
});

describe("notFound helper", () => {
  it("includes entity and id in context", () => {
    const err = notFound("Inspection", 42n);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.context).toEqual({ entity: "Inspection", id: "42" });
  });
});

describe("forbidden helper", () => {
  it("includes the permission in context", () => {
    const err = forbidden("submission.read.all");
    expect(err.code).toBe("FORBIDDEN_ROLE");
    expect(err.context).toEqual({ permission: "submission.read.all" });
  });
});

describe("invalidTransition helper", () => {
  it("builds an Indonesian message naming from/to", () => {
    const err = invalidTransition("draft", "pending_qc");
    expect(err.code).toBe("INVALID_STATE_TRANSITION");
    expect(err.message).toContain("draft");
    expect(err.message).toContain("pending_qc");
  });
});

describe("duplicatePlate helper", () => {
  it("produces a message and a field error pointing at plateDisplay", () => {
    const err = duplicatePlate({
      plateDisplay: "B 1234 ABC",
      serialNumber: "SN2026-00001",
      statusLabel: "Pending QC",
    });
    expect(err.code).toBe("DUPLICATE_PLATE");
    expect(err.message).toContain("B 1234 ABC");
    expect(err.message).toContain("SN2026-00001");
    expect(err.fieldErrors[0]?.field).toBe("plateDisplay");
    expect(err.fieldErrors[0]?.code).toBe("NOT_ALLOWED");
  });
});
