import { describe, expect, it } from "vitest";
import { looksLikeIcs, normalizeCalendarUrl } from "@/lib/calendarUrl";
import { CalendarFetchError, fetchCalendar, MAX_CALENDAR_BYTES } from "@/lib/fetchCalendar";

const OUTLOOK = "https://outlook.office365.com/owa/calendar/abc@voorbeeld.nl/xyz/calendar.ics";
const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR";

describe("normalizeCalendarUrl", () => {
  it.each([
    [OUTLOOK, OUTLOOK],
    ["  webcal://p52-caldav.icloud.com/published/2/abc  ", "https://p52-caldav.icloud.com/published/2/abc"],
    ["http://calendar.google.com/calendar/ical/x/private-y/basic.ics", "https://calendar.google.com/calendar/ical/x/private-y/basic.ics"],
  ])("accepteert %s", (input, expected) => {
    expect(normalizeCalendarUrl(input)).toBe(expected);
  });

  it.each([
    ["", /Plak eerst/],
    ["geen link", /geen geldige link/],
    ["ftp://outlook.office365.com/x.ics", /https/],
    ["https://example.com/agenda.ics", /Outlook, Google Agenda en iCloud/],
    ["https://calendar.google.com.evil.example/x.ics", /Outlook, Google Agenda en iCloud/],
    ["https://evilicloud.com/x.ics", /Outlook, Google Agenda en iCloud/],
    ["https://localhost/x.ics", /Outlook, Google Agenda en iCloud/],
    ["https://169.254.169.254/latest/meta-data", /Outlook, Google Agenda en iCloud/],
    ["https://user:pw@outlook.office365.com/x.ics", /gebruikersnaam/],
    ["https://outlook.office365.com:8443/x.ics", /geen geldige agenda-link/],
  ])("weigert %j", (input, message) => {
    expect(() => normalizeCalendarUrl(input)).toThrow(message);
  });
});

describe("looksLikeIcs", () => {
  it("herkent een agenda, ook met BOM en witruimte", () => {
    expect(looksLikeIcs("﻿  BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(looksLikeIcs("<!DOCTYPE html><html>")).toBe(false);
  });
});

/** Nep-fetch: per URL een vooraf bepaald antwoord. */
function fakeFetch(responses: Record<string, () => Response>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const make = responses[url];
    if (!make) throw new TypeError("network error");
    return make();
  }) as typeof fetch;
  return { impl, calls };
}

describe("fetchCalendar", () => {
  it("haalt een agenda op", async () => {
    const { impl } = fakeFetch({ [OUTLOOK]: () => new Response(ICS) });
    await expect(fetchCalendar(OUTLOOK, impl)).resolves.toBe(ICS);
  });

  it("volgt een doorverwijzing binnen dezelfde dienst", async () => {
    const next = "https://outlook.office365.com/owa/calendar/abc@voorbeeld.nl/xyz/reachcalendar.ics";
    const { impl, calls } = fakeFetch({
      [OUTLOOK]: () => new Response(null, { status: 302, headers: { location: next } }),
      [next]: () => new Response(ICS),
    });
    await expect(fetchCalendar(OUTLOOK, impl)).resolves.toBe(ICS);
    expect(calls).toEqual([OUTLOOK, next]);
  });

  it("volgt geen doorverwijzing naar een andere website", async () => {
    const { impl, calls } = fakeFetch({
      [OUTLOOK]: () => new Response(null, { status: 302, headers: { location: "https://login.microsoftonline.com/x" } }),
    });
    await expect(fetchCalendar(OUTLOOK, impl)).rejects.toThrow(/andere website/);
    expect(calls).toEqual([OUTLOOK]);
  });

  it.each([
    [404, /niet \(meer\) openbaar/, 404],
    [500, /gaf een fout/, 502],
  ])("vertaalt status %i naar een melding", async (status, message, code) => {
    const { impl } = fakeFetch({ [OUTLOOK]: () => new Response("x", { status }) });
    const err = await fetchCalendar(OUTLOOK, impl).catch((e) => e);
    expect(err).toBeInstanceOf(CalendarFetchError);
    expect(err.message).toMatch(message);
    expect(err.status).toBe(code);
  });

  it("weigert iets dat geen agenda is", async () => {
    const { impl } = fakeFetch({ [OUTLOOK]: () => new Response("<html>inloggen</html>") });
    await expect(fetchCalendar(OUTLOOK, impl)).rejects.toThrow(/geen agendabestand/);
  });

  it("stopt bij een te groot bestand", async () => {
    const big = "BEGIN:VCALENDAR\n" + "x".repeat(MAX_CALENDAR_BYTES);
    const { impl } = fakeFetch({ [OUTLOOK]: () => new Response(big) });
    await expect(fetchCalendar(OUTLOOK, impl)).rejects.toThrow(/te groot/);
  });

  it("meldt netwerkfouten zonder de link te noemen", async () => {
    const { impl } = fakeFetch({});
    const err = await fetchCalendar(OUTLOOK, impl).catch((e) => e);
    expect(err.message).toMatch(/kon niet worden opgehaald/);
    expect(err.message).not.toContain("office365");
  });
});
