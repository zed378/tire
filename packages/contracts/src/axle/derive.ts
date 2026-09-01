/**
 * The axle configuration engine (K-01, K-02) — the formalisation of PLAN/03 §5.
 *
 * Pure logic. No I/O, no database, no framework. That is what lets it be tested
 * exhaustively against all 34 valid combinations without a database, which
 * PLAN/00 §4 demands at 100% branch coverage.
 *
 * WHY IT LIVES IN `packages/contracts` RATHER THAN `apps/api/src/kernel/axle`
 * as PLAN/01 §4.5 sketches: PLAN/06 §2 requires the photo slots to be generated
 * on the device while offline, before anything can be uploaded. An engine that
 * only exists on the server cannot do that, and duplicating it on the client
 * would recreate exactly the drift PLAN/01 §4.4 forbids. So it sits in the one
 * package both sides import, and `apps/api/src/kernel/axle` re-exports it as the
 * server's entry point. The server still decides (V-06): the client's derivation
 * is a preview, and every write recomputes from scratch.
 *
 * ONE RULE BINDS EVERYTHING HERE: no other code in the system may build a tire
 * position name. Three consumers depend on these strings agreeing — the upload
 * slots, the tire spec cards, and the object storage key. If any of them derived
 * names separately, photos and specs would silently stop pairing on the rarer
 * axle configurations, and nobody would notice for months.
 */

import {
  AXLE_TYPE_ORDER,
  type AxleType,
  type TireDepth,
  type TireMounting,
  type TireSide,
} from "../constants.ts";

export interface AxleConfig {
  axleType: AxleType;
  /** Number of axles of this type. 1..5. */
  axleCount: number;
  mounting: TireMounting;
}

export interface TirePosition {
  /** Stable machine key: 'DRIVE_1_R_OUT'. Used in the database and storage keys. */
  positionCode: string;
  /** Human label: 'Drive 1 Kanan Luar'. Used in the UI and in exports. */
  positionLabel: string;
  axleType: AxleType;
  axleIndex: number;
  side: TireSide;
  /** null on single-mounted axles. */
  depth: TireDepth | null;
  sortOrder: number;
}

const LABEL: Record<AxleType, string> = {
  steer: "Steer",
  drive: "Drive",
  free_rolling: "Free Rolling",
};

const CODE: Record<AxleType, string> = {
  steer: "STEER",
  drive: "DRIVE",
  free_rolling: "FREE",
};

/**
 * Tire order within one axle, right side first (PLAN/03 §2.3).
 *
 * This ordering is not a free choice: it copies exactly what the legacy system
 * produced, so that migrated photos still pair with the positions this engine
 * derives (PLAN/07 §3.2). Changing it silently re-labels historical evidence.
 */
const SEQUENCE: Record<TireMounting, readonly (readonly [TireSide, TireDepth | null])[]> = {
  double: [
    ["right", "outer"],
    ["right", "inner"],
    ["left", "inner"],
    ["left", "outer"],
  ],
  single: [
    ["right", null],
    ["left", null],
  ],
};

const TIRES_PER_AXLE: Record<TireMounting, number> = { single: 2, double: 4 };

const SIDE_CODE: Record<TireSide, string> = { right: "R", left: "L" };
const SIDE_LABEL: Record<TireSide, string> = { right: "Kanan", left: "Kiri" };
const DEPTH_CODE: Record<TireDepth, string> = { outer: "OUT", inner: "IN" };
const DEPTH_LABEL: Record<TireDepth, string> = { outer: "Luar", inner: "Dalam" };

export function buildPositionCode(
  axleType: AxleType,
  axleIndex: number,
  side: TireSide,
  depth: TireDepth | null,
): string {
  const parts = [CODE[axleType], String(axleIndex), SIDE_CODE[side]];
  if (depth !== null) parts.push(DEPTH_CODE[depth]);
  return parts.join("_");
}

export function buildPositionLabel(
  axleType: AxleType,
  axleIndex: number,
  side: TireSide,
  depth: TireDepth | null,
): string {
  const parts = [LABEL[axleType], String(axleIndex), SIDE_LABEL[side]];
  if (depth !== null) parts.push(DEPTH_LABEL[depth]);
  return parts.join(" ");
}

/**
 * Derives every named tire position for a configuration.
 *
 * Axle types are enumerated in the fixed order steer -> drive -> free rolling;
 * within a type, indices run 1..axleCount; within an axle, tires run from
 * right-outer to left-outer.
 */
export function derivePositions(configs: readonly AxleConfig[]): TirePosition[] {
  const positions: TirePosition[] = [];
  let sortOrder = 0;

  for (const axleType of AXLE_TYPE_ORDER) {
    const config = configs.find((c) => c.axleType === axleType);
    if (config === undefined) continue;

    for (let axleIndex = 1; axleIndex <= config.axleCount; axleIndex++) {
      for (const [side, depth] of SEQUENCE[config.mounting]) {
        positions.push({
          positionCode: buildPositionCode(axleType, axleIndex, side, depth),
          positionLabel: buildPositionLabel(axleType, axleIndex, side, depth),
          axleType,
          axleIndex,
          side,
          depth,
          sortOrder: sortOrder++,
        });
      }
    }
  }

  return positions;
}

/**
 * total_tires = sum over axles of axleCount x (double ? 4 : 2).
 *
 * Validated against four observed cases in the legacy system (PLAN/00 §1.2),
 * which are pinned as regression tests.
 */
export function totalTires(configs: readonly AxleConfig[]): number {
  return configs.reduce((sum, c) => sum + c.axleCount * TIRES_PER_AXLE[c.mounting], 0);
}

/** Total number of declared axles, across all types. Used by V-01. */
export function declaredAxleSum(configs: readonly AxleConfig[]): number {
  return configs.reduce((sum, c) => sum + c.axleCount, 0);
}

/**
 * The invariant that must always hold, asserted against all 34 combinations:
 * `derivePositions(c).length === totalTires(c)`.
 */
export function positionsMatchTireCount(configs: readonly AxleConfig[]): boolean {
  return derivePositions(configs).length === totalTires(configs);
}
