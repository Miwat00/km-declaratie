import type { Location, Trip } from "./types";
import { sortTrips } from "./trips";

/** Alles rond "een maand declareren": totalen, status en ritten per dag samengevoegd. */

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export const monthOfDate = (date: string) => date.slice(0, 7);

/** "2026-11" + 1 → "2026-12" */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-11" → "November 2026" */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

export type MonthStatus =
  | { kind: "leeg" }
  | { kind: "open" }
  | { kind: "deels"; open: number }
  | { kind: "gedeclareerd"; on: string };

export type MonthSummary = { count: number; km: number; amount: number; status: MonthStatus; names: string[] };

export function monthSummary(trips: Trip[]): MonthSummary {
  const km = trips.reduce((s, t) => s + t.distanceKm, 0);
  const amount = Math.round(trips.reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const open = trips.filter((t) => !t.declaredAt);
  const status: MonthStatus =
    trips.length === 0 ? { kind: "leeg" }
    : open.length === trips.length ? { kind: "open" }
    : open.length > 0 ? { kind: "deels", open: open.length }
    : { kind: "gedeclareerd", on: trips.map((t) => t.declaredAt!).sort().at(-1)! };
  return { count: trips.length, km, amount, status, names: [...new Set(trips.map((t) => t.name))] };
}

/** Welke maand de homepagina toont: deze maand, of vorige als die nog open staat en deze leeg is. */
export function pickStartMonth(today: string, trips: Trip[]): string {
  const current = monthOfDate(today);
  const has = (m: string) => trips.some((t) => monthOfDate(t.date) === m);
  const previous = addMonths(current, -1);
  if (!has(current) && trips.some((t) => monthOfDate(t.date) === previous && !t.declaredAt)) return previous;
  return current;
}

export function unmarkDeclared(trips: Trip[], ids: Set<string>): Trip[] {
  return trips.map((t) => {
    if (!ids.has(t.id)) return t;
    const copy = { ...t };
    delete copy.declaredAt;
    return copy;
  });
}

// ---------- ritten samenvoegen tot reizen ----------

const key = (l: Location) => `${l.lat.toFixed(5)},${l.lon.toFixed(5)}`;
export const samePlace = (a: Location, b: Location) => key(a) === key(b);

/** Een reis: aaneengesloten ritten op één dag van dezelfde persoon, bijv. heen en terug. */
export type Journey = {
  id: string;
  date: string;
  name: string;
  trips: Trip[];
  stops: Location[];
  km: number;
  amount: number;
  purposes: string[];
  clients: string[];
  declared: boolean;
};

export function journeys(trips: Trip[]): Journey[] {
  const out: Journey[] = [];
  for (const t of sortTrips(trips)) {
    const last = out.at(-1);
    const lastTrip = last?.trips.at(-1);
    if (last && lastTrip && last.date === t.date && last.name === t.name && samePlace(lastTrip.locationB, t.locationA)) {
      last.trips.push(t);
      last.stops.push(t.locationB);
    } else {
      out.push({ id: t.id, date: t.date, name: t.name, trips: [t], stops: [t.locationA, t.locationB], km: 0, amount: 0, purposes: [], clients: [], declared: false });
    }
  }
  for (const j of out) {
    j.km = Math.round(j.trips.reduce((s, t) => s + t.distanceKm, 0) * 10) / 10;
    j.amount = Math.round(j.trips.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    j.purposes = [...new Set(j.trips.map((t) => t.purpose).filter(Boolean))];
    j.clients = [...new Set(j.trips.map((t) => t.client).filter((c) => c && c !== "—"))];
    j.declared = j.trips.every((t) => !!t.declaredAt);
  }
  return out;
}

/** "Thuis ⇄ Kantoor" voor heen en terug, anders "Thuis → A → B → Thuis". */
export function journeyLabel(j: Journey, name: (l: Location) => string): string {
  const s = j.stops;
  if (s.length === 3 && samePlace(s[0], s[2])) return `${name(s[0])} ⇄ ${name(s[1])}`;
  return s.map(name).join(" → ");
}

/** Maandag (YYYY-MM-DD) van de week van een datum. */
export function weekStartOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

// ---------- vaak gereden ----------

export type FrequentRoute = {
  key: string;
  from: Location;
  to: Location;
  purpose: string;
  client: string;
  billable: boolean;
  kmThere: number;
  kmBack: number;
  days: number;
};

/**
 * Routes die je op minstens twee dagen reed, met de afstand van de laatste keer.
 * Daarmee voeg je met één tik een rit heen en terug toe, zonder opnieuw te rekenen.
 */
export function frequentRoutes(trips: Trip[], max = 3): FrequentRoute[] {
  const groups = new Map<string, { trips: Trip[]; days: Set<string> }>();
  for (const t of trips) {
    const [a, b] = [key(t.locationA), key(t.locationB)].sort();
    const k = `${a}|${b}|${t.purpose.trim().toLowerCase()}`;
    const g = groups.get(k) ?? { trips: [], days: new Set<string>() };
    g.trips.push(t);
    g.days.add(t.date);
    groups.set(k, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.days.size >= 2)
    .map(([k, g]) => {
      const latest = sortTrips(g.trips).at(-1)!;
      // De richting van de eerste rit van de laatste dag is "heen"
      const there = sortTrips(g.trips.filter((t) => t.date === latest.date))[0];
      const back = [...g.trips].reverse().find((t) => samePlace(t.locationA, there.locationB) && samePlace(t.locationB, there.locationA));
      return {
        key: k, from: there.locationA, to: there.locationB, purpose: there.purpose, client: there.client,
        billable: there.billable, kmThere: there.distanceKm, kmBack: back?.distanceKm ?? there.distanceKm,
        days: g.days.size, last: latest.date,
      };
    })
    .sort((x, y) => y.days - x.days || y.last.localeCompare(x.last))
    .slice(0, max)
    .map(({ last: _last, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
}
