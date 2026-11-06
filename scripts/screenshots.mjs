// Maakt de screenshots voor de README met fictieve demodata.
// Gebruik: npm run build && npx next start -p 3001   (in een tweede terminal)
//          node scripts/screenshots.mjs [http://localhost:3001]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3001";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const loc = (shortName, lat, lon, place) => ({ lat, lon, shortName, displayName: `${shortName}, ${place}, Nederland` });
const HOME = loc("Dam 1, Amsterdam", 52.3731, 4.8926, "Noord-Holland");
const OFFICE = loc("Jaarbeursplein 6, Utrecht", 52.0883, 5.1112, "Utrecht");
const CLIENT_A = loc("Coolsingel 40, Rotterdam", 51.9227, 4.4792, "Zuid-Holland");
const CLIENT_B = loc("Grote Markt 1, Haarlem", 52.3812, 4.6363, "Noord-Holland");

let id = 0;
const trip = (date, a, b, km, purpose, client, billable, declaredAt) => ({
  id: `demo-${++id}`, date, name: "Sam Jansen", purpose, client, billable,
  locationA: a, locationB: b, distanceKm: km, rate: 0.23, amount: Math.round(km * 0.23 * 100) / 100,
  ...(declaredAt ? { declaredAt } : {}),
});
const roundTrip = (date, dest, km, purpose, client, billable, declaredAt) => [
  trip(date, HOME, dest, km, purpose, client, billable, declaredAt),
  trip(date, dest, HOME, km, purpose, client, billable, declaredAt),
];

const DATA = {
  kilometer_settings: { userName: "Sam Jansen", companyName: "Voorbeeld BV", office: OFFICE },
  kilometer_home_address: HOME,
  kilometer_rate: 0.23,
  kilometer_client_directory: [
    { keyword: "rotterdam", location: CLIENT_A, client: "Gemeente Rotterdam", billable: true },
  ],
  kilometer_trips: [
    ...roundTrip("2026-10-05", OFFICE, 46.2, "Kantoordag", "Voorbeeld BV", false, "2026-11-01"),
    ...roundTrip("2026-10-14", CLIENT_A, 78.6, "Workshop", "Gemeente Rotterdam", true, "2026-11-01"),
    ...roundTrip("2026-11-02", OFFICE, 46.2, "Kantoordag", "Voorbeeld BV", false),
    ...roundTrip("2026-11-04", CLIENT_B, 21.4, "Kick-off", "Stadsschouwburg", true),
    ...roundTrip("2026-11-05", CLIENT_A, 78.6, "Workshop", "Gemeente Rotterdam", true),
  ],
};

async function newPage(browser, device) {
  const context = await browser.newContext({ ...device, locale: "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate((data) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, DATA);
  await page.reload();
  await page.locator("#trip-form").waitFor();
  return page;
}

const browser = await chromium.launch();

// 1. Desktop: formulier met routekaart, en het overzicht van november
{
  const page = await newPage(browser, { viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  await page.getByLabel("Maand").selectOption("2026-11");
  await page.getByRole("button", { name: /Workshop/ }).first().click(); // snelkeuze
  await page.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500); // kaarttegels laten inladen
  await page.screenshot({ path: `${OUT}/overzicht.png`, fullPage: true });
  await page.context().close();
}

// 2. Mobiel: rittenlijst met gedeclareerde ritten
{
  const page = await newPage(browser, devices["Pixel 7"]);
  // Begin bij de filters, zodat de rittenlijst in beeld is
  await page.getByLabel("Maand").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/mobiel.png` });
  await page.context().close();
}

// 3. Agenda-import: controleerstap
{
  const page = await newPage(browser, { viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/agenda`);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT", "UID:a", "SUMMARY:Kantoordag", "DTSTART:20261109T080000Z", "RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=2", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b", "SUMMARY:Workshop Rotterdam", "DTSTART;TZID=W. Europe Standard Time:20261110T100000", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c", "SUMMARY:Weekstart (Teams)", "DTSTART:20261109T070000Z", "LOCATION:Microsoft Teams Meeting", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  await page.locator("input[type=file]").setInputFiles({ name: "agenda.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  await page.getByLabel("Van").fill("2026-11-09");
  await page.getByLabel("Tot en met").fill("2026-11-13");
  await page.getByRole("button", { name: /Verwerk/ }).click();
  await page.getByRole("button", { name: "Naar preview" }).click();
  await page.getByRole("heading", { name: "Controleer en corrigeer" }).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/agenda-import.png`, fullPage: true });
  await page.context().close();
}

await browser.close();
console.log(`Screenshots opgeslagen in ${OUT}/`);
