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
const first = (a: (typeof ADDRESSES)[keyof typeof ADDRESSES]) => shortName(a).split(",")[0];
const home = first(ADDRESSES.home);
const office = first(ADDRESSES.office);
const client = first(ADDRESSES.client);

async function openWeek(page: Page, ics = ICS) {
  // Woensdag 4 november: de app opent op deze week (vorige week heeft geen afspraken)
  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
  await seed(page, DEFAULT_SEED, "/agenda");
  await page.locator("input[type=file]").setInputFiles({ name: "agenda.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  await expect(page.getByRole("heading", { name: /^Deze week · 2 – 6 nov/ })).toBeVisible();
}

/** Ritregel in een dag; de naam bevat "Rit", de afstand en "<van> → <naar>". */
const leg = (page: Page, from: string, to: string) =>
  page.getByRole("button", { name: new RegExp(`^Rit .*${from} → ${to}`) });

/** Sluit het onderpaneel op mobiel; op desktop staat het paneel ernaast en hoeft dat niet. */
async function closeSheet(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Aanpassen" });
  if (await sheet.isVisible()) await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
}

test("week afronden: vraag beantwoorden, tussenstop toevoegen en in de declaratie zetten", async ({ page }) => {
  await openWeek(page);

  // Kantoor via het trefwoord, met ritten ervoor en erna; Teams levert geen rit op
  await expect(leg(page, home, office)).toContainText(nl(fakeRouteKm(ADDRESSES.home, ADDRESSES.office)));
  await expect(leg(page, office, home)).toBeVisible();
  await expect(page.getByRole("button", { name: /^\d\d:\d\d Sync Online/ })).toBeVisible();

  // De app vraagt waar de lunch was
  await expect(page.getByText("Nog 1 vraag, daarna is je week klaar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waar was “Lunch met Jan”?" })).toBeVisible();
  await page.getByRole("button", { name: "Ander adres…" }).click();
  await page.getByRole("combobox", { name: "Ander adres" }).fill("Jaarbeursplein 6, Utrecht");
  await page.getByRole("option", { name: new RegExp(shortName(ADDRESSES.client)) }).click();
  await expect(page.getByRole("heading", { name: "Je week is klaar" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Lunch met Jan: Jaarbeursplein 6, Utrecht, ook voortaan" })).toBeVisible();
  await expect(leg(page, home, client)).toHaveCount(2); // dinsdag (workshop) en donderdag (lunch)

  // Zelf een tussenstop toevoegen op woensdag
  await page.getByRole("button", { name: "+ Tussenstop toevoegen op wo 4" }).click();
  const add = page.getByRole("region", { name: "Tussenstop toevoegen" });
  await add.getByRole("combobox", { name: "Waar ging je naartoe?" }).fill("Coolsingel 40");
  await add.getByRole("option", { name: new RegExp(shortName(ADDRESSES.office)) }).click();
  await add.getByLabel("Rond").fill("10:00");
  await add.getByLabel("Waarvoor?").fill("Materiaal ophalen");
  await add.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByRole("button", { name: /^Tussenstop 10:00 Materiaal ophalen/ })).toBeVisible();

  // Ma 2 + di 2 + wo 2 + do 2
  await page.getByRole("button", { name: "Zet 8 ritten in je declaratie" }).click();
  await expect(page.getByRole("status").filter({ hasText: "8 ritten staan in je declaratie" })).toBeVisible();
  await expect(leg(page, home, office).first()).toContainText("al in declaratie");

  const stored = await page.evaluate(() => ({
    trips: JSON.parse(localStorage.getItem("kilometer_trips") ?? "[]"),
    directory: JSON.parse(localStorage.getItem("kilometer_client_directory") ?? "[]"),
  }));
  expect(stored.trips.map((t: { date: string; purpose: string; billable: boolean }) => `${t.date} ${t.purpose} ${t.billable ? "fact" : "intern"}`).sort()).toEqual([
    "2026-11-02 Kantoordag intern", "2026-11-02 Kantoordag intern",
    "2026-11-03 Workshop bij klant fact", "2026-11-03 Workshop bij klant fact",
    "2026-11-04 Materiaal ophalen intern", "2026-11-04 Materiaal ophalen intern",
    "2026-11-05 Lunch met Jan fact", "2026-11-05 Lunch met Jan fact",
  ]);
  expect(stored.directory.map((d: { keyword: string }) => d.keyword)).toContain("Lunch met Jan");
});

test("'geen rit' kun je ongedaan maken en voortaan onthouden", async ({ page }) => {
  await openWeek(page);
  await page.getByRole("button", { name: /^Geen rit/ }).click();
  const toast = page.getByRole("status").filter({ hasText: "Lunch met Jan: geen rit, ook voortaan" });
  await expect(toast).toBeVisible();
  await expect(page.getByRole("heading", { name: "Je week is klaar" })).toBeVisible();

  await toast.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByRole("heading", { name: "Waar was “Lunch met Jan”?" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kilometer_skip_titles"))).toBe("[]");

  // Nu echt: geen rit, en bij een volgende keer wordt het niet meer gevraagd
  await page.getByRole("button", { name: /^Geen rit/ }).click();
  await page.getByRole("button", { name: "Andere agenda" }).click();
  await page.locator("input[type=file]").setInputFiles({ name: "agenda.ics", mimeType: "text/calendar", buffer: Buffer.from(ICS) });
  await expect(page.getByRole("heading", { name: "Je week is klaar" })).toBeVisible();
});

test("ritten zonder afstand blokkeren tot je de afstand invult", async ({ page, map }) => {
  map.failRouting();
  await openWeek(page, ICS.replace(/BEGIN:VEVENT\r\nUID:workshop[\s\S]*END:VCALENDAR/, "END:VCALENDAR"));

  await expect(page.getByText("2 ritten hebben nog geen afstand")).toBeVisible();
  const confirm = page.getByRole("button", { name: "Zet 2 ritten in je declaratie" });
  await expect(confirm).toBeDisabled();

  for (const [from, to, km] of [[home, office, "79,9"], [office, home, "80"]] as const) {
    await leg(page, from, to).click();
    const panel = page.getByRole("region", { name: new RegExp(`^Rit ${from}.* naar ${to}`) });
    await expect(panel.getByText("De afstand kon niet berekend worden")).toBeVisible();
    await panel.getByLabel("Afstand").fill(km);
    await closeSheet(page);
  }
  await expect(page.getByText("nog geen afstand")).toBeHidden();
  await expect(confirm).toBeEnabled();
});

test("een rit uitzetten en een afspraak overslaan telt niet mee", async ({ page }) => {
  await openWeek(page);
  await leg(page, office, home).click();
  await page.getByRole("button", { name: "Niet declareren" }).click();
  await closeSheet(page);
  await expect(leg(page, office, home)).toContainText("telt niet mee");

  await page.getByRole("button", { name: /^13:00 Workshop bij klant/ }).click();
  await page.getByRole("region", { name: "Afspraak Workshop bij klant" }).getByRole("button", { name: "Geen rit" }).click();
  await closeSheet(page);
  await expect(leg(page, home, client)).toHaveCount(0);

  // Alleen maandag heen telt (de lunch is nog een open vraag)
  await expect(page.getByRole("button", { name: "Zet 1 rit in je declaratie" })).toBeEnabled();
});
