/**
 * Tests for V-07, V-09, and V-10 (PLAN/03 §4), plus plate normalisation
 * (PLAN/11 §4) — the prerequisite without which "unique" means nothing.
 */

import { describe, expect, it } from "vitest";
import {
  createVehicleSchema,
  normalizePlateDisplay,
  plateDisplaySchema,
  plateKeyOf,
  type CreateVehicleInput,
} from "./vehicle.ts";

const validVehicle: CreateVehicleInput = {
  plateDisplay: "B 1234 ABC",
  chassisNumber: null,
  category: "TB",
  segment: "truck",
  subSegment: "General Cargo",
  vehicleBrandId: 1,
  vehicleBrandOther: null,
  cargoType: "Semen",
  cityId: 1,
  axleCount: 2,
  axleConfigs: [
    { axleType: "steer", axleCount: 1, mounting: "single" },
    { axleType: "drive", axleCount: 1, mounting: "double" },
  ],
};

const messagesFor = (input: unknown): string[] => {
  const result = createVehicleSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

const pathsFor = (input: unknown): string[] => {
  const result = createVehicleSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

// ─────────────────────────────────────────────────────────────────────────────
describe("V-07: plate numbers are normalised then matched against one pattern", () => {
  it("rejects the exact input that slipped through the legacy system", () => {
    // D-05: `b 1234 abc!` became `B1234ABC!`. Spaces were stripped and letters
    // uppercased, but the `!` survived — corrupting storage paths and duplicate
    // matching alike.
    expect(plateDisplaySchema.safeParse("b 1234 abc!").success).toBe(false);
  });

  it.each([
    "B 1234 ABC",
    "b 1234 abc",
    "B1234ABC",
    "  B   1234   ABC  ",
    "D 5 A",
    "AB 1234 XYZ",
  ])("accepts %s", (raw) => {
    expect(plateDisplaySchema.safeParse(raw).success).toBe(true);
  });

  it.each([
    ["B 1234 ABC!", "punctuation"],
    ["B-1234-ABC", "hyphens"],
    ["AAAA", "letters only — accepted by the old PLAN/02 regex, rejected now"],
    ["1234", "digits only — likewise"],
    ["", "empty"],
    ["B 12345 ABC", "five digits"],
    ["ABC 1234 XY", "three leading letters"],
    ["B 1234 ABCD", "four trailing letters"],
  ])("rejects %s (%s)", (raw) => {
    expect(plateDisplaySchema.safeParse(raw).success).toBe(false);
  });

  it("normalises to the stored display form rather than keeping raw keystrokes", () => {
    expect(normalizePlateDisplay("  b   1234   abc ")).toBe("B 1234 ABC");
    expect(plateDisplaySchema.parse("b1234abc")).toBe("B1234ABC");
  });

  it("derives the same uniqueness key regardless of spacing or case", () => {
    // Uniqueness over an un-normalised column is fake uniqueness: `B 1234 ABC`,
    // `b1234abc`, and `B1234ABC` are three values to PostgreSQL and one vehicle
    // to a human (PLAN/11 §4).
    const key = "B1234ABC";
    expect(plateKeyOf("B 1234 ABC")).toBe(key);
    expect(plateKeyOf("b1234abc")).toBe(key);
    expect(plateKeyOf("B-1234-ABC")).toBe(key);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-09: an LT vehicle may not carry the bus segment", () => {
  it("rejects LT + bus", () => {
    const paths = pathsFor({ ...validVehicle, category: "LT", segment: "bus", subSegment: "City Bus (Bus Kota)" });
    expect(paths).toContain("segment");
  });

  it("accepts LT + truck", () => {
    expect(createVehicleSchema.safeParse({ ...validVehicle, category: "LT" }).success).toBe(true);
  });

  it.each(["bus", "truck"] as const)("accepts TB + %s", (segment) => {
    const subSegment = segment === "bus" ? "City Bus (Bus Kota)" : "General Cargo";
    expect(
      createVehicleSchema.safeParse({ ...validVehicle, category: "TB", segment, subSegment }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-10: the sub-segment must belong to the chosen segment", () => {
  it("rejects a bus sub-segment on a truck", () => {
    expect(
      pathsFor({ ...validVehicle, segment: "truck", subSegment: "City Bus (Bus Kota)" }),
    ).toContain("subSegment");
  });

  it("rejects a truck sub-segment on a bus", () => {
    expect(
      pathsFor({ ...validVehicle, category: "TB", segment: "bus", subSegment: "Dump Truck" }),
    ).toContain("subSegment");
  });

  it("rejects a sub-segment that is not in the master list at all", () => {
    expect(pathsFor({ ...validVehicle, subSegment: "Sesuatu Yang Lain" })).toContain("subSegment");
  });

  it.each(["General Cargo", "Dump Truck", "Tanker", "Trailer"])("accepts %s on a truck", (sub) => {
    expect(createVehicleSchema.safeParse({ ...validVehicle, subSegment: sub }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("vehicle payload rules beyond the V-nn table", () => {
  it("requires either a brand from the master list or free-text 'other'", () => {
    const paths = pathsFor({ ...validVehicle, vehicleBrandId: null, vehicleBrandOther: null });
    expect(paths).toContain("vehicleBrandId");
  });

  it("accepts a free-text brand when none is chosen from the list", () => {
    expect(
      createVehicleSchema.safeParse({
        ...validVehicle,
        vehicleBrandId: null,
        vehicleBrandOther: "Merk Baru",
      }).success,
    ).toBe(true);
  });

  it("surfaces axle rule failures through the same payload, not a separate call", () => {
    // The engine's rules reach the form through one schema, so client and server
    // reject the identical input for the identical reason (PLAN/01 §4.4).
    const messages = messagesFor({
      ...validVehicle,
      axleCount: 6,
      axleConfigs: [
        { axleType: "steer", axleCount: 1, mounting: "single" },
        { axleType: "drive", axleCount: 1, mounting: "single" },
        { axleType: "free_rolling", axleCount: 1, mounting: "single" },
      ],
    });

    expect(messages.some((m) => m.includes("3") && m.includes("6"))).toBe(true);
  });

  it("accepts an optional chassis number and normalises it", () => {
    const parsed = createVehicleSchema.parse({ ...validVehicle, chassisNumber: " mhf1 2345 " });
    expect(parsed.chassisNumber).toBe("MHF12345");
  });

  it("treats a blank chassis number as absent rather than invalid", () => {
    const parsed = createVehicleSchema.parse({ ...validVehicle, chassisNumber: "   " });
    expect(parsed.chassisNumber).toBeNull();
  });

  it("rejects a chassis number containing punctuation", () => {
    expect(createVehicleSchema.safeParse({ ...validVehicle, chassisNumber: "MHF-123" }).success).toBe(
      false,
    );
  });
});
