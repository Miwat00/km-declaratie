import type { Trip } from "./types";

/** Oudste eerst; ritten op dezelfde dag houden hun invoervolgorde. */
export function sortTrips(trips: Trip[]): Trip[] {
  return trips
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.i - b.i)
    .map(({ t }) => t);
}

export function markDeclared(trips: Trip[], ids: Set<string>, date: string): Trip[] {
  return trips.map((t) => (ids.has(t.id) ? { ...t, declaredAt: date } : t));
}
