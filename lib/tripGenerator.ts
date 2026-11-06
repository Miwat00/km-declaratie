import type { CalendarEvent, ClientEntry, Location, Settings, Trip } from "./types";
import { getDrivingDistanceKm } from "./osrm";
import { searchLocations } from "./nominatim";

export type GeneratedTrip = {
  id: string;
  date: string;
  locationA: Location;
  locationB: Location;
  purpose: string;
  client: string;
  billable: boolean;
  distanceKm: number;
  enabled: boolean; // user can toggle off in preview
};

export type UnmatchedEvent = {
  event: CalendarEvent;
  reason: string;
};

export type Stop = {
  location: Location;
  client: string;
  billable: boolean;
};

export type ResolvedEvent = Stop & { event: CalendarEvent };

export type ResolveResult = {
  resolved: ResolvedEvent[];
  unmatched: UnmatchedEvent[];
};

type DistanceFn = (from: Location, to: Location) => Promise<number>;

const OFFICE_KEYWORDS = ["kantoor", "office"];

export function resolveStop(
  event: CalendarEvent,
  directory: ClientEntry[],
  settings: Pick<Settings, "office" | "companyName">
): Stop | null {
  const titleLower = event.title.toLowerCase();

  // 1. Klant-koppelingen gaan voor: specifieker dan "kantoor"
  for (const entry of directory) {
    const keyword = entry.keyword.trim().toLowerCase();
    if (keyword && titleLower.includes(keyword)) {
      return { location: entry.location, client: entry.client, billable: entry.billable };
    }
  }

  // 2. "Kantoor"/"office" in de titel → ingesteld kantooradres
  if (settings.office && OFFICE_KEYWORDS.some((k) => titleLower.includes(k))) {
    return { location: settings.office, client: settings.companyName || "Kantoor", billable: false };
  }

  return null;
}

/** Koppelt events aan een locatie. Events zonder koppeling komen in `unmatched`. */
export function resolveEvents(
  events: CalendarEvent[],
  directory: ClientEntry[],
  settings: Pick<Settings, "office" | "companyName">
): ResolveResult {
  const resolved: ResolvedEvent[] = [];
  const unmatched: UnmatchedEvent[] = [];
  for (const event of events) {
    const stop = resolveStop(event, directory, settings);
    if (stop) resolved.push({ ...stop, event });
    else unmatched.push({ event, reason: "Geen locatie gevonden voor dit event" });
  }
  return { resolved, unmatched };
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (!a.startTime && !b.startTime) return 0;
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return a.startTime.localeCompare(b.startTime);
}

/**
 * Bouwt per dag een ritketen: thuis → stop1 → stop2 → … → thuis.
 * Opeenvolgende stops op dezelfde locatie leveren geen rit op.
 */
export async function buildTrips(
  resolved: ResolvedEvent[],
  homeAddress: Location,
  distanceFn: DistanceFn = getDrivingDistanceKm
): Promise<GeneratedTrip[]> {
  const trips: GeneratedTrip[] = [];
  const byDate = new Map<string, ResolvedEvent[]>();
  for (const r of [...resolved].sort((a, b) => compareEvents(a.event, b.event))) {
    const list = byDate.get(r.event.date) ?? [];
    list.push(r);
    byDate.set(r.event.date, list);
  }

  for (const [date, stops] of byDate) {
    const chain: Location[] = [homeAddress, ...stops.map((s) => s.location), homeAddress];

    for (let i = 0; i < chain.length - 1; i++) {
      const from = chain[i];
      const to = chain[i + 1];
      if (from.lat === to.lat && from.lon === to.lon) continue;

      // Doel/klant van de bestemming; de terugrit naar huis hoort bij de laatste stop
      const stop = stops[Math.min(i, stops.length - 1)];

      let distanceKm = 0;
      try {
        distanceKm = await distanceFn(from, to);
      } catch {
        distanceKm = 0;
      }

      trips.push({
        id: crypto.randomUUID(),
        date,
        locationA: from,
        locationB: to,
        purpose: stop.event.title,
        client: stop.client,
        billable: stop.billable,
        distanceKm,
        enabled: true,
      });
    }
  }

  return trips;
}

export function generatedTripToTrip(g: GeneratedTrip, rate: number, name: string): Trip {
  return {
    id: g.id,
    date: g.date,
    name,
    purpose: g.purpose,
    client: g.client,
    billable: g.billable,
    locationA: g.locationA,
    locationB: g.locationB,
    distanceKm: g.distanceKm,
    rate,
    amount: Math.round(g.distanceKm * rate * 100) / 100,
  };
}

const ONLINE_LOCATION = /teams|zoom|google meet|webex|skype|online|http|www\.|bellen|telefo/i;

/** Locatieveld uit de agenda dat waarschijnlijk geen fysiek adres is (Teams, Zoom, links). */
export function isOnlineLocation(locationStr: string): boolean {
  return ONLINE_LOCATION.test(locationStr);
}

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Kies het beste resultaat voor een adres als "Straat 1, Plaats".
 * Nominatim zet soms een gelijknamige straat in een andere plaats bovenaan; en "Utrecht" komt
 * ook voor als provincienaam. Daarom vergelijken we de plaats met de plaats van het resultaat.
 */
export function pickBestMatch(query: string, results: Location[]): Location | null {
  const parts = query.split(",").map((p) => normalize(p.trim())).filter(Boolean);
  const city = parts.length > 1 ? parts[parts.length - 1] : null;
  const streetWords = (parts[0] ?? "").split(/\s+/).filter((w) => /[a-z]{2,}/.test(w));

  let best: Location | null = null;
  let bestScore = -1;
  for (const r of results) {
    const short = normalize(r.shortName);
    const resultCity = short.includes(",") ? short.split(",").pop()!.trim() : "";
    let score = 0;
    if (city && resultCity && city.includes(resultCity)) score += 2;
    if (streetWords.every((w) => short.includes(w))) score += 1;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  // Plaats opgegeven maar geen resultaat in die plaats: liever leeg dan een verkeerde stad invullen
  if (city && bestScore < 2) return null;
  return best;
}

// Probeer het locatieveld uit de agenda te geocoden
export async function geocodeEventLocation(locationStr: string): Promise<Location | null> {
  if (!locationStr.trim() || isOnlineLocation(locationStr)) return null;
  try {
    return pickBestMatch(locationStr, await searchLocations(locationStr));
  } catch {
    return null;
  }
}
