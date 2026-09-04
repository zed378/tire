import { describe, expect, it } from "vitest";
import { groupPhotosByPosition, type ExportablePhoto } from "./export-build.ts";

/**
 * The photo sheet's ordering and numbering.
 *
 * Tested apart from the spreadsheet because this is the part that can be wrong
 * without anything failing: a workbook with the photographs in the wrong order,
 * or numbered straight through instead of restarting per tire, opens perfectly
 * well and is simply wrong to read.
 */

function photo(
  storageKey: string,
  position: { label: string; code: string; sortOrder: number } | null,
  slot: ExportablePhoto["slot"] = "tire_position",
): ExportablePhoto {
  return {
    storageKey,
    slot,
    capturedAt: null,
    tirePosition:
      position === null
        ? null
        : {
            positionLabel: position.label,
            positionCode: position.code,
            sortOrder: position.sortOrder,
          },
  };
}

const STEER_LEFT = { label: "Steer 1 Kiri", code: "STEER_1_L", sortOrder: 1 };
const STEER_RIGHT = { label: "Steer 1 Kanan", code: "STEER_1_R", sortOrder: 2 };
const DRIVE_LEFT = { label: "Drive 1 Kiri Luar", code: "DRIVE_1_L_OUT", sortOrder: 3 };

describe("groupPhotosByPosition", () => {
  it("numbers each tire's photographs from one", () => {
    // What the request asked for: "photo 1, photo 2" under each tire, not a
    // running count across the whole inspection.
    const rows = groupPhotosByPosition([
      photo("a", STEER_LEFT),
      photo("b", STEER_LEFT),
      photo("c", STEER_RIGHT),
      photo("d", STEER_RIGHT),
      photo("e", STEER_RIGHT),
    ]);

    expect(rows.map((row) => `${row.label} ${String(row.index)}`)).toEqual([
      "Steer 1 Kiri 1",
      "Steer 1 Kiri 2",
      "Steer 1 Kanan 1",
      "Steer 1 Kanan 2",
      "Steer 1 Kanan 3",
    ]);
  });

  it("keeps the axle engine's order, not alphabetical order", () => {
    // Sorting by label would put "Drive 1 Kiri Luar" before "Steer 1 Kanan" and
    // break the correspondence with every other screen (PLAN/03 §1).
    const rows = groupPhotosByPosition([
      photo("c", DRIVE_LEFT),
      photo("a", STEER_LEFT),
      photo("b", STEER_RIGHT),
    ]);

    expect(rows.map((row) => row.label)).toEqual([
      "Steer 1 Kiri",
      "Steer 1 Kanan",
      "Drive 1 Kiri Luar",
    ]);
  });

  it("puts whole-vehicle shots first, labelled by their slot", () => {
    // A photograph with no tire position is a front or side view of the vehicle,
    // not a stray to be dropped.
    const rows = groupPhotosByPosition([
      photo("tire", STEER_LEFT),
      photo("front", null, "front_rear"),
      photo("side", null, "side"),
    ]);

    expect(rows[0]?.label).toBe("Tampak Depan / Belakang");
    expect(rows[1]?.label).toBe("Tampak Samping");
    expect(rows[2]?.label).toBe("Steer 1 Kiri");
  });

  it("numbers the general slots separately from each other", () => {
    const rows = groupPhotosByPosition([
      photo("f1", null, "front_rear"),
      photo("f2", null, "front_rear"),
      photo("s1", null, "side"),
    ]);

    expect(rows.map((row) => row.index)).toEqual([1, 2, 1]);
  });

  it("carries the position code, so a row can be matched to a specification", () => {
    const rows = groupPhotosByPosition([photo("a", STEER_LEFT)]);
    expect(rows[0]?.positionCode).toBe("STEER_1_L");
  });

  it("leaves the code empty for a whole-vehicle shot rather than inventing one", () => {
    const rows = groupPhotosByPosition([photo("front", null, "front_rear")]);
    expect(rows[0]?.positionCode).toBe("");
  });

  it("drops nothing", () => {
    const input = [
      photo("a", STEER_LEFT),
      photo("b", null, "side"),
      photo("c", DRIVE_LEFT),
      photo("d", STEER_LEFT),
    ];

    expect(groupPhotosByPosition(input)).toHaveLength(input.length);
    expect(groupPhotosByPosition(input).map((row) => row.storageKey).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("returns nothing for an inspection with no photographs", () => {
    expect(groupPhotosByPosition([])).toEqual([]);
  });

  it("does not reorder the caller's array", () => {
    const input = [photo("c", DRIVE_LEFT), photo("a", STEER_LEFT)];
    groupPhotosByPosition(input);

    expect(input.map((row) => row.storageKey)).toEqual(["c", "a"]);
  });
});
