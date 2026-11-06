import type { CalendarEvent, ClientEntry, Location, Settings } from "./types";
import { searchLocations } from "./nominatim";

/** Afspraken koppelen aan een locatie, en locatievelden uit de agenda opzoeken. */

export type Stop = {
  location: Location;
  client: string;
  billable: boolean;
};

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
