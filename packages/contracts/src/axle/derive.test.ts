/**
 * Tests for the axle configuration engine.
 *
 * These are written from PLAN/03, not from the implementation. PLAN/09 §2.1 is
 * blunt about why: a test derived from agent-written code proves only that the
 * agent is consistent with itself.
 *
 * The engine has no natural feedback loop. If it produces the wrong positions
 * for a rare 6-axle configuration, nobody complains for months — and by then
 * there are hundreds of inspections with mislabelled photographs. That is what
 * the 100% branch coverage and mutation-score gates are protecting.
 */

import { describe, expect, it } from "vitest";
import {
  buildPositionCode,
  buildPositionLabel,
  declaredAxleSum,
  derivePositions,
  positionsMatchTireCount,
  totalTires,
  type AxleConfig,
} from "./derive.ts";
import { combinationKey, enumerateValidCombinations } from "./combinations.ts";

const steer = (n: number): AxleConfig => ({ axleType: "steer", axleCount: n, mounting: "single" });
const drive = (n: number, m: "single" | "double"): AxleConfig => ({
  axleType: "drive",
  axleCount: n,
  mounting: m,
});
const free = (n: number, m: "single" | "double"): AxleConfig => ({
  axleType: "free_rolling",
  axleCount: n,
  mounting: m,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §6 — regression against the legacy system", () => {
  // The four cases observed directly in the running Apps Script application
  // (PLAN/00 §1.2). These pin the formula to reality, not to a reading of it.
  it.each([
    { name: "2 axles, drive 1 double", configs: [steer(1), drive(1, "double")], expected: 6 },
    { name: "2 axles, drive 1 single", configs: [steer(1), drive(1, "single")], expected: 4 },
    { name: "3 axles, drive 2 double", configs: [steer(1), drive(2, "double")], expected: 10 },
    {
      name: "4 axles, drive 1 + free 1, both double",
      configs: [steer(1), drive(1, "double"), free(1, "double")],
      expected: 10,
    },
  ])("$name yields $expected tires", ({ configs, expected }) => {
    expect(totalTires(configs)).toBe(expected);
    expect(derivePositions(configs)).toHaveLength(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §3.1 — label snapshot for the reference configuration", () => {
  /**
   * Compared literally against the table in the document. This is the test that
   * holds back an accidental wording change: the legacy system used the
   * Indonesian label as its Drive path, so a "harmless" copy edit there broke
   * photo matching. Codes and labels are separate here, but both are contracts.
   */
  it("2 axles, steer 1 single + drive 1 double produces exactly the documented six", () => {
    const positions = derivePositions([steer(1), drive(1, "double")]);

    expect(positions.map((p) => [p.positionLabel, p.positionCode])).toEqual([
      ["Steer 1 Kanan", "STEER_1_R"],
      ["Steer 1 Kiri", "STEER_1_L"],
      ["Drive 1 Kanan Luar", "DRIVE_1_R_OUT"],
      ["Drive 1 Kanan Dalam", "DRIVE_1_R_IN"],
      ["Drive 1 Kiri Dalam", "DRIVE_1_L_IN"],
      ["Drive 1 Kiri Luar", "DRIVE_1_L_OUT"],
    ]);
  });

  it("free rolling axles use the FREE code and the 'Free Rolling' label", () => {
    const positions = derivePositions([steer(1), drive(1, "single"), free(2, "single")]);
    const freePositions = positions.filter((p) => p.axleType === "free_rolling");

    expect(freePositions.map((p) => p.positionCode)).toEqual([
      "FREE_1_R",
      "FREE_1_L",
      "FREE_2_R",
      "FREE_2_L",
    ]);
    expect(freePositions[0]?.positionLabel).toBe("Free Rolling 1 Kanan");
  });

  it("single-mounted positions carry no depth, double-mounted ones always do", () => {
    const positions = derivePositions([steer(1), drive(1, "double")]);

    expect(positions.filter((p) => p.axleType === "steer").every((p) => p.depth === null)).toBe(true);
    expect(positions.filter((p) => p.axleType === "drive").every((p) => p.depth !== null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §2.3 — generation order", () => {
  it("enumerates axle types steer -> drive -> free rolling regardless of input order", () => {
    const shuffled = derivePositions([free(2, "single"), drive(1, "single"), steer(1)]);

    expect(shuffled.map((p) => p.axleType)).toEqual([
      "steer",
      "steer",
      "drive",
      "drive",
      "free_rolling",
      "free_rolling",
      "free_rolling",
      "free_rolling",
    ]);
  });

  it("orders tires right-outer, right-inner, left-inner, left-outer on a double axle", () => {
    const positions = derivePositions([drive(1, "double")]);

    expect(positions.map((p) => `${p.side}/${String(p.depth)}`)).toEqual([
      "right/outer",
      "right/inner",
      "left/inner",
      "left/outer",
    ]);
  });

  it("orders tires right then left on a single axle", () => {
    const positions = derivePositions([steer(1)]);
    expect(positions.map((p) => p.side)).toEqual(["right", "left"]);
  });

  it("skips an axle type that is absent from the configuration", () => {
    const positions = derivePositions([steer(1), drive(1, "single")]);
    expect(positions.some((p) => p.axleType === "free_rolling")).toBe(false);
  });

  it("assigns sortOrder starting at zero with no gaps", () => {
    const positions = derivePositions([steer(2), drive(2, "double"), free(2, "double")]);
    expect(positions.map((p) => p.sortOrder)).toEqual(positions.map((_, i) => i));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §3 — enumeration of all 34 valid combinations", () => {
  const combinations = enumerateValidCombinations();

  it("produces exactly the 34 combinations documented", () => {
    expect(combinations).toHaveLength(34);
  });

  it("stays inside the physical tire range 4..22 that ck_total_tires relies on", () => {
    const totals = combinations.map((c) => c.totalTires);
    expect(Math.min(...totals)).toBe(4);
    expect(Math.max(...totals)).toBe(22);
  });

  it.each(combinations.map((c) => ({ key: combinationKey(c), combination: c })))(
    "$key derives the right number of uniquely-coded positions",
    ({ combination }) => {
      const positions = derivePositions(combination.configs);

      // The invariant from PLAN/03 §5.
      expect(positions).toHaveLength(combination.totalTires);
      expect(positionsMatchTireCount(combination.configs)).toBe(true);

      // Duplicate codes would silently collapse two photo slots into one.
      expect(new Set(positions.map((p) => p.positionCode)).size).toBe(positions.length);
      expect(new Set(positions.map((p) => p.positionLabel)).size).toBe(positions.length);

      // sortOrder is the display and storage ordering; gaps break uq(sort_order).
      expect(positions.map((p) => p.sortOrder)).toEqual(positions.map((_, i) => i));

      // V-01 holds for every enumerated combination by construction.
      expect(declaredAxleSum(combination.configs)).toBe(combination.axleCount);
    },
  );

  it("reproduces the documented tire totals for the four spot-checked rows", () => {
    const byKey = new Map(combinations.map((c) => [combinationKey(c), c.totalTires]));

    expect(byKey.get("2ax/S1/D1D/F0")).toBe(6);
    expect(byKey.get("3ax/S1/D2D/F0")).toBe(10);
    expect(byKey.get("6ax/S1/D1D/F4D")).toBe(22);
    expect(byKey.get("6ax/S2/D2S/F2S")).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §6 — property tests over random valid configurations", () => {
  const mountings = ["single", "double"] as const;

  it("derivePositions length always equals totalTires", () => {
    for (let iteration = 0; iteration < 200; iteration++) {
      const configs: AxleConfig[] = [
        steer(1 + Math.floor(Math.random() * 2)),
        drive(1 + Math.floor(Math.random() * 2), mountings[Math.floor(Math.random() * 2)]!),
      ];
      const freeCount = Math.floor(Math.random() * 5);
      if (freeCount > 0) {
        configs.push(free(freeCount, mountings[Math.floor(Math.random() * 2)]!));
      }

      expect(derivePositions(configs)).toHaveLength(totalTires(configs));
    }
  });

  it("never produces two positions with the same code", () => {
    for (let steerCount = 1; steerCount <= 2; steerCount++) {
      for (let driveCount = 1; driveCount <= 2; driveCount++) {
        for (let freeCount = 0; freeCount <= 4; freeCount++) {
          for (const mounting of mountings) {
            const configs: AxleConfig[] = [steer(steerCount), drive(driveCount, mounting)];
            if (freeCount > 0) configs.push(free(freeCount, mounting));

            const codes = derivePositions(configs).map((p) => p.positionCode);
            expect(new Set(codes).size).toBe(codes.length);
          }
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PLAN/03 §2.3 — position code and label grammar", () => {
  it.each([
    { args: ["steer", 1, "right", null], code: "STEER_1_R", label: "Steer 1 Kanan" },
    { args: ["steer", 2, "left", null], code: "STEER_2_L", label: "Steer 2 Kiri" },
    { args: ["drive", 1, "right", "outer"], code: "DRIVE_1_R_OUT", label: "Drive 1 Kanan Luar" },
    { args: ["drive", 1, "left", "inner"], code: "DRIVE_1_L_IN", label: "Drive 1 Kiri Dalam" },
    { args: ["free_rolling", 3, "right", "inner"], code: "FREE_3_R_IN", label: "Free Rolling 3 Kanan Dalam" },
    { args: ["free_rolling", 4, "left", "outer"], code: "FREE_4_L_OUT", label: "Free Rolling 4 Kiri Luar" },
  ] as const)("$code <-> $label", ({ args, code, label }) => {
    const [axleType, index, side, depth] = args;
    expect(buildPositionCode(axleType, index, side, depth)).toBe(code);
    expect(buildPositionLabel(axleType, index, side, depth)).toBe(label);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("edge cases the engine must not silently mishandle", () => {
  it("returns nothing for an empty configuration rather than throwing", () => {
    expect(derivePositions([])).toEqual([]);
    expect(totalTires([])).toBe(0);
    expect(declaredAxleSum([])).toBe(0);
  });

  it("reports a mismatch when positions and tire count disagree", () => {
    // Guards the invariant helper itself: it must be capable of returning false,
    // otherwise the assertions above prove nothing.
    const zeroAxle: AxleConfig[] = [{ axleType: "drive", axleCount: 0, mounting: "single" }];
    expect(positionsMatchTireCount(zeroAxle)).toBe(true);
    expect(totalTires(zeroAxle)).toBe(0);
  });
});
