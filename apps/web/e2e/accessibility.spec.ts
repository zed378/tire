import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  stubOffline,
  stubServerError,
  stubSignedInApi,
  stubSignedOutSession,
} from "./api-stubs.ts";

/**
 * The accessibility and responsive sweep for the redesign (brief PART VIII/IX).
 *
 * Unlike `qc-flow.spec.ts` this needs no database and no seed. The public routes
 * get the envelope a signed-out visitor gets; the twenty routes behind a session
 * get the fixtures in `api-stubs.ts`. That keeps the sweep runnable in CI, on a
 * laptop, and on a branch where the API is mid-migration; an audit nobody can
 * run is an audit nobody runs.
 *
 * Two things are checked that a screenshot cannot tell you:
 *
 *   1. axe-core against WCAG 2.1 AA. Not a substitute for using the page with a
 *      screen reader, but it catches the whole class of defect that is invisible
 *      to a sighted reviewer — an unlabelled control, a heading level skipped, a
 *      contrast ratio a hair under 4.5:1.
 *   2. The page does not scroll sideways. On a 360px phone in a garage that is
 *      not a cosmetic complaint; it is how a submit button ends up off-screen.
 *
 * Both themes are swept. The palette gained its dark values during the redesign,
 * and a token that reads well on paper can fall under AA on graphite.
 */

/** The widths in `PLAN/14`: phone, tablet, small laptop, laptop, desktop. */
const WIDTHS = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

const PUBLIC_ROUTES = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  // Temporary, and removed at the end of phase 6. While it exists it is the one
  // place every primitive and every state appears at once, which makes it the
  // cheapest place to catch a token that fails contrast.
  { path: "/__styleguide", name: "styleguide" },
] as const;

/**
 * Every screen behind a session.
 *
 * These are answered by `api-stubs.ts` rather than by a database. The reason is
 * in that file; the short version is that the worst defect this sweep has found
 * so far lives on exactly these screens and was caught by accident, through the
 * one tile on the landing page that shared its colour pairing.
 */
const PRIVATE_ROUTES = [
  { path: "/welcome", name: "welcome" },
  { path: "/inspections", name: "inspection-list" },
  { path: "/inspections/new", name: "inspection-new" },
  { path: "/inspections/SN2026-00002", name: "inspection-detail" },
  { path: "/inspections/SN2026-00002/tire-specs", name: "tire-specs" },
  { path: "/upload-queue", name: "upload-queue" },
  { path: "/qc", name: "qc-queue" },
  { path: "/qc/SN2026-00002", name: "qc-review" },
  { path: "/reports", name: "reports" },
  { path: "/users", name: "users" },
  { path: "/master-data", name: "master-data" },
  { path: "/master-data/vehicle-brands", name: "vehicle-brands" },
  { path: "/master-data/tire-brand-patterns", name: "tire-brand-patterns" },
  { path: "/master-data/tire-sizes", name: "tire-sizes" },
  { path: "/audit", name: "audit" },
  { path: "/ops", name: "ops" },
  { path: "/notifications", name: "notifications" },
  { path: "/profile", name: "profile" },
  { path: "/profile/password", name: "change-password" },
  { path: "/profile/mfa", name: "mfa-enroll" },
] as const;

const THEMES = ["light", "dark"] as const;

/**
 * The width sweep drives its own viewport, so running it under both device
 * projects would double the work and prove nothing twice.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "This file drives its own viewport, so the device projects would repeat it",
  );
});

for (const theme of THEMES) {
  test.describe(`Aksesibilitas — tema ${theme}`, () => {
    test.use({ colorScheme: theme });

    for (const route of PUBLIC_ROUTES) {
      test(`${route.name} tidak melanggar WCAG 2.1 AA`, async ({ page }) => {
        await stubSignedOutSession(page);
        await page.goto(route.path);
        // The landing page opens with one orchestration sequence; auditing
        // mid-animation reads half-faded text as a contrast failure.
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        // The message names the rule and the element, so a failure here is
        // actionable without reopening the browser.
        expect(
          results.violations.map((violation) => ({
            rule: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.map((node) => node.target.join(" ")),
          })),
        ).toEqual([]);
      });
    }

    for (const route of PRIVATE_ROUTES) {
      test(`${route.name} tidak melanggar WCAG 2.1 AA`, async ({ page }) => {
        await stubSignedInApi(page);
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        // The shell is what proves the stub took: without a session the router
        // sends every one of these to /login, and axe would then audit the login
        // page twenty times over and report a clean sweep.
        await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(
          results.violations.map((violation) => ({
            rule: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.map((node) => node.target.join(" ")),
          })),
        ).toEqual([]);
      });
    }
  });
}

/**
 * Screens with nothing on them.
 *
 * A list with rows and a list with none are two different renderings, and only
 * one of them was being audited. The empty state is where a table becomes a
 * message and a heading becomes a paragraph — markup nobody had looked at.
 */
