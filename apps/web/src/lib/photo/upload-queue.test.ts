import { describe, expect, it } from "vitest";
import { MAX_PHOTOS_PER_INSPECTION, MAX_PHOTOS_PER_SLOT } from "@c26/contracts";
import { quotaViolationFor } from "./upload-queue.ts";
import type { QueueItem } from "./queue-store.ts";

/**
 * V-13 on the device.
 *
 * The cap was enforced on the server at presign and nowhere here, so the queue
 * accepted whatever was selected. Each photograph past the tenth then failed
 * permanently with the server's own message and stayed on screen — which is how
 * a slot came to read `52/10` under a caption saying the maximum is ten, with
 * the file input hidden because the count was over the cap.
 *
 * The rule itself is not restated in these tests either. They check the
 * COUNTING — which photographs count towards which cap — because that is the
 * part `checkPhotoQuota` cannot know.
 */

function queued(
  overrides: Partial<Pick<QueueItem, "slot" | "tirePositionId" | "status">> = {},
): QueueItem {
  return {
    id: crypto.randomUUID(),
    serialNumber: "SN2026-00001",
    tirePositionId: 1,
    positionLabel: "Steer 1 Kanan",
    slot: "tire_position",
    blob: new Blob([]),
    mimeType: "image/webp",
    byteSize: 1,
    width: 1,
    height: 1,
    checksumSha256: "x",
    capturedAt: null,
    status: "pending",
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

const SLOT = {
  slot: "tire_position" as const,
  tirePositionId: 1,
  uploadedInSlot: 0,
  uploadedInInspection: 0,
};

describe("V-13: maksimal 10 foto per slot, dihitung di perangkat", () => {
  it("allows a photograph into an empty slot", () => {
    expect(quotaViolationFor(SLOT, [])).toBeNull();
  });

  it("counts what is already queued, not only what the server holds", () => {
    const almostFull = Array.from({ length: MAX_PHOTOS_PER_SLOT - 1 }, () => queued());
    expect(quotaViolationFor(SLOT, almostFull)).toBeNull();

    const full = [...almostFull, queued()];
    expect(quotaViolationFor(SLOT, full)?.message).toContain(String(MAX_PHOTOS_PER_SLOT));
  });

  it("counts the server's photographs and the queue together", () => {
    const six = Array.from({ length: 6 }, () => queued());
    expect(quotaViolationFor({ ...SLOT, uploadedInSlot: 3 }, six)).toBeNull();
    expect(quotaViolationFor({ ...SLOT, uploadedInSlot: 4 }, six)).not.toBeNull();
  });

  it("counts a failed photograph, because it is still occupying the slot", () => {
    // This is the case from the field report: ten failures filled the slot, and
    // nothing would let another photograph in until they were cleared.
    const failures = Array.from({ length: MAX_PHOTOS_PER_SLOT }, () =>
      queued({ status: "failed" }),
    );
    expect(quotaViolationFor(SLOT, failures)).not.toBeNull();
  });

  it("does not count a photograph the server has already taken", () => {
    // `done` items are counted by `uploadedInSlot`. Counting them twice would
    // refuse the eleventh photograph when only ten exist.
    const done = Array.from({ length: MAX_PHOTOS_PER_SLOT }, () => queued({ status: "done" }));
    expect(quotaViolationFor(SLOT, done)).toBeNull();
  });

  it("keeps each tire position's count separate", () => {
    const otherPosition = Array.from({ length: MAX_PHOTOS_PER_SLOT }, () =>
      queued({ tirePositionId: 2 }),
    );
    expect(quotaViolationFor(SLOT, otherPosition)).toBeNull();
  });

  it("keeps the two general slots separate from each other", () => {
    const side = Array.from({ length: MAX_PHOTOS_PER_SLOT }, () =>
      queued({ slot: "side", tirePositionId: null }),
    );
    const frontRear = { ...SLOT, slot: "front_rear" as const, tirePositionId: null };
    expect(quotaViolationFor(frontRear, side)).toBeNull();
  });

  it("refuses on the per-inspection cap even when the slot has room", () => {
    // PLAN/06 §6: 30 across the inspection. On a six-position vehicle this is
    // the ceiling that actually binds — ten per slot is never reached.
    const spread = Array.from({ length: MAX_PHOTOS_PER_INSPECTION }, (_, index) =>
      queued({ tirePositionId: index }),
    );
    const violation = quotaViolationFor(SLOT, spread);
    expect(violation?.message).toContain(String(MAX_PHOTOS_PER_INSPECTION));
  });
});
