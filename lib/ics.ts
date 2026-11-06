import type { CalendarEvent } from "./types";

/**
 * Minimale iCalendar-parser voor Outlook/Google-exports.
 *
 * Ondersteunt: UTC-tijden (…Z → lokale tijd), TZID-tijden (geïnterpreteerd als lokale tijd),
 * hele-dag-events, terugkerende afspraken (RRULE FREQ=DAILY/WEEKLY/MONTHLY met INTERVAL,
 * BYDAY, BYMONTHDAY, UNTIL, COUNT), EXDATE, verplaatste exemplaren (RECURRENCE-ID)
 * en geannuleerde afspraken (STATUS:CANCELLED).
 */

type DateTime = { date: string; time?: string };

type RawEvent = {
  uid?: string;
  title?: string;
  start?: DateTime;
  startRaw?: string; // originele DTSTART-waarde, nodig om UTC-reeksen per exemplaar om te rekenen
  end?: DateTime;
  location?: string;
  rrule?: string;
  exdates: string[]; // YYYY-MM-DD
  recurrenceId?: string; // YYYY-MM-DD
  cancelled: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Parseert 20250310, 20250310T090000 of 20250310T090000Z. UTC wordt naar lokale tijd omgerekend. */
export function parseDateTime(raw: string): DateTime {
  const v = raw.trim();
  const y = +v.slice(0, 4);
  const mo = +v.slice(4, 6);
  const d = +v.slice(6, 8);
  if (v.length < 15) return { date: `${y}-${pad(mo)}-${pad(d)}` };

  const hh = +v.slice(9, 11);
  const mm = +v.slice(11, 13);
  if (v.endsWith("Z")) {
    const local = new Date(Date.UTC(y, mo - 1, d, hh, mm));
    return {
      date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
      time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
    };
  }
  return { date: `${y}-${pad(mo)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}` };
}

function unescapeText(val: string): string {
  return val
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// RFC 5545: regels die met een spatie/tab beginnen zijn een vervolg van de vorige regel
function unfold(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

// ---- datumrekenen op dagnummers (UTC, dus geen last van zomertijd) ----
const DAY_MS = 86_400_000;
const toDayNum = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};
const fromDayNum = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
/** 0 = maandag … 6 = zondag */
const weekday = (n: number) => (new Date(n * DAY_MS).getUTCDay() + 6) % 7;
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const MAX_OCCURRENCES = 1000;
const MAX_YEARS = 3;

/** Geeft de datums (YYYY-MM-DD) van een terugkerende afspraak, inclusief de startdatum. */
export function expandRRule(startDate: string, rrule: string): string[] {
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v = ""] = p.split("=");
      return [k.toUpperCase(), v.toUpperCase()];
    })
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return [startDate];

  const interval = Math.max(1, parseInt(parts.INTERVAL || "1", 10) || 1);
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : Infinity;
  const start = toDayNum(startDate);
  let until = start + Math.round(MAX_YEARS * 365.25);
  if (parts.UNTIL) until = Math.min(until, toDayNum(parseDateTime(parts.UNTIL).date));

  // BYDAY kan een prefix hebben (bijv. 1MO bij MONTHLY); die negeren we, alleen de dag telt
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(",").map((d: string) => WEEKDAYS.indexOf(d.slice(-2))).filter((d: number) => d >= 0)
    : null;
  const byMonthDay = parts.BYMONTHDAY ? parts.BYMONTHDAY.split(",").map(Number) : null;

  const startDateObj = new Date(start * DAY_MS);
  const startMonthIndex = startDateObj.getUTCFullYear() * 12 + startDateObj.getUTCMonth();
  const startWeekMonday = start - weekday(start);

  const result: string[] = [];
  for (let day = start; day <= until && result.length < Math.min(count, MAX_OCCURRENCES); day++) {
    let match = false;
    if (freq === "DAILY") {
      match = (day - start) % interval === 0 && (!byDay || byDay.includes(weekday(day)));
    } else if (freq === "WEEKLY") {
      const weekIndex = Math.floor((day - startWeekMonday) / 7);
      const days = byDay ?? [weekday(start)];
      match = weekIndex % interval === 0 && days.includes(weekday(day));
    } else {
      const dObj = new Date(day * DAY_MS);
      const monthIndex = dObj.getUTCFullYear() * 12 + dObj.getUTCMonth();
      const dom = dObj.getUTCDate();
      const days = byMonthDay ?? [startDateObj.getUTCDate()];
      match = (monthIndex - startMonthIndex) % interval === 0 && days.includes(dom);
    }
    if (match) result.push(fromDayNum(day));
  }
  return result;
}

