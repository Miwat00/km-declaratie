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
  await page.clock.setFixedTime(new Date("2026-11-11T10:00:00+01:00"));
  await seed(page, { ...DEFAULT_SEED, trips: [trip, { ...trip, id: "2", declaredAt: undefined, billable: false }] });
  await expect(page.getByRole("heading", { name: "Kilometers" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("rit toevoegen-paneel en declareren", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T10:00:00+01:00"));
  await seed(page, { ...DEFAULT_SEED, trips: [{ ...trip, declaredAt: undefined }] });
  await page.getByRole("button", { name: "Declareren" }).click();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "Rit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Rit toevoegen" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Ritten uit je agenda" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("weekweergave van de agenda-import", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
  await seed(page, DEFAULT_SEED, "/agenda");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT", "UID:a", "SUMMARY:Kantoordag", "DTSTART:20261102T080000Z", "DTEND:20261102T160000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b", "SUMMARY:Lunch", "DTSTART:20261103T110000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c", "SUMMARY:Sync", "DTSTART:20261104T080000Z", "LOCATION:Teams", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  await page.locator("input[type=file]").setInputFiles({ name: "a.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  await expect(page.getByRole("button", { name: "Week eerder" })).toBeVisible();
  await expect(page.getByText("Afstanden berekenen")).toHaveCount(0);
  await expectNoSeriousViolations(page);
});
