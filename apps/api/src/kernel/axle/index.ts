/**
 * The server's entry point onto the axle configuration engine.
 *
 * The engine itself lives in `packages/contracts/src/axle` — see the note at the
 * top of `derive.ts` for why: PLAN/06 §2 requires photo slots to be generated on
 * the device while offline, so the engine has to be importable by the client
 * too. Duplicating it would recreate exactly the drift PLAN/01 §4.4 forbids.
 *
 * This file adds nothing but the shapes the database layer needs. It contains no
 * derivation logic of its own, and it must not grow any: PLAN/03 §1 is explicit
 * that no other code in the system may build a tire position name.
 */

import {
  derivePositions,
  totalTires,
  validateAxleConfiguration,
  type AxleConfig,
  type TirePosition,
} from "@c26/contracts";
import { AppError } from "../envelope/index.ts";

export {
  buildPositionCode,
  buildPositionLabel,
  declaredAxleSum,
  derivePositions,
  enumerateValidCombinations,
  positionsMatchTireCount,
  totalTires,
  validateAxleConfiguration,
  type AxleConfig,
  type TirePosition,
} from "@c26/contracts";

/** Row shape for a `tire_positions` insert, derived and never typed by a human. */
export interface TirePositionRow {
  positionCode: string;
  positionLabel: string;
  axleType: AxleConfig["axleType"];
  axleIndex: number;
  side: "left" | "right";
  depth: "inner" | "outer" | null;
  sortOrder: number;
}

export function toPositionRows(positions: readonly TirePosition[]): TirePositionRow[] {
  return positions.map((position) => ({
    positionCode: position.positionCode,
    positionLabel: position.positionLabel,
    axleType: position.axleType,
    axleIndex: position.axleIndex,
    side: position.side,
    depth: position.depth,
    sortOrder: position.sortOrder,
  }));
}

/**
 * V-06: the server recomputes rather than trusting anything from the client.
 *
 * The client is allowed — and for offline work, required — to derive positions
 * for its own preview. It is never allowed to decide how many tires a vehicle
 * has. This function is the single place a write path obtains that number.
 */
export function computeAxleResult(input: {
  axleCount: number;
  configs: readonly AxleConfig[];
}): { totalTires: number; positions: TirePositionRow[] } {
  const errors = validateAxleConfiguration({ axleCount: input.axleCount, configs: input.configs });
  if (errors.length > 0) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: errors.map((error) => ({
        field: error.field,
        code: error.code,
        message: error.message,
      })),
    });
  }

  return {
    totalTires: totalTires(input.configs),
    positions: toPositionRows(derivePositions(input.configs)),
  };
}
