import type { CalendarEvent, ClientEntry, Location, Settings, Trip } from "./types";
import { isOnlineLocation, resolveStop } from "./tripGenerator";

/**
 * Plant per dag de ritten rond je afspraken: thuis → afspraak → afspraak → thuis.
 * Puur rekenwerk zonder netwerk of React, zodat het goed te testen is.
 */

// ---------- beslissingen en status per afspraak ----------

/** Wat de gebruiker in deze sessie voor een afspraak koos. */
export type EventDecision =
  | { kind: "link"; location: Location; client: string; billable: boolean }
  | { kind: "skip" };

export type EventStatus =
  | { kind: "linked"; location: Location; client: string; billable: boolean; source: "koppeling" | "kantoor" | "agenda" | "handmatig" }
  | { kind: "skip"; reason: "online" | "hele dag" | "handmatig" }
  | { kind: "todo" };

export type PlannedEvent = { event: CalendarEvent; status: EventStatus };

/**
 * Bepaalt of een afspraak een rit oplevert:
 * eigen keuze > klant-koppeling of kantoor > online (geen rit) > hele dag (geen rit) > adres uit de agenda > nog te koppelen.
 */
export function eventStatus(
  event: CalendarEvent,
  decision: EventDecision | undefined,
  directory: ClientEntry[],
  settings: Pick<Settings, "office" | "companyName">,
  geocoded: Location | null | undefined
): EventStatus {
  if (decision?.kind === "skip") return { kind: "skip", reason: "handmatig" };
  if (decision?.kind === "link") {
    const { location, client, billable } = decision;
    return { kind: "linked", location, client, billable, source: "handmatig" };
  }

  const stop = resolveStop(event, directory, settings);
  if (stop) {
    const isOffice = !!settings.office && sameLocation(stop.location, settings.office) && !stop.billable;
    return { kind: "linked", ...stop, source: isOffice ? "kantoor" : "koppeling" };
  }
  if (event.location && isOnlineLocation(event.location)) return { kind: "skip", reason: "online" };
  if (!event.startTime) return { kind: "skip", reason: "hele dag" };
  if (geocoded) return { kind: "linked", location: geocoded, client: event.title, billable: true, source: "agenda" };
  return { kind: "todo" };
}

// ---------- tijd ----------

/** "09:30" → 570 (minuten na middernacht) */
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (min: number) => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Hele-dag-afspraken die toch een rit opleveren (bijv. "Kantoordag") plannen we om 9:00–17:00. */
const ALL_DAY_START = 9 * 60;
const ALL_DAY_END = 17 * 60;
/** Reistijd als de route (nog) onbekend is, alleen voor de weergave. */
const FALLBACK_TRAVEL_MIN = 30;
/** Hoe lang een zelf toegevoegde tussenstop duurt, alleen voor de weergave. */
export const MANUAL_STOP_MIN = 15;

export function eventSpan(event: CalendarEvent): { start: number; end: number } {
  if (!event.startTime) return { start: ALL_DAY_START, end: ALL_DAY_END };
  const start = toMin(event.startTime);
  const end = event.endTime ? toMin(event.endTime) : start + 60;
  return { start, end: end > start ? end : start + 60 };
}

// ---------- locaties ----------

export const locKey = (l: Location) => `${l.lat.toFixed(5)},${l.lon.toFixed(5)}`;
export const sameLocation = (a: Location, b: Location) => locKey(a) === locKey(b);
export const routeKey = (from: Location, to: Location) => `${locKey(from)}>${locKey(to)}`;

// ---------- zelf toegevoegde tussenstops ----------

export type ManualStop = {
  id: string;
  date: string;
  time: string; // aankomsttijd "HH:MM"
  location: Location;
  purpose: string;
  client: string;
  billable: boolean;
};

// ---------- ritten (legs) ----------

export type RouteInfo = { km: number; min: number };
export type RouteLookup = (from: Location, to: Location) => RouteInfo | "loading" | "error";
export type LegOverride = { km?: number; disabled?: boolean };

export type Leg = {
  key: string;
  date: string;
  from: Location;
  to: Location;
  purpose: string;
  client: string;
  billable: boolean;
  /** Rit naar een zelf toegevoegde tussenstop */
  manual: boolean;
  departMin: number;
  arriveMin: number;
  /** Afstand die gedeclareerd wordt (eigen invoer of route) */
  km: number | null;
  routeKm: number | null;
  routeStatus: "ok" | "loading" | "error";
  disabled: boolean;
  /** Staat al in je ritten (zelfde dag, van en naar) */
  alreadyAdded: boolean;
};

