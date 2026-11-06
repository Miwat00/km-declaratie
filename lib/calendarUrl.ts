/**
 * Validatie voor agenda-links (iCal/ICS-abonnementen).
 *
 * De server haalt alleen agenda's op bij bekende agendadiensten. Zo kan de route niet misbruikt
 * worden als open proxy of om interne adressen te benaderen (SSRF).
 */

const ALLOWED_HOSTS = [
  "outlook.office365.com",
  "outlook.office.com",
  "outlook.live.com",
  "calendar.google.com",
];
/** iCloud gebruikt wisselende subdomeinen, bijv. p52-caldav.icloud.com */
const ALLOWED_HOST_SUFFIXES = [".icloud.com"];

export class CalendarUrlError extends Error {}

export function isAllowedCalendarHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.includes(host) || ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

/** Zet een geplakte link om naar een https-URL, of gooit een CalendarUrlError met een leesbare melding. */
export function normalizeCalendarUrl(input: string): string {
  const trimmed = input.trim().replace(/^webcals?:\/\//i, "https://");
  if (!trimmed) throw new CalendarUrlError("Plak eerst de link naar je agenda.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new CalendarUrlError("Dit is geen geldige link.");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") throw new CalendarUrlError("Alleen https- of webcal-links worden ondersteund.");
  if (url.username || url.password) throw new CalendarUrlError("Links met een gebruikersnaam of wachtwoord worden niet ondersteund.");
  if (url.port) throw new CalendarUrlError("Dit is geen geldige agenda-link.");
  if (!isAllowedCalendarHost(url.hostname)) {
    throw new CalendarUrlError("Alleen agenda-links van Outlook, Google Agenda en iCloud worden ondersteund.");
  }
  return url.toString();
}

/** Controleert of tekst een iCalendar-bestand is. */
export function looksLikeIcs(text: string): boolean {
  return text.replace(/^﻿/, "").trimStart().toUpperCase().startsWith("BEGIN:VCALENDAR");
}
