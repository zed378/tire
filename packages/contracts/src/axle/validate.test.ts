/**
 * Rejection tests for V-01 .. V-06 (PLAN/03 §4).
 *
 * Every rule is exercised with input that violates it. This half matters more
 * than the acceptance half: D-04 was not a rule that failed, it was a rule that
 * was never written, so nothing ever went red. A rule with only happy-path tests
 * is the same thing wearing a coverage badge.
 *
 * Gate G-04 counts the `V-nn` prefixes in these describe titles against the rule
 * table in PLAN/03 §4. Adding a rule to the document without a test here fails
 * the pipeline.
 */

import { describe, expect, it } from "vitest";
import { isValidAxleConfiguration, validateAxleConfiguration } from "./validate.ts";
import type { AxleConfig } from "./derive.ts";
import { enumerateValidCombinations } from "./combinations.ts";

const steer = (n: number, m: "single" | "double" = "single"): AxleConfig => ({
  axleType: "steer",
  axleCount: n,
  mounting: m,
});
const drive = (n: number, m: "single" | "double" = "single"): AxleConfig => ({
  axleType: "drive",
  axleCount: n,
  mounting: m,
});
const free = (n: number, m: "single" | "double" = "single"): AxleConfig => ({
  axleType: "free_rolling",
  axleCount: n,
  mounting: m,
});

const codes = (input: Parameters<typeof validateAxleConfiguration>[0]): string[] =>
  validateAxleConfiguration(input).map((e) => e.code);