type Stop = {
  location: Location;
  start: number;
  end: number;
  purpose: string;
  client: string;
  billable: boolean;
  manual: boolean;
};

export function planDay(
  date: string,
  events: PlannedEvent[],
  manualStops: ManualStop[],
  home: Location,
  lookup: RouteLookup,
  overrides: Record<string, LegOverride>,
  existingTrips: Pick<Trip, "date" | "locationA" | "locationB">[]
): Leg[] {
  const stops: Stop[] = [];
  for (const { event, status } of events) {
    if (event.date !== date || status.kind !== "linked") continue;
    const span = eventSpan(event);
    stops.push({
      location: status.location, ...span, purpose: event.title,
      client: status.client, billable: status.billable, manual: false,
    });
  }
  for (const m of manualStops) {
    if (m.date !== date) continue;
    const start = toMin(m.time);
    stops.push({
      location: m.location, start, end: start + MANUAL_STOP_MIN, purpose: m.purpose,
      client: m.client, billable: m.billable, manual: true,
    });
  }
  if (stops.length === 0) return [];
  stops.sort((a, b) => a.start - b.start);

  const legs: Leg[] = [];
  const seen = new Map<string, number>();
  const addLeg = (from: Location, to: Location, dest: Stop, toHome: boolean, prevEnd: number) => {
    if (sameLocation(from, to)) return;
    const route = lookup(from, to);
    const info = typeof route === "object" ? route : null;
    const travel = info?.min ?? FALLBACK_TRAVEL_MIN;
    // Heen: aankomen bij het begin van de afspraak. Terug naar huis: vertrekken na de laatste afspraak.
    const departMin = toHome ? prevEnd : dest.start - travel;
    const arriveMin = toHome ? prevEnd + travel : dest.start;

    const pair = routeKey(from, to);
    const n = (seen.get(pair) ?? 0) + 1;
    seen.set(pair, n);
    const key = `${date}|${pair}|${n}`;
    const o = overrides[key] ?? {};
    legs.push({
      key, date, from, to,
      purpose: dest.purpose, client: dest.client, billable: dest.billable, manual: !toHome && dest.manual,
      departMin, arriveMin,
      km: o.km ?? info?.km ?? null,
      routeKm: info?.km ?? null,
      routeStatus: info ? "ok" : route === "loading" ? "loading" : "error",
      disabled: !!o.disabled,
      alreadyAdded: existingTrips.some(
        (t) => t.date === date && sameLocation(t.locationA, from) && sameLocation(t.locationB, to)
      ),
    });
  };

  let current = home;
  let lastEnd = 0;
  for (const stop of stops) {
    addLeg(current, stop.location, stop, false, lastEnd);
    current = stop.location;
    lastEnd = Math.max(lastEnd, stop.end);
  }
  const last = stops[stops.length - 1];
  // De terugrit hoort bij de laatste afspraak van de dag (zelfde doel en klant)
  addLeg(current, home, { ...last, end: lastEnd }, true, lastEnd);
  return legs;
}

// ---------- samenvatting en omzetten naar ritten ----------

/** Ritten die meetellen: niet uitgezet en nog niet eerder toegevoegd. */
export const countedLegs = (legs: Leg[]) => legs.filter((l) => !l.disabled && !l.alreadyAdded);

export function weekSummary(legs: Leg[]) {
  const counted = countedLegs(legs);
  const ready = counted.filter((l) => l.km !== null);
  return {
    count: counted.length,
    km: ready.reduce((s, l) => s + (l.km ?? 0), 0),
    missingKm: counted.filter((l) => l.km === null && l.routeStatus !== "loading").length,
    loading: counted.filter((l) => l.km === null && l.routeStatus === "loading").length,
    alreadyAdded: legs.filter((l) => l.alreadyAdded).length,
  };
}

export function legToTrip(leg: Leg, rate: number, name: string): Trip {
  const km = leg.km ?? 0;
  return {
    id: crypto.randomUUID(),
    date: leg.date,
    name,
    purpose: leg.purpose,
    client: leg.client,
    billable: leg.billable,
    locationA: leg.from,
    locationB: leg.to,
    distanceKm: km,
    rate,
    amount: Math.round(km * rate * 100) / 100,
  };
}

// ---------- week ----------

/** Maandag (YYYY-MM-DD) van de week waarin `date` valt. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** De zeven dagen van een week, maandag eerst. */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
