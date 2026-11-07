import { test, expect, seed, DEFAULT_SEED, ADDRESSES, fakeRouteKm, locationOf } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Trip } from "@/lib/types";

const nl = (n: number) => n.toFixed(1).replace(".", ",");
const storedTrips = (page: Page): Promise<Trip[]> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("kilometer_trips") ?? "[]"));

const HOME = locationOf(ADDRESSES.home);
const OFFICE = locationOf(ADDRESSES.office);
const CLIENT = locationOf(ADDRESSES.client);
const trip = (id: string, date: string, from = HOME, to = OFFICE, km = 46, over: Partial<Trip> = {}): Trip => ({
  id, date, name: "Sam Tester", purpose: "Kantoordag", client: "Voorbeeld BV", billable: false,
  locationA: from, locationB: to, distanceKm: km, rate: 0.23, amount: Math.round(km * 23) / 100, ...over,
});
const roundTrip = (date: string, km = 46) => [trip(`${date}-a`, date, HOME, OFFICE, km), trip(`${date}-b`, date, OFFICE, HOME, km)];

test.beforeEach(async ({ page }) => {
  // Woensdag 11 november 2026
  await page.clock.setFixedTime(new Date("2026-11-11T10:00:00+01:00"));
});

test("eerste rit: heen en terug toevoegen en ongedaan maken", async ({ page }) => {
  await seed(page, DEFAULT_SEED);
  await expect(page.getByRole("heading", { name: "Hoe wil je beginnen?" })).toBeVisible();
  await page.getByRole("button", { name: /^Voeg een rit toe/ }).click();

  const form = page.getByRole("form", { name: "Rit toevoegen" });
  await expect(form.getByLabel("Naam")).toHaveValue("Sam Tester");
  await expect(form.getByRole("combobox", { name: "Van" })).toHaveValue("Dam 1, Amsterdam");
  await form.getByRole("button", { name: "Kantoor" }).nth(1).click(); // bij "Naar"
  const km = fakeRouteKm(ADDRESSES.home, ADDRESSES.office);
  await expect(form.getByLabel("Afstand")).toHaveValue(nl(km));
  await form.getByLabel("Waarvoor?").fill("Teamoverleg");
  await expect(form.getByLabel("Heen en terug")).toBeChecked();
  await form.getByRole("button", { name: "Heen en terug toevoegen" }).click();

  await expect(page.getByRole("button", { name: /Thuis ⇄ Kantoor/ })).toBeVisible();
  const trips = await storedTrips(page);
  expect(trips.map((t) => [t.date, t.name, t.purpose, t.distanceKm, t.billable])).toEqual([
    ["2026-11-11", "Sam Tester", "Teamoverleg", km, false],
    ["2026-11-11", "Sam Tester", "Teamoverleg", km, false],
  ]);

  const toast = page.getByRole("status").filter({ hasText: "Heen en terug toegevoegd" });
  await toast.getByRole("button", { name: "Ongedaan maken" }).click();
  expect(await storedTrips(page)).toEqual([]);
});

test("afstand zelf invullen als de routeservice niet werkt", async ({ page, map }) => {
  await seed(page, DEFAULT_SEED);
  map.failRouting();
  await page.getByRole("button", { name: /^Voeg een rit toe/ }).click();
  const form = page.getByRole("form", { name: "Rit toevoegen" });
  await form.getByRole("button", { name: "Kantoor" }).nth(1).click();
  await expect(form.getByText("Route niet gevonden. Vul de afstand zelf in.")).toBeVisible();
  await form.getByLabel("Waarvoor?").fill("Omleiding");

  const submit = form.getByRole("button", { name: "Heen en terug toevoegen" });
  await form.getByLabel("Afstand").fill("12,");
  await expect(form.getByText("Vul een afstand in, bijv. 12,5")).toBeVisible();
  await expect(submit).toBeDisabled();

  await form.getByLabel("Afstand").fill("81,5");
  await submit.click();
  await expect.poll(async () => (await storedTrips(page)).map((t) => t.distanceKm)).toEqual([81.5, 81.5]);
});

