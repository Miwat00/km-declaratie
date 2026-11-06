import { test, expect, seed, DEFAULT_SEED, ADDRESSES, shortName } from "./fixtures";

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  // Terugkerend op maandag en woensdag, in UTC (09:00 lokale tijd)
  "BEGIN:VEVENT", "UID:kantoor", "SUMMARY:Kantoordag", "DTSTART:20261102T080000Z",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4", "END:VEVENT",
  // Afspraak met een adres in het locatieveld
  "BEGIN:VEVENT", "UID:workshop", "SUMMARY:Workshop bij klant", "DTSTART;TZID=W. Europe Standard Time:20261103T130000",
  "LOCATION:Jaarbeursplein 6\\, Utrecht", "END:VEVENT",
  // Online afspraak: geen rit
  "BEGIN:VEVENT", "UID:sync", "SUMMARY:Sync", "DTSTART:20261104T130000Z", "LOCATION:Microsoft Teams Meeting", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("agenda importeren: van .ics tot ritten op de hoofdpagina", async ({ page }) => {
  await seed(page, DEFAULT_SEED, "/agenda");

  await expect(page.getByLabel("Je naam")).toHaveValue("Sam Tester");
  await page.locator("input[type=file]").setInputFiles({
    name: "agenda.ics", mimeType: "text/calendar", buffer: Buffer.from(ICS),
  });

  // Stap 2: periode kiezen
  await page.getByLabel("Van").fill("2026-11-02");
  await page.getByLabel("Tot en met").fill("2026-11-06");
  await expect(page.getByText("Kantoordag").first()).toBeVisible();
  await page.getByRole("button", { name: "Verwerk 4 events" }).click();

  // Stap 3: de workshop is via het locatieveld al opgezocht, de Teams-call niet
  await expect(page.getByRole("heading", { name: "Onbekende events koppelen" })).toBeVisible();
  const locations = page.getByRole("combobox", { name: "Locatie" });
  await expect(locations).toHaveCount(2);
  await expect(locations.first()).toHaveValue(shortName(ADDRESSES.client));
  await expect(locations.nth(1)).toHaveValue("");
  await page.getByRole("button", { name: "Naar preview" }).click();

  // Stap 4: per dag thuis → afspraak → thuis
  await expect(page.getByRole("heading", { name: "Controleer en corrigeer" })).toBeVisible();
  await expect(page.getByText("6 van 6 ritten geselecteerd")).toBeVisible();
  await expect(page.getByText(`${shortName(ADDRESSES.home)}`).first()).toBeVisible();

  await page.getByRole("button", { name: "Voeg 6 ritten toe" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("6 ritten toegevoegd vanuit agenda")).toBeVisible();

  const trips = await page.evaluate(() => JSON.parse(localStorage.getItem("kilometer_trips") ?? "[]"));
  expect(trips.map((t: { date: string; client: string }) => `${t.date} ${t.client}`)).toEqual([
    "2026-11-02 Voorbeeld BV", "2026-11-02 Voorbeeld BV",
    "2026-11-03 Workshop bij klant", "2026-11-03 Workshop bij klant",
    "2026-11-04 Voorbeeld BV", "2026-11-04 Voorbeeld BV",
  ]);
});

test("agenda importeren is geblokkeerd tot elke rit een afstand heeft", async ({ page, map }) => {
  await seed(page, DEFAULT_SEED, "/agenda");
  map.failRouting();
  await page.locator("input[type=file]").setInputFiles({
    name: "agenda.ics", mimeType: "text/calendar",
    buffer: Buffer.from(ICS.replace("COUNT=4", "COUNT=1")),
  });
  await page.getByLabel("Van").fill("2026-11-02");
  await page.getByLabel("Tot en met").fill("2026-11-02");
  await page.getByRole("button", { name: "Verwerk 1 events" }).click();
  await page.getByRole("button", { name: "Naar preview" }).click();

  const warning = page.getByRole("alert").filter({ hasText: "nog geen afstand" });
  await expect(warning).toContainText("2 ritten hebben nog geen afstand");
  const confirm = page.getByRole("button", { name: "Voeg 2 ritten toe" });
  await expect(confirm).toBeDisabled();

  for (const [i, km] of [[0, "79,9"], [1, "80"]] as const) {
    await page.getByRole("button", { name: "Bewerken" }).nth(i).click();
    await page.getByLabel("Afstand").fill(km);
  }
  await expect(warning).toBeHidden();
  await expect(confirm).toBeEnabled();
});
