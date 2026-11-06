import type { Location, Trip } from "./types";

export type StatusFilter = "all" | "open" | "declared";
export type TripFilter = { month: string | "all"; status: StatusFilter };

/** Oudste eerst; ritten op dezelfde dag houden hun invoervolgorde. */
export function sortTrips(trips: Trip[]): Trip[] {
  return trips
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.i - b.i)
    .map(({ t }) => t);
}

/** Maanden (YYYY-MM) waarin ritten voorkomen, nieuwste eerst. */
export function monthsOf(trips: Trip[]): string[] {
  return [...new Set(trips.map((t) => t.date.slice(0, 7)))].sort().reverse();
}

export function filterTrips(trips: Trip[], filter: TripFilter): Trip[] {
  return trips.filter((t) => {
    if (filter.month !== "all" && !t.date.startsWith(filter.month)) return false;
    if (filter.status === "open" && t.declaredAt) return false;
    if (filter.status === "declared" && !t.declaredAt) return false;
    return true;
  });
}

export function markDeclared(trips: Trip[], ids: Set<string>, date: string): Trip[] {
  return trips.map((t) => (ids.has(t.id) ? { ...t, declaredAt: date } : t));
}

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus",
  "september", "oktober", "november", "december"];

/** "2026-11" → "november 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export type Suggestion = {
  key: string;
  locationA: Location;
  locationB: Location;
  purpose: string;
  client: string;
  billable: boolean;
  count: number;
};

const locKey = (l: Location) => `${l.lat.toFixed(5)},${l.lon.toFixed(5)}`;

/**
 * Veelgereden ritten als snelkeuze: zelfde route + doel + klant, op minstens twee verschillende dagen.
 * Heen en terug tellen als dezelfde route, zodat je terugrit niet apart verschijnt.
 * `count` is het aantal dagen waarop de route gereden is.
 */
export function tripSuggestions(trips: Trip[], max = 4): Suggestion[] {
  const map = new Map<string, { s: Omit<Suggestion, "count">; days: Set<string>; last: string }>();
  for (const t of trips) {
    const [a, b] = [locKey(t.locationA), locKey(t.locationB)].sort();
    const key = `${a}|${b}|${t.purpose.trim().toLowerCase()}|${t.client.trim().toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.days.add(t.date);
      if (t.date > existing.last) existing.last = t.date;
    } else {
      map.set(key, {
        s: { key, locationA: t.locationA, locationB: t.locationB, purpose: t.purpose, client: t.client, billable: t.billable },
        days: new Set([t.date]),
        last: t.date,
      });
    }
  }
  return [...map.values()]
    .filter((e) => e.days.size >= 2)
    .sort((x, y) => y.days.size - x.days.size || y.last.localeCompare(x.last))
    .slice(0, max)
    .map((e) => ({ ...e.s, count: e.days.size }));
}
