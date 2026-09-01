import { describe, expect, it } from "vitest";
import {
  mapStatus,
  normalisePlate,
  parsePhotoPath,
  parseSegmentation,
  resolveAxleConfiguration,
} from "./normalise.ts";

/**
 * These tests are as much a specification of the migration POLICY as of the
 * code. `PLAN/07` §2 rule 3 is the line they defend: dirty data is quarantined,
 * never silently corrected — because a script that guesses at intent produces
 * mistakes that are harder to find than the dirty data was.
 */

describe("plate normalisation refuses to guess", () => {
  it("quarantines the exact defect D-05 left in the data", () => {
    // `b 1234 abc!` became `B1234ABC!` in the legacy system. It might be a typo
    // for `B1234ABC1`; stripping the character would turn an obvious error into
    // a wrong value that looks correct.
    const result = normalisePlate("b 1234 abc!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_PLATE");
  });

  it("normalises spacing and case without changing the value", () => {
    const result = normalisePlate("  b   1234   abc ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.display).toBe("B 1234 ABC");
      expect(result.value.key).toBe("B1234ABC");
    }
  });

  it("gives the same key however the plate was typed", () => {
    const spaced = normalisePlate("B 1234 ABC");
    const tight = normalisePlate("b1234abc");
    expect(spaced.ok && tight.ok && spaced.value.key === tight.value.key).toBe(true);
  });
});

describe("segmentation parsing", () => {
  it("splits the combined legacy string into three typed columns", () => {
    const result = parseSegmentation("TB - Truck (General Cargo)");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        category: "TB",
        segment: "truck",
        subSegment: "General Cargo",
      });
    }
  });

  it("quarantines LT combined with the bus segment", () => {
    // D-03 means the source may well contain this, because the legacy form
    // never stopped it. It is a genuine contradiction and a person decides.
    const result = parseSegmentation("LT - Bus (City Bus (Bus Kota))");
    expect(result.ok).toBe(false);
  });

  it("quarantines anything that does not match the pattern rather than guessing", () => {
    for (const input of ["TB Truck General Cargo", "", "Truck", "TB - Sepeda (Motor)"]) {
      expect(parseSegmentation(input).ok).toBe(false);
    }
  });
});

describe("axle configuration follows the PLAN/07 §3.2 policy", () => {
  // Declared 6 axles, detailed as 1 + 1 + 2 = 4. Correcting the count to 4
  // yields a configuration that is genuinely valid, which is the case the
  // "trust the detail" policy is meant for.
  const inconsistent = {
    axleCount: 6,
    steerCount: 1,
    steerMounting: "single",
    driveCount: 1,
    driveMounting: "single",
    freeRollingCount: 2,
    freeRollingMounting: "single",
  };

  it("quarantines a mismatch on an inspection that already passed QC", () => {
    // A human reviewed those photographs and approved them. That data is too
    // important to guess at.
    const result = resolveAxleConfiguration(inconsistent, "passed_qc");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("AXLE_SUM_MISMATCH_ON_PASSED");
  });

  it("trusts the detail and corrects the declared count on everything else", () => {
    // The tire total stays right, and the tire total is what QC was looking at
    // when it made its decision.
    const result = resolveAxleConfiguration(inconsistent, "pending_qc");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.axleCount).toBe(4);
      expect(result.value.adjusted).toBe(true);
    }
  });

  it("leaves a consistent configuration untouched", () => {
    const result = resolveAxleConfiguration(
      {
        axleCount: 2,
        steerCount: 1,
        steerMounting: "single",
        driveCount: 1,
        driveMounting: "double",
        freeRollingCount: 0,
        freeRollingMounting: "",
      },
      "passed_qc",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adjusted).toBe(false);
      expect(result.value.axleCount).toBe(2);
    }
  });

  it("quarantines when correcting the count still leaves an invalid configuration", () => {
    // Worth spelling out, because it is easy to assume "trust the detail" always
    // succeeds. Declared 6 axles detailed as 1 + 1 + 1 corrects to 3 — and a
    // 3-axle vehicle may not have a free rolling axle at all (V-04). The row
    // goes to quarantine rather than being forced through.
    const result = resolveAxleConfiguration(
      {
        axleCount: 6,
        steerCount: 1,
        steerMounting: "single",
        driveCount: 1,
        driveMounting: "single",
        freeRollingCount: 1,
        freeRollingMounting: "single",
      },
      "pending_qc",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_AXLE_CONFIGURATION");
  });

  it("quarantines a configuration with no steer axle at all", () => {
    const result = resolveAxleConfiguration(
      {
        axleCount: 3,
        steerCount: 0,
        steerMounting: "single",
        driveCount: 1,
        driveMounting: "single",
        freeRollingCount: 0,
        freeRollingMounting: "",
      },
      "pending_qc",
    );
    expect(result.ok).toBe(false);
  });
});

describe("photo path parsing", () => {
  const labelToCode = new Map([
    ["drive 1 kanan luar", "DRIVE_1_R_OUT"],
    ["steer 1 kiri", "STEER_1_L"],
  ]);

  it("maps the legacy Indonesian label back to a stable position code", () => {
    // The legacy system used the label as its storage path, which is exactly the
    // coupling PLAN/03 §2.3 removes. Matching has to go label -> code so old
    // photographs land on the positions this system derives.
    const result = parsePhotoPath("SN2026-0001_B9876UYT_Drive_1_Kanan_Luar.jpg", labelToCode);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.serialNumber).toBe("SN2026-0001");
      expect(result.value.plateKey).toBe("B9876UYT");
      expect(result.value.positionCode).toBe("DRIVE_1_R_OUT");
    }
  });

  it("recognises the two general slots as having no position", () => {
    const result = parsePhotoPath("SN2026-0001_B9876UYT_Tampak_Samping.jpg", labelToCode);
    expect(result.ok && result.value.positionCode === null).toBe(true);
  });

  it("lists an unparseable path as an orphan rather than skipping it", () => {
    // PLAN/07 §4.1: never skipped quietly. Plates carrying invalid characters
    // (D-05) end up in these paths too.
    expect(parsePhotoPath("random-file-name.jpg", labelToCode).ok).toBe(false);
  });

  it("quarantines a position label that matches no derived name", () => {
    const result = parsePhotoPath("SN2026-0001_B9876UYT_Poros_Tengah.jpg", labelToCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("UNKNOWN_POSITION_LABEL");
  });
});

describe("status mapping", () => {
  it.each([
    ["Pending QC", "pending_qc"],
    ["Pass QC", "passed_qc"],
    ["Drop QC", "dropped_qc"],
  ])("maps %s", (raw, expected) => {
    const result = mapStatus(raw);
    expect(result.ok && result.value === expected).toBe(true);
  });

  it("quarantines an unrecognised status", () => {
    expect(mapStatus("Selesai").ok).toBe(false);
  });
});
