import AxeBuilder from "@axe-core/playwright";
import { test, expect, seed, DEFAULT_SEED, ADDRESSES, locationOf } from "./fixtures";
import type { Page } from "@playwright/test";

/** Toegankelijkheidscontrole met axe-core: geen ernstige of kritieke problemen (WCAG 2.1 A/AA). */
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}×) → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)
  ).toEqual([]);
}

const trip = {
  id: "1", date: "2026-11-02", name: "Sam Tester", purpose: "Teamoverleg", client: "Intern", billable: true,
  locationA: locationOf(ADDRESSES.home), locationB: locationOf(ADDRESSES.office),
  distanceKm: 78.6, rate: 0.23, amount: 18.08, declaredAt: "2026-11-05",
};

test("hoofdpagina met ritten", async ({ page }) => {
  await seed(page, { ...DEFAULT_SEED, trips: [trip, { ...trip, id: "2", declaredAt: undefined, billable: false }] });
  await expect(page.locator("#trip-form")).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("instellingenvenster", async ({ page }) => {
  await seed(page, DEFAULT_SEED);
  await page.getByRole("button", { name: "Instellingen" }).click();
  await expect(page.getByRole("dialog", { name: "Instellingen" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("agenda-import", async ({ page }) => {
  await seed(page, DEFAULT_SEED, "/agenda");
  await expect(page.getByRole("heading", { name: "Agenda importeren" })).toBeVisible();
  await expectNoSeriousViolations(page);
});