function parseRawEvents(text: string): RawEvent[] {
  const lines = unfold(text).split("\n");
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  let depth = 0; // nesting binnen VEVENT (bijv. VALARM)

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      current = { exdates: [], cancelled: false };
      depth = 0;
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("BEGIN:")) { depth++; continue; }
    if (line.startsWith("END:")) { depth--; continue; }
    if (depth > 0) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1);

    switch (key) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.title = unescapeText(value).trim();
        break;
      case "DTSTART":
        current.startRaw = value.trim();
        current.start = parseDateTime(value);
        break;
      case "DTEND":
        current.end = parseDateTime(value);
        break;
      case "LOCATION":
        if (value.trim()) current.location = unescapeText(value.trim());
        break;
      case "RRULE":
        current.rrule = value.trim();
        break;
      case "EXDATE":
        for (const v of value.split(",")) if (v.trim()) current.exdates.push(parseDateTime(v).date);
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = parseDateTime(value).date;
        break;
      case "STATUS":
        current.cancelled = value.trim().toUpperCase() === "CANCELLED";
        break;
    }
  }
  return events;
}

export function parseIcs(text: string): CalendarEvent[] {
  const raw = parseRawEvents(text).filter((e) => e.title && e.start);

  // Verplaatste/aangepaste exemplaren van een reeks: uid → set van originele datums
  const overridden = new Map<string, Set<string>>();
  for (const e of raw) {
    if (e.uid && e.recurrenceId) {
      const set = overridden.get(e.uid) ?? new Set<string>();
      set.add(e.recurrenceId);
      overridden.set(e.uid, set);
    }
  }

  const events: CalendarEvent[] = [];
  for (const e of raw) {
    if (e.cancelled) continue;
    const base = {
      title: e.title!,
      startTime: e.start!.time,
      endTime: e.end?.time,
      location: e.location,
    };

    if (!e.rrule || e.recurrenceId) {
      events.push({ id: crypto.randomUUID(), date: e.start!.date, ...base });
      continue;
    }

    const skip = new Set([...e.exdates, ...(e.uid ? overridden.get(e.uid) ?? [] : [])]);
    const raw = e.startRaw ?? "";
    const isUtc = raw.endsWith("Z") && raw.length >= 15;

    if (isUtc) {
      // Een UTC-reeks ligt vast in UTC: rond zomer-/wintertijd verschuift de lokale tijd per exemplaar
      const utcStart = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const timePart = raw.slice(8); // "T090000Z"
      for (const utcDate of expandRRule(utcStart, e.rrule)) {
        const local = parseDateTime(utcDate.replace(/-/g, "") + timePart);
        if (!skip.has(local.date)) {
          events.push({ id: crypto.randomUUID(), ...base, date: local.date, startTime: local.time });
        }
      }
      continue;
    }

    for (const date of expandRRule(e.start!.date, e.rrule)) {
      if (!skip.has(date)) events.push({ id: crypto.randomUUID(), date, ...base });
    }
  }

  return events.sort((a, b) =>
    a.date === b.date ? (a.startTime ?? "99").localeCompare(b.startTime ?? "99") : a.date.localeCompare(b.date)
  );
}

export function filterEventsByRange(events: CalendarEvent[], from: string, to: string): CalendarEvent[] {
  return events.filter((e) => e.date >= from && e.date <= to);
}