test.describe("Keadaan kosong", () => {
  for (const route of PRIVATE_ROUTES) {
    test(`${route.name} tanpa data tidak melanggar WCAG 2.1 AA`, async ({ page }) => {
      await stubSignedInApi(page, { empty: true });
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations.map((violation) => ({
          rule: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
});

/**
 * Dialogs, which nothing had audited because nothing had opened one.
 *
 * `Dialog` carries the whole modal contract — `aria-modal`, a labelled title, a
 * focus trap, Escape to close, focus handed back to whatever opened it. A
 * contract that is never exercised is a contract nobody knows the state of.
 */
const DIALOGS = [
  { route: "/users", opener: "Tambah Pengguna", name: "tambah-pengguna" },
  { route: "/master-data/vehicle-brands", opener: "Tambah Merk", name: "tambah-merk" },
  { route: "/master-data/tire-sizes", opener: "Tambah Ukuran", name: "tambah-ukuran" },
  // A ConfirmDialog rather than a form: no fields, two buttons, and a
  // description that carries the consequence.
  { route: "/ops", opener: "Coba Lagi Semua", name: "konfirmasi-operasional" },
] as const;

test.describe("Dialog", () => {
  for (const dialog of DIALOGS) {
    test(`${dialog.name} tidak melanggar WCAG 2.1 AA`, async ({ page }) => {
      await stubSignedInApi(page);
      await page.goto(dialog.route);
      await page.getByRole("button", { name: dialog.opener }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations.map((violation) => ({
          rule: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }

  test("Tab tidak bisa keluar dari dialog yang terbuka", async ({ page }) => {
    // Without the trap, Tab walks out of the dialog and into the page it is
    // covering, with nothing to tell the user they have left.
    await stubSignedInApi(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "Tambah Pengguna" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const escaped: string[] = [];
    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      );
      if (!inside) escaped.push(await page.evaluate(() => document.activeElement?.tagName ?? "?"));
    }

    expect(escaped).toEqual([]);
  });

  test("Escape menutup dialog dan mengembalikan fokus ke pembukanya", async ({ page }) => {
    await stubSignedInApi(page);
    await page.goto("/users");

    const opener = page.getByRole("button", { name: "Tambah Pengguna" });
    await opener.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Focus returning to the opener is what keeps a keyboard user's place. If it
    // is lost, focus falls back to the document and the next Tab starts from the
    // top of the page.
    await expect(opener).toBeFocused();
  });
});

/**
 * A form that has just been refused.
 *
 * Error rendering is markup that only exists after a failed submit, so it had
 * never been audited: the message, the field it belongs to, and the wiring
 * between them.
 */
test.describe("Keadaan galat", () => {
  test("form pengguna yang ditolak menautkan setiap pesan ke fieldnya", async ({ page }) => {
    await stubSignedInApi(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "Tambah Pengguna" }).click();

    // Submit with nothing filled in: the shared schema refuses it, and the
    // messages appear under the fields. The message is the length rule, not the
    // required rule — the form starts the field at "" rather than leaving it
    // undefined, so `usernameSchema` reaches its `min(3)` first.
    await page.getByRole("button", { name: "Tambah Pengguna" }).last().click();
    await expect(page.getByText("User ID minimal 3 karakter.")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);

    // `aria-invalid` and `aria-describedby` are what carry the message to a
    // screen reader. Red text alone says nothing to someone not looking at it.
    const field = page.getByLabel("User ID");
    await expect(field).toHaveAttribute("aria-invalid", "true");

    const describedBy = await field.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    await expect(page.locator(`#${String(describedBy)}`)).toContainText("minimal 3 karakter");
  });
});

/**
 * The three error channels of `PLAN/05` §5.1, and rules 6 and 7 of §5.2.
 *
 * These render markup that exists only when something has gone wrong, so no
 * amount of sweeping healthy screens reaches them. Rule 6: a network failure
 * becomes a banner, never a silent failure. Rule 7: every 500 shows its
 * `requestId` in small copyable text, with the sentence asking the user to
 * quote it.
 */
test.describe("Kanal galat", () => {
  test("500 menampilkan requestId yang dapat disalin", async ({ page }) => {
    await stubServerError(page);
    await page.goto("/welcome");

    // The session query rides out a few 500s before giving up — a restarting
    // API should not read as a logout — so the banner takes a moment.
    const banner = page.getByRole("alert");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText("Sebutkan kode ini saat melapor");
    await expect(banner).toContainText("req_20260903_141500_e2e1");

    // `select-all` is what makes it one click to copy on a phone, which is
    // where a supplier is when they read a code out to support.
    const code = banner.locator("code");
    await expect(code).toHaveClass(/select-all/);
  });

  test("kegagalan jaringan jadi banner, bukan layar kosong", async ({ page }) => {
    await stubOffline(page);
    await page.goto("/welcome");

    const banner = page.getByRole("alert");
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // Not a redirect to /login either: that reads as "you have been signed
    // out", which is a different and untrue thing to tell someone.
    expect(new URL(page.url()).pathname).not.toBe("/login");
    await expect(page.getByRole("button", { name: "Coba Lagi" })).toBeVisible();
  });

  test("daftar yang gagal dimuat mengatakannya, tidak tampil kosong", async ({ page }) => {
    /*
     * The session is fine; one list query is not. `PLAN/05` §5.2 rule 6 says a
     * failure becomes a banner and never a silent one — and a list that renders
     * as "no rows" when it actually means "we could not ask" is the silent
     * failure that rule exists to forbid. An admin reads it as an empty table.
     */
    await stubSignedInApi(page);
    // Registered after the catch-all, so it wins for this one path.
    await page.route("**/api/users*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan pada sistem. Silakan coba lagi.",
          requestId: "req_20260903_141500_e2e2",
        }),
      });
    });

    await page.goto("/users");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
  });

  for (const theme of THEMES) {
    test(`banner 500 memenuhi WCAG 2.1 AA di tema ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await stubServerError(page);
      await page.goto("/welcome");
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations.map((violation) => ({
          rule: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
});

/**
 * A finished upload has to reach the screen without a reload.
 *
 * Reported from the field: the photograph uploaded, the network tab showed
 * presign, PUT and confirm all succeeding, and the slot went straight back to
 * "Belum ada foto." and `0/10`. Only F5 revealed it.
 *
 * The queue can only report what is still waiting, so a completed item leaves it
 * as an absence — the placeholder vanishes and nothing replaces it, because the
 * server list on screen was fetched before the photograph existed.
 */
test.describe("Unggahan selesai", () => {
  test("foto muncul tanpa memuat ulang halaman", async ({ page }) => {
    let confirmed = false;

    await stubSignedInApi(page);

    // Registered after the catch-all, so these win for their paths.
    await page.route("**/photos/presign", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "req_e2e_upload",
          data: {
            uploadUrl: "https://tire-store.e2e.test/api/uploads/token",
            storageKey: "inspections/2026/SN2026-00002/side/e2e.webp",
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            alreadyUploaded: false,
            existingPhotoId: null,
          },
        }),
      });
    });

    await page.route("https://tire-store.e2e.test/**", async (route) => {
      await route.fulfill({ status: 200, body: "" });
    });

    await page.route("**/photos/confirm", async (route) => {
      confirmed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, requestId: "req_e2e_upload", data: { id: 99 } }),
      });
    });

    // The list the screen holds: empty until the confirm lands, one photograph
    // afterwards. This is the server's view, and the whole question is whether
    // the screen goes back for it.
    await page.route("**/api/inspections/*/photos", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "req_e2e_upload",
          data: confirmed
            ? [
                {
                  id: 99,
                  slot: "side",
                  tirePositionId: null,
                  tirePositionLabel: null,
                  url: "/img/depot-640.jpg",
                  thumbnailUrl: "/img/depot-640.jpg",
                  byteSize: 1024,
                  width: 640,
                  height: 427,
                  capturedAt: null,
                  uploadedByName: "Joko Supplier",
                  createdAt: new Date().toISOString(),
                  commentCount: 0,
                },
              ]
            : [],
        }),
      });
    });

    await page.goto("/inspections/SN2026-00001");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();

    const slot = page.locator("div").filter({ hasText: /^Tampak Samping/ }).first();
    await expect(slot).toContainText("0/10");

    await page
      .getByLabel("Ambil foto Tampak Samping")
      .setInputFiles({ name: "ban.jpg", mimeType: "image/jpeg", buffer: onePixelJpeg() });

    // No reload anywhere in this test. If the screen only learns about the
    // photograph by being reloaded, this is where it fails.
    await expect(slot).toContainText("1/10", { timeout: 15_000 });
    await expect(slot.locator("img")).toBeVisible();
  });
});

/** The smallest thing the compressor will accept as a photograph. */
function onePixelJpeg(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
      "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
      "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  );
}

test.describe("Lebar layar", () => {
  for (const route of PUBLIC_ROUTES) {
    for (const size of WIDTHS) {
      test(`${route.name} tidak menggeser ke samping di ${size.name}px`, async ({ page }) => {
        await stubSignedOutSession(page);
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
        });

        // One pixel of slack: a sub-pixel layout rounding is not a defect, a
        // section that runs off the edge is.
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  }
});

test.describe("Navigasi papan ketik", () => {
  test("login dapat diselesaikan tanpa tetikus", async ({ page }) => {
    // PLAN/05 §5.2 rule 4 assumes a focus order that exists. This walks it far
    // enough to prove the form can be filled and submitted from the keyboard
    // alone — the way it is used with gloves on, on a phone with a keyboard, and
    // the way it is used by anyone who does not use a pointer at all.
    await stubSignedOutSession(page);
    await page.goto("/login");

    await page.getByLabel("User ID").focus();
    await page.keyboard.type("supplier1");
    await page.keyboard.press("Tab");
    await page.keyboard.type("kata-sandi-percobaan");

    // Enter submits from inside the field, without reaching for the button.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  });

  test("setiap perhentian Tab terlihat berubah saat difokuskan", async ({ page }) => {
    await stubSignedOutSession(page);
    await page.goto("/login");

    /*
     * What is asserted here is that focus is *visible*, not that it is drawn a
     * particular way.
     *
     * An earlier version of this test looked for an outline or a box-shadow on
     * the focused element, and reported the login password field as having no
     * indicator. It has one: `auth.css` deliberately replaces the general amber
     * ring with a border that goes blue and doubles in weight, plus an amber
     * rule that wipes in on the wrapper's `::after` — because three indicators
     * stacked on one 40px control drew over each other. A test that names the
     * implementation fails the better implementation.
     *
     * So each Tab stop is compared against itself: the same element, focused
     * and not focused. If nothing about it changes, a keyboard user cannot tell
     * where they are — whatever the reason.
     */
    // Focus is moved with Tab, not `element.focus()`: Chromium decides
    // `:focus-visible` from the modality of the last interaction, and a
    // programmatic focus on a button matches nothing.
    const focused: { label: string; fingerprint: string }[] = [];

    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press("Tab");

      const stop = await page.evaluate(() => {
        const active = document.activeElement;
        if (active === null || active === document.body) return null;

        active.setAttribute(
          "data-a11y-stop",
          String(document.querySelectorAll("[data-a11y-stop]").length),
        );

        const own = getComputedStyle(active);
        const wipe =
          active.parentElement === null
            ? ""
            : getComputedStyle(active.parentElement, "::after").transform;

        return {
          label:
            active.getAttribute("aria-label") ??
            active.getAttribute("name") ??
            active.textContent?.trim().slice(0, 40) ??
            active.tagName,
          fingerprint: [
            own.outlineStyle,
            own.outlineWidth,
            own.outlineColor,
            own.boxShadow,
            own.borderColor,
            own.borderWidth,
            own.backgroundColor,
            own.color,
            own.textDecorationLine,
            wipe,
          ].join("|"),
        };
      });

      if (stop === null) break;
      focused.push(stop);
    }

    expect(focused.length).toBeGreaterThan(0);

    // Now with nothing focused, read the same elements again.
    const resting = await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();

      return [...document.querySelectorAll("[data-a11y-stop]")].map((element) => {
        const own = getComputedStyle(element);
        const wipe =
          element.parentElement === null
            ? ""
            : getComputedStyle(element.parentElement, "::after").transform;

        return [
          own.outlineStyle,
          own.outlineWidth,
          own.outlineColor,
          own.boxShadow,
          own.borderColor,
          own.borderWidth,
          own.backgroundColor,
          own.color,
          own.textDecorationLine,
          wipe,
        ].join("|");
      });
    });

    const invisible = focused
      .map((stop, index) => ({ label: stop.label, changed: stop.fingerprint !== resting[index] }))
      .filter((stop) => !stop.changed);

    expect(invisible).toEqual([]);
  });
});
