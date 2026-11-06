import { test, expect, seed, DEFAULT_SEED } from "./fixtures";

const LINK = "https://outlook.office365.com/owa/calendar/demo@voorbeeld.nl/abc/calendar.ics";
const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0",
  "BEGIN:VEVENT", "UID:1", "SUMMARY:Kantoordag", "DTSTART:20261102T080000Z", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("agenda ophalen via een geplakte link; daarna opent de week meteen", async ({ page }) => {
  // De browser praat alleen met de eigen /api/calendar; die bootsen we hier na
  const requests: unknown[] = [];
  await page.route("**/api/calendar", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ body: ICS, contentType: "text/calendar" });
  });

  await seed(page, DEFAULT_SEED, "/agenda");
  await page.getByLabel("Agenda-link plakken").fill(LINK);
  await page.getByRole("button", { name: "Afspraken ophalen" }).click();
  await expect(page.getByRole("button", { name: "Week eerder" })).toBeVisible();
  expect(requests).toEqual([{ url: LINK }]);

  // Volgende keer haalt de app de agenda zelf op en sla je het ophaalscherm over
  await page.reload();
  await expect(page.getByRole("button", { name: "Week eerder" })).toBeVisible();
  await expect(page.getByText(/Agenda bijgewerkt om/)).toBeVisible();
  expect(requests).toHaveLength(2);

  // Via "Andere agenda" kun je de link vergeten
  await page.getByRole("button", { name: "Andere agenda" }).click();
  await expect(page.getByLabel("Agenda-link plakken")).toHaveValue(LINK);
  await page.getByRole("button", { name: "Opgeslagen link vergeten" }).click();
  await expect(page.getByLabel("Agenda-link plakken")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("kilometer_calendar_url"))).toBeNull();
});

test("een foutmelding van de server wordt getoond", async ({ page }) => {
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ status: 404, json: { error: "Deze agenda is niet (meer) openbaar." } })
  );
  await seed(page, DEFAULT_SEED, "/agenda");
  await page.getByLabel("Agenda-link plakken").fill(LINK);
  await page.getByRole("button", { name: "Afspraken ophalen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "niet (meer) openbaar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kilometer_calendar_url"))).toBeNull();
});

test.describe("de /api/calendar-route zelf", () => {
  test("weigert links naar andere websites (geen open proxy)", async ({ request }) => {
    for (const url of ["https://example.com/a.ics", "http://localhost:3100/", "https://169.254.169.254/latest/meta-data"]) {
      const res = await request.post("/api/calendar", { data: { url } });
      expect(res.status()).toBe(400);
      expect(res.headers()["cache-control"]).toBe("no-store");
      expect((await res.json()).error).toMatch(/Outlook, Google Agenda en iCloud|geen geldige agenda-link/);
    }
  });

  test("weigert ongeldige verzoeken", async ({ request }) => {
    expect((await request.post("/api/calendar", { data: "geen json", headers: { "content-type": "text/plain" } })).status()).toBe(400);
    expect((await request.post("/api/calendar", { data: { url: 42 } })).status()).toBe(400);
    expect((await request.get("/api/calendar")).status()).toBe(405);
  });
});
