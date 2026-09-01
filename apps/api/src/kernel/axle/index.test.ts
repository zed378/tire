import { describe, expect, it } from "vitest";
import { computeAxleResult, toPositionRows } from "./index.ts";
import { derivePositions, enumerateValidCombinations, type AxleConfig } from "@c26/contracts";
import { AppError } from "../envelope/index.ts";

const steer: AxleConfig = { axleType: "steer", axleCount: 1, mounting: "single" };
const driveDouble: AxleConfig = { axleType: "drive", axleCount: 1, mounting: "double" };

describe("V-06: the server recomputes the tire count and never trusts the client", () => {
  it("derives the tire count from the configuration, not from any supplied number", () => {
    const result = computeAxleResult({ axleCount: 2, configs: [steer, driveDouble] });

    expect(result.totalTires).toBe(6);
    expect(result.positions).toHaveLength(6);
  });

  it("rejects an invalid configuration with a field error rather than computing anyway", () => {
    // The D-04 case. In the legacy system this was accepted in silence and
    // produced ten tire slots that were simply wrong.
    expect(() =>
      computeAxleResult({
        axleCount: 6,
        configs: [
          steer,
          { axleType: "drive", axleCount: 1, mounting: "single" },
          { axleType: "free_rolling", axleCount: 1, mounting: "single" },
        ],
      }),
    ).toThrow(AppError);
  });

  it("reports the mismatch as a field error on axleConfigs", () => {
    try {
      computeAxleResult({ axleCount: 4, configs: [steer, driveDouble] });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION_ERROR");
      expect(appError.fieldErrors.some((e) => e.code === "AXLE_SUM_MISMATCH")).toBe(true);
    }
  });

  it("agrees with the engine for every one of the 34 valid combinations", () => {
    for (const combination of enumerateValidCombinations()) {
      const result = computeAxleResult({
        axleCount: combination.axleCount,
        configs: combination.configs,
      });
      expect(result.totalTires).toBe(combination.totalTires);
      expect(result.positions).toHaveLength(combination.totalTires);
    }
  });
});

describe("row mapping keeps the engine's output intact", () => {
  it("carries code, label, and ordering through unchanged", () => {
    const positions = derivePositions([steer, driveDouble]);
    const rows = toPositionRows(positions);

    expect(rows.map((r) => r.positionCode)).toEqual(positions.map((p) => p.positionCode));
    expect(rows.map((r) => r.positionLabel)).toEqual(positions.map((p) => p.positionLabel));
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("returns an empty list for an empty configuration", () => {
    expect(toPositionRows([])).toEqual([]);
  });
});
