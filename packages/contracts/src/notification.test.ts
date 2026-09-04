import { describe, expect, it } from "vitest";
import { EVENT_TYPES, type EventType } from "./constants.ts";
import { NOTIFICATION_TEMPLATES, renderTemplate } from "./notification.ts";

/**
 * What a notification promises to say, and what has to be supplied for it.
 *
 * An admin received "Pengajuan baru menunggu QC — () dari  masuk antrean QC."
 * Every placeholder had rendered as an empty string, because the outbox event
 * carried only the inspection's id and the two statuses while the template asks
 * for its serial number, its plate and the supplier's name. `renderTemplate`
 * substitutes `""` for anything it is not given, so the failure was silent all
 * the way to the screen.
 *
 * The same missing `serialNumber` also left the notification with no link, so it
 * could not be clicked through to the inspection it was about.
 *
 * These tests pin the contract between a template and its producer: what a
 * template asks for is what a publisher must send.
 */

/** `{{serialNumber}}` → `serialNumber`. */
function placeholdersIn(template: string): string[] {
  return [...template.matchAll(/\{\{(\w+)\}\}/g)].map((match) => String(match[1]));
}

function placeholdersFor(eventType: EventType): string[] {
  const template = NOTIFICATION_TEMPLATES[eventType];
  return [...new Set([...placeholdersIn(template.title), ...placeholdersIn(template.body)])];
}

/**
 * The fields `transitionInspection` publishes for an inspection event.
 *
 * Mirrored here deliberately. If a template starts asking for something this
 * list does not have, the test below fails and names it — which is the moment to
 * add it to the payload, not after somebody reads empty parentheses.
 */
const INSPECTION_EVENT_PAYLOAD = [
  "inspectionId",
  "serialNumber",
  "plateDisplay",
  "supplierName",
  "statusBefore",
  "statusAfter",
  "notes",
];

describe("every event type has a template", () => {
  it("covers all of EVENT_TYPES, with nothing blank", () => {
    for (const eventType of EVENT_TYPES) {
      const template = NOTIFICATION_TEMPLATES[eventType];
      expect(template.title.trim(), eventType).not.toBe("");
      expect(template.body.trim(), eventType).not.toBe("");
    }
  });
});

describe("an inspection notification asks only for what is published", () => {
  it("every placeholder is a field the transition sends", () => {
    const inspectionEvents = EVENT_TYPES.filter((type) => type.startsWith("inspection."));
    expect(inspectionEvents.length).toBeGreaterThan(0);

    for (const eventType of inspectionEvents) {
      for (const placeholder of placeholdersFor(eventType)) {
        expect(INSPECTION_EVENT_PAYLOAD, `${eventType} asks for {{${placeholder}}}`).toContain(
          placeholder,
        );
      }
    }
  });

  it("names the inspection, which is what makes it worth reading", () => {
    // The body without a serial number is "() dari  masuk antrean QC." — the
    // exact string that was shown to an admin.
    for (const eventType of EVENT_TYPES.filter((type) => type.startsWith("inspection."))) {
      expect(placeholdersFor(eventType), eventType).toContain("serialNumber");
    }
  });
});

describe("renderTemplate", () => {
  it("fills every placeholder when given the whole payload", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES["inspection.submitted"].body, {
      serialNumber: "SN2026-00001",
      plateDisplay: "A1234BC",
      supplierName: "Zawawi",
    });

    expect(rendered).toBe("SN2026-00001 (A1234BC) dari Zawawi masuk antrean QC.");
    expect(rendered).not.toContain("{{");
  });

  it("leaves an empty string for a value it was not given", () => {
    // Documented rather than approved of. It is why the defect was silent, and
    // it is the reason the contract above is asserted instead.
    expect(renderTemplate("{{a}}-{{b}}", { a: "x" })).toBe("x-");
  });

  it("accepts numbers, which is what a row count arrives as", () => {
    expect(renderTemplate("{{rowCount}} baris", { rowCount: 42 })).toBe("42 baris");
  });

  it("leaves text that merely looks like a placeholder alone", () => {
    expect(renderTemplate("{{ spaced }}", { spaced: "x" })).toBe("{{ spaced }}");
  });
});
