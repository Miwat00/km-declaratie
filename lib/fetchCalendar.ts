import { CalendarUrlError, isAllowedCalendarHost, looksLikeIcs, normalizeCalendarUrl } from "./calendarUrl";

export const MAX_CALENDAR_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class CalendarFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readLimited(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > limit) throw new CalendarFetchError("Deze agenda is te groot (meer dan 5 MB).", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new CalendarFetchError("Deze agenda is te groot (meer dan 5 MB).", 413);
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * Haalt een agenda op bij een toegestane dienst. Redirects volgen we zelf, zodat ook elke
 * tussenstap op de lijst van toegestane diensten moet staan.
 */
export async function fetchCalendar(input: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = normalizeCalendarUrl(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: "manual",
        signal,
        headers: { Accept: "text/calendar, text/plain;q=0.9" },
        cache: "no-store",
      });
    } catch {
      throw new CalendarFetchError("De agenda kon niet worden opgehaald. Probeer het later opnieuw.", 502);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      const next = new URL(location, url);
      if (next.protocol !== "https:" || !isAllowedCalendarHost(next.hostname)) {
        throw new CalendarFetchError(
          "De agendadienst stuurde door naar een andere website. Is de agenda wel gepubliceerd of openbaar gedeeld?",
          502
        );
      }
      url = next.toString();
      continue;
    }

    if (response.status === 404 || response.status === 403 || response.status === 401) {
      throw new CalendarFetchError(
        "Deze agenda is niet (meer) openbaar. Controleer of de link klopt en of de agenda nog gepubliceerd is.",
        404
      );
    }
    if (!response.ok) {
      throw new CalendarFetchError("De agendadienst gaf een fout. Probeer het later opnieuw.", 502);
    }

    const text = await readLimited(response, MAX_CALENDAR_BYTES);
    if (!looksLikeIcs(text)) {
      throw new CalendarFetchError("Deze link geeft geen agendabestand (.ics) terug.", 422);
    }
    return text;
  }
  throw new CalendarFetchError("Te veel doorverwijzingen bij het ophalen van de agenda.", 502);
}

export { CalendarUrlError };