// ─────────────────────────────────────────────────────────────────────────────
describe("V-01: the sub-axle detail must equal the declared axle count", () => {
  it("rejects 6 axles described as steer 1 + drive 1 + free rolling 1", () => {
    // The exact case observed getting through in the legacy system (D-04). It
    // was accepted silently and produced 10 tire slots that were simply wrong.
    const result = validateAxleConfiguration({
      axleCount: 6,
      configs: [steer(1), drive(1), free(1)],
    });

    expect(result.map((e) => e.code)).toContain("AXLE_SUM_MISMATCH");
  });

  it("states both numbers in the message so the user knows what to change", () => {
    const result = validateAxleConfiguration({
      axleCount: 6,
      configs: [steer(1), drive(1), free(1)],
    });
    const mismatch = result.find((e) => e.code === "AXLE_SUM_MISMATCH");

    expect(mismatch?.message).toContain("3");
    expect(mismatch?.message).toContain("6");
  });

  it("rejects a detail that overshoots the declared count", () => {
    expect(codes({ axleCount: 2, configs: [steer(1), drive(2)] })).toContain("AXLE_SUM_MISMATCH");
  });

  it("accepts a detail that adds up exactly", () => {
    expect(codes({ axleCount: 4, configs: [steer(1), drive(1), free(2)] })).not.toContain(
      "AXLE_SUM_MISMATCH",
    );
  });

  it("attaches the error to the axleConfigs field, not to a scalar input", () => {
    const result = validateAxleConfiguration({ axleCount: 6, configs: [steer(1), drive(1)] });
    expect(result.find((e) => e.code === "AXLE_SUM_MISMATCH")?.field).toBe("axleConfigs");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-02: a steer axle is always single-mounted", () => {
  it("rejects a double-mounted steer axle", () => {
    const result = validateAxleConfiguration({
      axleCount: 2,
      configs: [steer(1, "double"), drive(1)],
    });

    expect(result.some((e) => e.message.includes("Steer"))).toBe(true);
    expect(isValidAxleConfiguration({ axleCount: 2, configs: [steer(1, "double"), drive(1)] })).toBe(
      false,
    );
  });

  it("accepts a single-mounted steer axle", () => {
    expect(isValidAxleConfiguration({ axleCount: 2, configs: [steer(1), drive(1)] })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-03: steer and drive axles are both mandatory", () => {
  it("rejects a configuration with no steer axle", () => {
    expect(codes({ axleCount: 2, configs: [drive(2)] })).toContain("REQUIRED");
  });

  it("rejects a configuration with no drive axle", () => {
    expect(codes({ axleCount: 2, configs: [steer(2)] })).toContain("REQUIRED");
  });

  it("rejects a steer axle declared as zero", () => {
    expect(codes({ axleCount: 2, configs: [steer(0), drive(2)] })).toContain("REQUIRED");
  });

  it("rejects a drive axle declared as zero", () => {
    expect(codes({ axleCount: 2, configs: [steer(2), drive(0)] })).toContain("REQUIRED");
  });

  it("accepts one of each", () => {
    expect(codes({ axleCount: 2, configs: [steer(1), drive(1)] })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-04: free rolling axles exist only on 4- and 6-axle vehicles", () => {
  it("rejects a free rolling axle on a 2-axle vehicle", () => {
    const result = validateAxleConfiguration({
      axleCount: 2,
      configs: [steer(1), drive(1), free(1)],
    });
    expect(result.some((e) => e.message.includes("Free Rolling"))).toBe(true);
  });

  it("rejects a free rolling axle on a 3-axle vehicle", () => {
    const result = validateAxleConfiguration({
      axleCount: 3,
      configs: [steer(1), drive(1), free(1)],
    });
    expect(result.some((e) => e.message.includes("Free Rolling"))).toBe(true);
  });

  it.each([4, 6])("accepts a free rolling axle on a %i-axle vehicle", (axleCount) => {
    const freeCount = axleCount - 2;
    expect(
      isValidAxleConfiguration({ axleCount, configs: [steer(1), drive(1), free(freeCount)] }),
    ).toBe(true);
  });

  it("ignores a free rolling entry declared as zero", () => {
    const result = validateAxleConfiguration({
      axleCount: 2,
      configs: [steer(1), drive(1), free(0)],
    });
    expect(result.some((e) => e.message.includes("Free Rolling"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-05: the axle count must be one of 2, 3, 4, 6", () => {
  it.each([1, 5, 7, 0, -2, 2.5])("rejects %s", (axleCount) => {
    const result = validateAxleConfiguration({
      axleCount,
      configs: [steer(1), drive(1)],
    });
    expect(result.some((e) => e.field === "axleCount")).toBe(true);
  });

  it.each([2, 3, 4, 6])("accepts %i", (axleCount) => {
    const result = validateAxleConfiguration({ axleCount, configs: [steer(1), drive(1)] });
    expect(result.some((e) => e.field === "axleCount")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("V-06: the derived tire total must be physically possible", () => {
  it("rejects a per-type axle count beyond the supported maximum of 5", () => {
    expect(codes({ axleCount: 6, configs: [steer(1), drive(6)] })).toContain("OUT_OF_RANGE");
  });

  it("rejects a negative per-type axle count", () => {
    expect(codes({ axleCount: 2, configs: [steer(1), drive(-1)] })).toContain("OUT_OF_RANGE");
  });

  it("rejects a non-integer per-type axle count", () => {
    expect(codes({ axleCount: 2, configs: [steer(1), drive(1.5)] })).toContain("OUT_OF_RANGE");
  });

  it("keeps every one of the 34 valid combinations inside the range", () => {
    for (const combination of enumerateValidCombinations()) {
      expect(
        validateAxleConfiguration({
          axleCount: combination.axleCount,
          configs: combination.configs,
        }),
      ).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("structural rules that back the V-nn table", () => {
  it("rejects the same axle type listed twice", () => {
    const result = validateAxleConfiguration({
      axleCount: 4,
      configs: [steer(1), drive(1), drive(2)],
    });
    expect(result.some((e) => e.message.includes("satu kali"))).toBe(true);
  });

  it("reports every violation at once rather than stopping at the first", () => {
    // PLAN/05 §4.5: stopping early forces repeated submissions on a long form.
    const result = validateAxleConfiguration({
      axleCount: 5,
      configs: [steer(1, "double"), free(1)],
    });

    expect(result.length).toBeGreaterThan(2);
  });
});