test("vaak gereden route met één tik, met eigen naam", async ({ page }) => {
  await seed(page, { ...DEFAULT_SEED, trips: [...roundTrip("2026-11-02"), ...roundTrip("2026-11-05", 46.5)] });
  await page.getByRole("button", { name: "Rit", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Rit toevoegen" });
  await expect(panel.getByLabel("Naam")).toHaveValue("Sam Tester");
  await panel.getByLabel("Naam").fill("Collega Kim");
  await panel.getByRole("button", { name: /Thuis ⇄ Kantoor/ }).click();

  const added = (await storedTrips(page)).slice(4);
  expect(added.map((t) => `${t.date} ${t.name} ${t.distanceKm}`)).toEqual(["2026-11-11 Collega Kim 46.5", "2026-11-11 Collega Kim 46.5"]);
  // Twee namen in de maand: de lijst toont nu wie er reed
  await expect(page.getByText(/Collega Kim · Kantoordag/)).toBeVisible();
});

test("een rit bewerken en een reis verwijderen", async ({ page }) => {
  await seed(page, { ...DEFAULT_SEED, trips: [...roundTrip("2026-11-02"), trip("c1", "2026-11-03", HOME, CLIENT, 22, { purpose: "Kick-off" })] });

  await page.getByRole("button", { name: /Thuis ⇄ Kantoor/ }).click();
  await page.getByRole("button", { name: "Bewerken rit Kantoor naar Thuis" }).click();
  const form = page.getByRole("form", { name: "Rit bewerken" });
  await form.getByLabel("Afstand").fill("50");
  await form.getByLabel("Waarvoor?").fill("Kantoordag (omweg)");
  await form.getByRole("button", { name: "Opslaan" }).click();
  const edited = (await storedTrips(page)).find((t) => t.id === "2026-11-02-b")!;
  expect(edited).toMatchObject({ distanceKm: 50, purpose: "Kantoordag (omweg)", amount: 11.5, rate: 0.23 });

  await page.getByRole("button", { name: /Thuis → Jaarbeursplein 6/ }).click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  expect((await storedTrips(page)).map((t) => t.id)).not.toContain("c1");
  await page.getByRole("status").getByRole("button", { name: "Ongedaan maken" }).click();
  expect((await storedTrips(page)).map((t) => t.id)).toContain("c1");
});

test("declareren: versturen en de maand op gedeclareerd zetten", async ({ page }) => {
  await seed(page, { ...DEFAULT_SEED, trips: [...roundTrip("2026-10-30"), ...roundTrip("2026-11-02")] });
  const card = page.getByRole("region", { name: "Declaratie November 2026" });
  await expect(card.getByText("€ 21,16")).toBeVisible();
  await expect(card.getByText("nog niet gedeclareerd")).toBeVisible();

  await card.getByRole("button", { name: "Declareren" }).click();
  await card.getByLabel("Versturen naar").fill("administratie@voorbeeld.nl");
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(/^kilometer-declaratie-.*\.csv$/);

  await expect(card.getByText("gedeclareerd op 11-11-2026")).toBeVisible();
  const trips = await storedTrips(page);
  expect(trips.filter((t) => t.declaredAt).map((t) => t.date)).toEqual(["2026-11-02", "2026-11-02"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kilometer_settings")!).adminEmail)).toBe("administratie@voorbeeld.nl");

  // Ongedaan maken
  await page.getByRole("status").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(card.getByText("nog niet gedeclareerd")).toBeVisible();

  // Vorige maand staat er los van
  await page.getByRole("button", { name: "Vorige maand" }).click();
  await expect(page.getByRole("region", { name: "Declaratie Oktober 2026" }).getByText("nog niet gedeclareerd")).toBeVisible();
});

test("opent op vorige maand als die nog open staat en deze maand leeg is", async ({ page }) => {
  await seed(page, { ...DEFAULT_SEED, trips: roundTrip("2026-10-30") });
  await expect(page.getByRole("heading", { name: "Oktober 2026" })).toBeVisible();
});
