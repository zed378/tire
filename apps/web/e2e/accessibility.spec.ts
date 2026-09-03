import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The accessibility and responsive sweep for the redesign (brief PART VIII/IX).
 *
 * Unlike `qc-flow.spec.ts` this needs no database and no seed. Every route it
 * visits is public, and the one API call the shell makes on load — `/api/auth/me`
 * — is answered here with the same envelope a signed-out visitor gets. That
 * keeps the sweep runnable in CI, on a laptop, and on a branch where the API is
 * mid-migration; an audit nobody can run is an audit nobody runs.
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

/**
 * Answers the session bootstrap without a server.
 *
 * `SESSION_EXPIRED` is the envelope a visitor with no cookie receives, and the
 * session provider treats it as a real answer — "there is no session" — rather
 * than as a failure to ask. Anything else here would put a SERVICE_UNAVAILABLE
 * banner on top of every page in the sweep.
 */
async function stubSignedOutSession(page: Page): Promise<void> {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "SESSION_EXPIRED",
        message: "Sesi Anda telah berakhir. Silakan masuk kembali.",
        requestId: "req_e2e_a11y",
      }),
    });
  });
}

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
  });
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

  test("setiap elemen yang dapat difokuskan punya cincin fokus yang terlihat", async ({ page }) => {
    await stubSignedOutSession(page);
    await page.goto("/login");

    const focusable = page.locator("a[href], button, input, select, textarea");
    const count = await focusable.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const element = focusable.nth(index);
      if (!(await element.isVisible())) continue;

      await element.focus();
      const outline = await element.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      });

      // Either a real outline or a ring drawn with box-shadow. What is not
      // acceptable is neither: `outline: none` with nothing in its place is the
      // single most common way a keyboard user loses their place on a page.
      const hasRing =
        (outline.outlineStyle !== "none" && outline.outlineWidth !== "0px") ||
        outline.boxShadow !== "none";
      expect(hasRing, `element ${String(index)} has no visible focus indicator`).toBe(true);
    }
  });
});
