/**
 * Tests for the status machine (PLAN/03 §7.1).
 *
 * The transitions that must NOT exist get as much attention as the ones that
 * must, because "silently does nothing" was the legacy failure mode: clicking
 * Submit Keputusan QC without a status left no trace of any kind.
 */

import { describe, expect, it } from "vitest";
import { INSPECTION_STATUSES } from "./constants.ts";
import {
  DECISION_TO_STATUS,
  isFinal,
  isValidTransition,
  transitionsFor,
  transitionsFrom,
} from "./status-machine.ts";

describe("PLAN/03 §7.1 — permitted transitions", () => {
  it.each([
    ["draft", "pending_qc"],
    ["pending_qc", "passed_qc"],
    ["pending_qc", "needs_revision"],
    ["pending_qc", "dropped_qc"],
    ["needs_revision", "pending_qc"],
    ["passed_qc", "pending_qc"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it("defines exactly six transitions and no more", () => {
    const all = INSPECTION_STATUSES.flatMap((from) =>
      INSPECTION_STATUSES.filter((to) => isValidTransition(from, to)),
    );
    expect(all).toHaveLength(6);
  });
});

describe("PLAN/03 §7.1 — transitions that must not exist", () => {
  it.each(INSPECTION_STATUSES)("refuses dropped_qc -> %s: rejected means finished", (to) => {
    expect(isValidTransition("dropped_qc", to)).toBe(false);
  });

  it("refuses passed_qc -> dropped_qc directly", () => {
    // Reversing a decision must pass back through pending_qc so the history
    // records two events instead of one overwrite.
    expect(isValidTransition("passed_qc", "dropped_qc")).toBe(false);
  });

  it("refuses passed_qc -> needs_revision directly", () => {
    expect(isValidTransition("passed_qc", "needs_revision")).toBe(false);
  });

  it.each(INSPECTION_STATUSES)("refuses %s -> draft: a draft exists only before the first send", (from) => {
    expect(isValidTransition(from, "draft")).toBe(false);
  });

  it("refuses a status changing to itself", () => {
    for (const status of INSPECTION_STATUSES) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it("treats dropped_qc as final", () => {
    expect(isFinal("dropped_qc")).toBe(true);
    expect(isFinal("pending_qc")).toBe(false);
  });
});

describe("PLAN/03 §7.1 — who may make each transition", () => {
  it("lets only a supplier submit a draft", () => {
    expect(transitionsFor("draft", "supplier").map((t) => t.to)).toEqual(["pending_qc"]);
    expect(transitionsFor("draft", "admin")).toHaveLength(0);
  });

  it("lets only an admin decide on a pending inspection", () => {
    expect(transitionsFor("pending_qc", "admin").map((t) => t.to).sort()).toEqual([
      "dropped_qc",
      "needs_revision",
      "passed_qc",
    ]);
    expect(transitionsFor("pending_qc", "supplier")).toHaveLength(0);
  });

  it("gives an operator no transition at all", () => {
    // PLAN/10 §2.1: an operator maintains the system, they do not make business
    // decisions inside it. If they could, the audit trail would stop being
    // evidence — and evidence is why D-15 is being fixed.
    for (const status of INSPECTION_STATUSES) {
      expect(transitionsFor(status, "operator")).toHaveLength(0);
    }
  });

  it("gives a manager no transition at all: reporting is read-only", () => {
    for (const status of INSPECTION_STATUSES) {
      expect(transitionsFor(status, "manager")).toHaveLength(0);
    }
  });

  it("marks supplier transitions as owner-only", () => {
    expect(transitionsFrom("draft").every((t) => t.ownerOnly)).toBe(true);
    expect(transitionsFrom("needs_revision").every((t) => t.ownerOnly)).toBe(true);
  });
});

describe("PLAN/03 §7 — QC decision mapping", () => {
  it("maps each decision to the status it produces", () => {
    expect(DECISION_TO_STATUS).toEqual({
      pass: "passed_qc",
      drop: "dropped_qc",
      revision: "needs_revision",
    });
  });

  it("keeps every decision target reachable from pending_qc", () => {
    for (const target of Object.values(DECISION_TO_STATUS)) {
      expect(isValidTransition("pending_qc", target)).toBe(true);
    }
  });
});
