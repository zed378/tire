import { expect, test, type Page } from "@playwright/test";

/**
 * CI gate G-11: the QC flow end to end (PLAN/09 §5).
 *
 * This is the path that crosses every module, and the one defect list D-01,
 * D-02, D-10, and D-11 all sit on. No unit test spans it.
 *
 * It runs against the seeded demo data, which is why the seed covers every
 * status rather than just one pending row.
 *
 * PLAY WITH CARE: these tests exercise the same envelope contract the client
 * relies on, so a change to `PLAN/05` §2 should break them loudly.
 */

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "";

async function signIn(page: Page, username: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("User ID").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test.skip(PASSWORD === "", "SEED_DEMO_PASSWORD is required to run the end-to-end flow");

test.describe("Login", () => {
  test("rejects wrong credentials with a banner, not a browser dialog", async ({ page }) => {
    // D-08: the legacy system reported failures through alert(), which could not
    // be logged, monitored, or tested. Everything here is a rendered element.
    await page.goto("/login");
    await page.getByLabel("User ID").fill("supplier1");
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Masuk" }).click();

    await expect(page.getByRole("alert")).toContainText("User ID atau Password salah");
  });

  test("gives the same message for an unknown user", async ({ page }) => {
    // PLAN/04 §4.3: distinguishing the two tells an attacker which usernames
    // exist.
    await page.goto("/login");
    await page.getByLabel("User ID").fill("tidak-ada-user-ini");
    await page.getByLabel("Password").fill("whatever-value-here");
    await page.getByRole("button", { name: "Masuk" }).click();

    await expect(page.getByRole("alert")).toContainText("User ID atau Password salah");
  });

  test("has no demo login shortcut anywhere on the page", async ({ page }) => {
    // D-16. The legacy login page carried three buttons that authenticated as
    // Supplier, Admin, or PM/SPV with no credentials at all.
    await page.goto("/login");
    const content = (await page.content()).toLowerCase();

    expect(content).not.toContain("login sebagai");
    expect(content).not.toContain("demo");

    // The only button that submits credentials is the real one. This used to
    // assert that the page held exactly one button at all, which passed for the
    // wrong reason: the theme switch beside it was a `<span tabIndex={0}>` and
    // so was invisible to `getByRole("button")`. Counting every button on the
    // page made an accessibility defect look like a security property, and it
    // would have failed the moment that span became the button it should have
    // been. What D-16 actually forbids is a control that signs someone in
    // without credentials, so that is what is asserted.
    await expect(page.getByRole("button", { name: /login sebagai|masuk sebagai/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Masuk" })).toHaveCount(1);
  });
});

test.describe("Supplier visibility", () => {
  test("a supplier sees their own inspections and the reason for a revision", async ({ page }) => {
    // D-10: until now a supplier submitted and went blind — no list, no status,
    // no notification — so every Pass or Drop was chased by phone.
    await signIn(page, "supplier1");

    await expect(page).toHaveURL(/\/inspections/);
    await expect(page.getByText(/SN\d{4}-\d{5}/).first()).toBeVisible();
    await expect(page.getByText("Perlu Revisi").first()).toBeVisible();

    // D-11: the reason travels with the row, not hidden behind a detail page.
    await expect(page.getByText(/terlalu gelap|buram/i).first()).toBeVisible();
  });

  test("a supplier cannot reach the QC queue", async ({ page }) => {
    await signIn(page, "supplier1");
    await page.goto("/qc");

    // The route guard sends them back; the server would refuse regardless.
    await expect(page).toHaveURL(/\/inspections/);
  });
});

test.describe("QC queue", () => {
  test("the filters actually change the result", async ({ page }) => {
    // D-01: in the legacy system the filters were rendered but never wired to
    // the data. A date range of 2020 still returned a 2026 record, and the three
    // counters above never moved.
    await signIn(page, "admin1");
    await page.goto("/qc");

    const pendingCount = await page.getByText(/SN\d{4}-\d{5}/).count();

    await page.getByLabel("Status").selectOption("dropped_qc");
    await expect(async () => {
      const droppedCount = await page.getByText(/SN\d{4}-\d{5}/).count();
      expect(droppedCount).not.toBe(pendingCount);
    }).toPass({ timeout: 10_000 });
  });

  test("the queue shows a work list, not just three numbers", async ({ page }) => {
    // D-02: the legacy card was titled "Riwayat" and contained no table at all.
    await signIn(page, "admin1");
    await page.goto("/qc");

    await expect(page.getByText("Antrean kerja")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tinjau" }).first()).toBeVisible();
  });
});

test.describe("QC decision", () => {
  test("a revision without a reason is refused", async ({ page }) => {
    // V-14. Without a written reason D-11 is only half solved: the supplier
    // learns they were rejected but not what to fix.
    await signIn(page, "admin1");
    await page.goto("/qc");
    await page.getByRole("button", { name: "Tinjau" }).first().click();

    await page.getByRole("radio", { name: /Kembalikan untuk Revisi/ }).check();
    await page.getByRole("button", { name: "Simpan Keputusan" }).click();

    await expect(page.getByText(/Alasan wajib diisi/)).toBeVisible();
  });

  test("a pass moves the inspection out of the pending queue", async ({ page }) => {
    await signIn(page, "admin1");
    await page.goto("/qc");

    const serialNumber = await page.getByText(/SN\d{4}-\d{5}/).first().innerText();
    await page.getByRole("button", { name: "Tinjau" }).first().click();

    await page.getByRole("radio", { name: /Pass QC/ }).check();
    await page.getByRole("button", { name: "Simpan Keputusan" }).click();

    await expect(page).toHaveURL(/\/qc$/);
    await expect(page.getByText(serialNumber.split(" ")[0] ?? "")).toHaveCount(0);
  });
});

test.describe("Error presentation", () => {
  test("a 404 renders in the application, never as a raw response", async ({ page }) => {
    await signIn(page, "admin1");
    await page.goto("/inspections/SN2099-99999");

    await expect(page.getByRole("alert")).toContainText(/tidak ditemukan/i);
  });
});
