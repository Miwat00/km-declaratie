import { test, expect, seed, DEFAULT_SEED, ADDRESSES, fakeRouteKm, locationOf, visible } from "./fixtures";
import type { Page } from "@playwright/test";

const nl = (n: number) => n.toFixed(1).replace(".", ",");
const storedTrips = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("kilometer_trips") ?? "[]"));

async function fillTripDetails(page: Page, purpose: string, client: string) {
  const form = page.locator("#trip-form");
  await form.getByLabel("Waar was de rit voor?").fill(purpose);
  await form.getByLabel("Klant / project").fill(client);
  await form.getByRole("group", { name: "Factureerbaar?" }).getByRole("button", { name: "Nee" }).click();
}

test("rit heen en terug toevoegen met de snelknoppen", async ({ page }) => {
  await seed(page, DEFAULT_SEED);
  const form = page.locator("#trip-form");
  const km = fakeRouteKm(ADDRESSES.home, ADDRESSES.office);

  await form.getByRole("button", { name: "Thuis" }).first().click();
  await form.getByRole("button", { name: "Kantoor" }).nth(1).click();
  await expect(form.getByLabel("Afstand")).toHaveValue(nl(km));

  await fillTripDetails(page, "Teamoverleg", "Intern");
  await form.getByLabel("Heen en terug").check();
  await form.getByRole("button", { name: "Heen + terug toevoegen" }).click();

  await expect.poll(async () => (await storedTrips(page)).length).toBe(2);
  const trips = await storedTrips(page);
  expect(trips.map((t: { distanceKm: number }) => t.distanceKm)).toEqual([km, km]);
  expect(trips[0]).toMatchObject({ name: "Sam Tester", purpose: "Teamoverleg", rate: 0.23, billable: false });
  await expect(visible(page.getByText(nl(km * 2), { exact: false })).first()).toBeVisible();

  // Formulier is weer leeg voor de volgende rit
  await expect(form.getByLabel("Waar was de rit voor?")).toHaveValue("");
});

test("afstand zelf invullen als de routeservice niet werkt", async ({ page, map }) => {
  await seed(page, DEFAULT_SEED);
  map.failRouting();
  const form = page.locator("#trip-form");

  await form.getByRole("button", { name: "Thuis" }).first().click();
  await form.getByRole("button", { name: "Kantoor" }).nth(1).click();
  await expect(form.getByText("Route niet gevonden. Vul de afstand zelf in.")).toBeVisible();

  const submit = form.getByRole("button", { name: "Rit toevoegen" });
  await fillTripDetails(page, "Omleiding", "Intern");
  await expect(submit).toBeDisabled();

  await form.getByLabel("Afstand").fill("12,");
  await expect(form.getByText("Vul een afstand in, bijv. 12,5")).toBeVisible();
  await expect(submit).toBeDisabled();

  await form.getByLabel("Afstand").fill("81,5");
  await submit.click();
  await expect.poll(async () => (await storedTrips(page)).map((t: { distanceKm: number }) => t.distanceKm)).toEqual([81.5]);
});

test("rit bewerken, per maand filteren en als gedeclareerd markeren", async ({ page }, testInfo) => {
  const trip = (id: string, date: string, purpose: string) => ({
    id, date, name: "Sam Tester", purpose, client: "Intern", billable: false,
    locationA: locationOf(ADDRESSES.home), locationB: locationOf(ADDRESSES.office),
    distanceKm: 78.6, rate: 0.23, amount: 18.08,
  });
  await seed(page, { ...DEFAULT_SEED, trips: [trip("nov", "2026-11-02", "November-rit"), trip("okt", "2026-10-12", "Oktober-rit")] });

  // Bewerken: mobiel tik je op het kaartje, desktop gebruikt het potlood
  if (testInfo.project.name === "mobiel") {
    await visible(page.getByText("Oktober-rit")).first().click();
  } else {
    await page.getByRole("row", { name: /Oktober-rit/ }).getByRole("button", { name: "Rit bewerken" }).click();
  }
  const form = page.locator("#trip-form");
  await expect(form.getByRole("heading", { name: "Rit bewerken" })).toBeVisible();
  await expect(form.getByLabel("Afstand")).toHaveValue("78,6");
  await form.getByLabel("Waar was de rit voor?").fill("Oktober-rit (aangepast)");
  await form.getByLabel("Afstand").fill("80");
  await form.getByRole("button", { name: "Wijzigingen opslaan" }).click();
  await expect(form.getByRole("heading", { name: "Nieuwe rit toevoegen" })).toBeVisible();

  let trips = await storedTrips(page);
  expect(trips.find((t: { id: string }) => t.id === "okt")).toMatchObject({
    purpose: "Oktober-rit (aangepast)", distanceKm: 80, rate: 0.23, amount: 18.4,
  });

  // Alleen oktober tonen en als gedeclareerd markeren
  await page.getByLabel("Maand").selectOption("2026-10");
  await expect(visible(page.getByText("November-rit"))).toHaveCount(0);
  await page.getByRole("button", { name: "Markeer alles als gedeclareerd" }).click();

  trips = await storedTrips(page);
  expect(trips.find((t: { id: string }) => t.id === "okt").declaredAt).toBeTruthy();
  expect(trips.find((t: { id: string }) => t.id === "nov").declaredAt).toBeUndefined();

  // "Nog te declareren" over alle maanden toont alleen november
  await page.getByLabel("Maand").selectOption("all");
  await page.getByLabel("Status").selectOption("open");
  await expect(visible(page.getByText("November-rit")).first()).toBeVisible();
  await expect(visible(page.getByText("Oktober-rit (aangepast)"))).toHaveCount(0);
});
