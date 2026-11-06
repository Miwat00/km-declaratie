import { test, expect, seed, DEFAULT_SEED, ADDRESSES, fakeRouteKm, shortName } from "./fixtures";
import type { Page } from "@playwright/test";

// Week van maandag 2 t/m vrijdag 6 november 2026
const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0",
  "BEGIN:VEVENT", "UID:kantoor", "SUMMARY:Kantoordag",
  "DTSTART;TZID=W. Europe Standard Time:20261102T090000", "DTEND;TZID=W. Europe Standard Time:20261102T170000", "END:VEVENT",
  "BEGIN:VEVENT", "UID:workshop", "SUMMARY:Workshop bij klant",
  "DTSTART;TZID=W. Europe Standard Time:20261103T130000", "DTEND;TZID=W. Europe Standard Time:20261103T160000",
  "LOCATION:Jaarbeursplein 6\\, Utrecht", "END:VEVENT",
  "BEGIN:VEVENT", "UID:sync", "SUMMARY:Sync", "DTSTART:20261104T080000Z", "DTEND:20261104T083000Z",
  "LOCATION:Microsoft Teams Meeting", "END:VEVENT",
  "BEGIN:VEVENT", "UID:lunch", "SUMMARY:Lunch met Jan",
  "DTSTART;TZID=W. Europe Standard Time:20261105T120000", "DTEND;TZID=W. Europe Standard Time:20261105T133000", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const nl = (n: number) => n.toFixed(1).replace(".", ",");
const home = shortName(ADDRESSES.home);
const office = shortName(ADDRESSES.office);
const client = shortName(ADDRESSES.client);

