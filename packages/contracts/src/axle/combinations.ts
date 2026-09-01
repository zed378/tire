/**
 * Programmatic enumeration of the 34 valid axle combinations in PLAN/03 §3.
 *
 * That table was produced by enumeration rather than by hand, and this function
 * reproduces it. Tests assert both the count and the tire totals against the
 * document, so a change to the engine that alters any combination fails loudly.
 *
 * ── A CONSTRAINT THE V-nn TABLE DOES NOT STATE ──────────────────────────────
 * Reproducing the document's 34 rows requires one rule that PLAN/03 §4 does not
 * list: a second steer axle is only offered on 4- and 6-axle vehicles. It comes
 * from the prose note in §3 ("sistem berjalan memang menawarkan pilihan `2 Poros`
 * pada dropdown steer untuk konfigurasi 4 dan 6 poros"), not from the rule table.
 *
 * Without it the enumeration yields 36 rows, not 34: a 3-axle vehicle configured
 * steer 2 + drive 1 would also be valid.
 *
 * This is deliberately NOT added to `validateAxleConfiguration` as a new rule.
 * PLAN/09 §6 N-02 reserves authorship of the validation rule table to the system
 * owner precisely so that no rule is invented by implementation. It is recorded
 * here, and in TASKS/OPEN-QUESTIONS.md, as a question to answer — not a decision
 * to make quietly.
 */

import { SUPPORTED_AXLE_COUNTS, TIRE_MOUNTINGS, type TireMounting } from "../constants.ts";
import { totalTires, type AxleConfig } from "./derive.ts";

export interface AxleCombination {
  axleCount: number;
  steer: number;
  drive: number;
  freeRolling: number;
  driveMounting: TireMounting;
  /** null when there is no free rolling axle. */
  freeRollingMounting: TireMounting | null;
  totalTires: number;
  configs: AxleConfig[];
}

/** See the note above: only 4- and 6-axle vehicles offer a second steer axle. */
const AXLE_COUNTS_ALLOWING_DUAL_STEER: readonly number[] = [4, 6];

const MAX_STEER_AXLES = 2;
const MAX_DRIVE_AXLES = 2;

export function enumerateValidCombinations(): AxleCombination[] {
  const combinations: AxleCombination[] = [];

  for (const axleCount of SUPPORTED_AXLE_COUNTS) {
    const maxSteer = AXLE_COUNTS_ALLOWING_DUAL_STEER.includes(axleCount) ? MAX_STEER_AXLES : 1;

    for (let steer = 1; steer <= maxSteer; steer++) {
      for (let drive = 1; drive <= MAX_DRIVE_AXLES; drive++) {
        const freeRolling = axleCount - steer - drive;
        if (freeRolling < 0) continue;
        // V-04: free rolling axles only exist on 4- and 6-axle vehicles.
        if (freeRolling > 0 && axleCount !== 4 && axleCount !== 6) continue;

        for (const driveMounting of TIRE_MOUNTINGS) {
          const freeMountings: readonly (TireMounting | null)[] =
            freeRolling > 0 ? TIRE_MOUNTINGS : [null];

          for (const freeRollingMounting of freeMountings) {
            // V-02: the steer axle is always single.
            const configs: AxleConfig[] = [
              { axleType: "steer", axleCount: steer, mounting: "single" },
              { axleType: "drive", axleCount: drive, mounting: driveMounting },
            ];
            if (freeRolling > 0 && freeRollingMounting !== null) {
              configs.push({
                axleType: "free_rolling",
                axleCount: freeRolling,
                mounting: freeRollingMounting,
              });
            }

            combinations.push({
              axleCount,
              steer,
              drive,
              freeRolling,
              driveMounting,
              freeRollingMounting,
              totalTires: totalTires(configs),
              configs,
            });
          }
        }
      }
    }
  }

  return combinations;
}

/** Short key for snapshotting and for reading a failure message. */
export function combinationKey(c: AxleCombination): string {
  const free = c.freeRolling > 0 ? `${c.freeRolling}${c.freeRollingMounting === "double" ? "D" : "S"}` : "0";
  return `${c.axleCount}ax/S${c.steer}/D${c.drive}${c.driveMounting === "double" ? "D" : "S"}/F${free}`;
}
