/** Test for V-14 (PLAN/03 §4): a reason is mandatory on drop and revision. */

import { describe, expect, it } from "vitest";
import { qcDecisionSchema } from "./qc.ts";

const pathsFor = (input: unknown): string[] => {
  const result = qcDecisionSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("V-14: drop and revision require a written reason", () => {
  it.each(["drop", "revision"] as const)("rejects %s with no notes at all", (decision) => {
    expect(pathsFor({ decision })).toContain("notes");
  });

  it.each(["drop", "revision"] as const)("rejects %s with notes shorter than 10 characters", (decision) => {
    expect(pathsFor({ decision, notes: "buram" })).toContain("notes");
  });

  it.each(["drop", "revision"] as const)("rejects %s with only whitespace", (decision) => {
    expect(pathsFor({ decision, notes: "              " })).toContain("notes");
  });

  it.each(["drop", "revision"] as const)("accepts %s with a real reason", (decision) => {
    expect(
      qcDecisionSchema.safeParse({
        decision,
        notes: "Foto posisi Drive 1 Kanan Luar buram, tolong diambil ulang.",
      }).success,
    ).toBe(true);
  });

  it("does not demand notes for a pass", () => {
    expect(qcDecisionSchema.safeParse({ decision: "pass" }).success).toBe(true);
  });

  it("tells a revision reviewer that the supplier will read the reason", () => {
    // D-11 is only half solved if the supplier learns they were rejected but not
    // what to fix; the message says so to the person writing it.
    const result = qcDecisionSchema.safeParse({ decision: "revision", notes: "buram" });
    const message = result.success ? "" : (result.error.issues[0]?.message ?? "");
    expect(message).toContain("supplier");
  });

  it("rejects an unknown decision value", () => {
    expect(qcDecisionSchema.safeParse({ decision: "maybe" }).success).toBe(false);
  });

  it("accepts per-photo comments alongside the decision", () => {
    expect(
      qcDecisionSchema.safeParse({
        decision: "revision",
        notes: "Dua posisi perlu difoto ulang, keterangan ada di komentar.",
        comments: [{ photoId: 12, body: "Terlalu gelap." }],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty comment body", () => {
    expect(
      qcDecisionSchema.safeParse({
        decision: "revision",
        notes: "Perlu perbaikan pada beberapa foto.",
        comments: [{ photoId: 12, body: "   " }],
      }).success,
    ).toBe(false);
  });
});