async function openWeek(page: Page, ics = ICS) {
  // Vaste "vandaag", zodat de app op de week van 2 november opent
  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
  await seed(page, DEFAULT_SEED, "/agenda");
  await page.locator("input[type=file]").setInputFiles({ name: "agenda.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  await expect(page.getByRole("heading", { name: "2 nov – 6 nov" })).toBeVisible();
}

/** Op mobiel staat één dag in beeld; kies dan eerst de juiste dag-tab. */
async function showDay(page: Page, tab: string) {
  const t = page.getByRole("tab", { name: tab });
  if (await t.isVisible()) await t.click();
}

/** Ritblok in de week; de naam begint met "Rit" en bevat "<van> → <naar>" (bij korte ritten staat de afstand ervoor). */
const leg = (page: Page, from: string, to: string) =>
  page.getByRole("button", { name: new RegExp(`^Rit .*${from.split(",")[0]} → ${to.split(",")[0]}`) });

test("week controleren: koppelen, reisblok toevoegen en ritten toevoegen", async ({ page }) => {
  await openWeek(page);
  await expect(page.getByText("1 afspraak wacht op een locatie")).toBeVisible();

  // Maandag: kantoor gekoppeld via het trefwoord, met ritten ervoor en erna
  await showDay(page, "ma 2");
  await expect(leg(page, home, office)).toContainText(nl(fakeRouteKm(ADDRESSES.home, ADDRESSES.office)));
  await expect(leg(page, office, home)).toBeVisible();

  // Woensdag: Teams-afspraak levert geen rit op
  await showDay(page, "wo 4");
  await expect(page.getByRole("button", { name: /^Sync.*Online · geen rit/ })).toBeVisible();

  // Donderdag: lunch koppelen aan een adres en onthouden
  await showDay(page, "do 5");
  await page.getByRole("button", { name: /^Lunch met Jan.*Locatie nodig/ }).click();
  const panel = page.getByRole("region", { name: "Afspraak Lunch met Jan" });
  await panel.getByRole("combobox", { name: "Waar was dit?" }).fill("Jaarbeursplein 6, Utrecht");
  await panel.getByRole("option", { name: new RegExp(client) }).click();
  await panel.getByRole("button", { name: "Koppelen" }).click();
  await expect(page.getByText("wacht op een locatie")).toBeHidden();
  // Op desktop staan dinsdag (workshop) en donderdag (lunch) allebei in beeld
  await expect(leg(page, home, client).last()).toBeVisible();

  // Woensdag: zelf een reisblok toevoegen (materiaal ophalen in Rotterdam)
  await showDay(page, "wo 4");
  await page.getByRole("button", { name: "+ rit toevoegen op wo 4" }).click();
  const add = page.getByRole("region", { name: "Reisblok toevoegen" });
  await add.getByRole("combobox", { name: "Waar ging je naartoe?" }).fill("Coolsingel 40");
  await add.getByRole("option", { name: new RegExp(office) }).click();
  await add.getByLabel("Aankomst rond").fill("10:00");
  await add.getByLabel("Waarvoor?").fill("Materiaal ophalen");
  await add.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByRole("button", { name: /^Tussenstop Materiaal ophalen/ })).toBeVisible();

  // Ma 2 + di 2 + wo 2 + do 2
  await page.getByRole("button", { name: "Voeg 8 ritten toe" }).click();
  await expect(page.getByRole("status").filter({ hasText: "8 ritten toegevoegd" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voeg 0 ritten toe" })).toBeDisabled();

  const stored = await page.evaluate(() => ({
    trips: JSON.parse(localStorage.getItem("kilometer_trips") ?? "[]"),
    directory: JSON.parse(localStorage.getItem("kilometer_client_directory") ?? "[]"),
  }));
  expect(stored.trips.map((t: { date: string; purpose: string }) => `${t.date} ${t.purpose}`).sort()).toEqual([
    "2026-11-02 Kantoordag", "2026-11-02 Kantoordag",
    "2026-11-03 Workshop bij klant", "2026-11-03 Workshop bij klant",
    "2026-11-04 Materiaal ophalen", "2026-11-04 Materiaal ophalen",
    "2026-11-05 Lunch met Jan", "2026-11-05 Lunch met Jan",
  ]);
  expect(stored.directory.map((d: { keyword: string }) => d.keyword)).toContain("Lunch met Jan");
});

test("ritten zonder afstand blokkeren het toevoegen tot je de afstand invult", async ({ page, map }) => {
  map.failRouting();
  await openWeek(page, ICS.replace(/BEGIN:VEVENT\r\nUID:workshop[\s\S]*END:VCALENDAR/, "END:VCALENDAR"));
  await showDay(page, "ma 2");

  await expect(page.getByText("2 ritten hebben nog geen afstand")).toBeVisible();
  const confirm = page.getByRole("button", { name: "Voeg 2 ritten toe" });
  await expect(confirm).toBeDisabled();

  for (const [from, to, km] of [[home, office, "79,9"], [office, home, "80"]] as const) {
    await leg(page, from, to).click();
    const panel = page.getByRole("region", { name: `Rit ${from} naar ${to}` });
    await expect(panel.getByText("Route niet gevonden")).toBeVisible();
    await panel.getByLabel("Afstand").fill(km);
  }
  await expect(page.getByText("nog geen afstand")).toBeHidden();
  await expect(confirm).toBeEnabled();
});

test("een rit uitzetten en een afspraak overslaan telt niet mee", async ({ page }) => {
  await openWeek(page);
  await showDay(page, "ma 2");
  await leg(page, office, home).click();
  await page.getByRole("button", { name: "Niet declareren" }).click();
  await expect(leg(page, office, home)).toContainText("telt niet mee");

  await showDay(page, "di 3");
  await page.getByRole("button", { name: /^Workshop bij klant/ }).click();
  await page.getByRole("region", { name: "Afspraak Workshop bij klant" }).getByRole("button", { name: "Geen rit" }).click();
  await expect(leg(page, home, client)).toHaveCount(0);

  // Alleen nog maandag heen
  await expect(page.getByRole("button", { name: "Voeg 1 rit toe" })).toBeEnabled();
});
