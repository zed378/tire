/**
 * Validation rules V-01 .. V-06 from PLAN/03 §4.
 *
 * Every rule here is enforced twice: once by this function (client convenience
 * and server correctness — the same code runs in both places), and once by a
 * database constraint or trigger. The second enforcement is the one that cannot
 * be bypassed by a bug in any layer above it.
 *
 * D-04 is the reason this file exists in the shape it does. In the legacy system
 * the sub-axle sum was never checked against the declared axle count, so nothing
 * failed, nothing was logged, and nothing was visible — the system quietly
 * accepted a 6-axle vehicle described by 3 axles and produced 10 tire slots that
 * were simply wrong. Rules that are not written never fail.
 */

import {
  AXLE_COUNTS_ALLOWING_FREE_ROLLING,
  MAX_AXLES_PER_TYPE,
  MAX_TOTAL_TIRES,
  MIN_TOTAL_TIRES,
  SUPPORTED_AXLE_COUNTS,
  type AxleType,
} from "../constants.ts";
import type { FieldErrorInput } from "../envelope.ts";
import { declaredAxleSum, totalTires, type AxleConfig } from "./derive.ts";

export interface AxleConfigurationInput {
  /** The `Jumlah Poros` the user picked from the dropdown. */
  axleCount: number;
  configs: readonly AxleConfig[];
}

const FIELD = "axleConfigs";

/**
 * Runs every axle rule and returns all failures at once.
 *
 * Collecting rather than short-circuiting is deliberate (PLAN/05 §4.5): on a
 * form with a dozen fields, stopping at the first error makes the user submit
 * repeatedly to discover the rest.
 */
export function validateAxleConfiguration(input: AxleConfigurationInput): FieldErrorInput[] {
  const errors: FieldErrorInput[] = [];
  const { axleCount, configs } = input;

  // ── V-05: `Jumlah Poros` must be one of the supported values ─────────────
  if (!(SUPPORTED_AXLE_COUNTS as readonly number[]).includes(axleCount)) {
    errors.push({
      field: "axleCount",
      code: "NOT_ALLOWED",
      message: `Jumlah Poros harus salah satu dari ${SUPPORTED_AXLE_COUNTS.join(", ")}.`,
    });
  }

  // A duplicated axle type would make the sums meaningless, so it is checked
  // before the rules that read them. uq(submission_id, axle_type) enforces the
  // same thing in the database.
  const seen = new Set<AxleType>();
  for (const config of configs) {
    if (seen.has(config.axleType)) {
      errors.push({
        field: FIELD,
        code: "NOT_ALLOWED",
        message: "Setiap jenis poros hanya boleh dirinci satu kali.",
      });
      break;
    }
    seen.add(config.axleType);
  }

  for (const config of configs) {
    if (!Number.isInteger(config.axleCount) || config.axleCount < 1 || config.axleCount > MAX_AXLES_PER_TYPE) {
      errors.push({
        field: FIELD,
        code: "OUT_OF_RANGE",
        message: `Jumlah poros per jenis harus antara 1 dan ${MAX_AXLES_PER_TYPE}.`,
      });
    }
  }

  const steer = configs.find((c) => c.axleType === "steer");
  const drive = configs.find((c) => c.axleType === "drive");
  const freeRolling = configs.find((c) => c.axleType === "free_rolling");

  // ── V-03: steer and drive are both mandatory, at least 1 each ────────────
  if (steer === undefined || steer.axleCount < 1) {
    errors.push({
      field: FIELD,
      code: "REQUIRED",
      message: "Poros Steer (Kemudi) wajib diisi minimal 1.",
    });
  }
  if (drive === undefined || drive.axleCount < 1) {
    errors.push({
      field: FIELD,
      code: "REQUIRED",
      message: "Poros Drive (Penggerak) wajib diisi minimal 1.",
    });
  }

  // ── V-02: a steer axle is always single-mounted ──────────────────────────
  if (steer !== undefined && steer.mounting !== "single") {
    errors.push({
      field: FIELD,
      code: "NOT_ALLOWED",
      message: "Poros Steer (Kemudi) selalu Single, tidak dapat Double.",
    });
  }

  // ── V-04: free rolling axles only exist on 4- and 6-axle vehicles ────────
  if (
    freeRolling !== undefined &&
    freeRolling.axleCount > 0 &&
    !AXLE_COUNTS_ALLOWING_FREE_ROLLING.includes(axleCount)
  ) {
    errors.push({
      field: FIELD,
      code: "NOT_ALLOWED",
      message: `Poros Free Rolling hanya tersedia untuk kendaraan ${AXLE_COUNTS_ALLOWING_FREE_ROLLING.join(" atau ")} poros.`,
    });
  }

  // ── V-01: the detail must add up to the declared axle count ──────────────
  // This is D-04. The message states both numbers, because "tidak valid" alone
  // leaves the user guessing which of the three inputs to change.
  const sum = declaredAxleSum(configs);
  if (sum !== axleCount) {
    errors.push({
      field: FIELD,
      code: "AXLE_SUM_MISMATCH",
      message: `Rincian poros berjumlah ${sum}, sedangkan Jumlah Poros yang dipilih adalah ${axleCount}.`,
    });
  }

  // ── V-06 (integrity): the derived tire count must be physically possible ──
  // A number outside 4..22 means the engine has a bug, not that the vehicle is
  // unusual. The range comes from enumerating all 34 valid combinations.
  const tires = totalTires(configs);
  if (errors.length === 0 && (tires < MIN_TOTAL_TIRES || tires > MAX_TOTAL_TIRES)) {
    errors.push({
      field: FIELD,
      code: "OUT_OF_RANGE",
      message: `Total ban terhitung ${tires}, di luar rentang wajar ${MIN_TOTAL_TIRES}–${MAX_TOTAL_TIRES}.`,
    });
  }

  return errors;
}

export function isValidAxleConfiguration(input: AxleConfigurationInput): boolean {
  return validateAxleConfiguration(input).length === 0;
}
