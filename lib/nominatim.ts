import type { Location } from "./types";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: NominatimAddress;
};

/** Volledig adres zoals een kaartenapp het toont: "Tuinstraat 3, 2514 BX Den Haag". */
export function buildShortName(result: Pick<NominatimResult, "display_name" | "address">): string {
  const a = result.address;
  if (!a) return result.display_name.split(",")[0].trim();

  const street = a.road || a.pedestrian || a.footway || a.path;
  const number = a.house_number;
  const city = a.city || a.town || a.village || a.municipality;
  // Nederlandse postcodes met spatie: "2514BX" → "2514 BX"
  const postcode = a.postcode?.trim().replace(/^(\d{4})\s*([A-Za-z]{2})$/, (_, d, l) => `${d} ${l.toUpperCase()}`);

  const parts: string[] = [];
  if (street && number) parts.push(`${street} ${number}`);
  else if (street) parts.push(street);
  else parts.push(result.display_name.split(",")[0].trim());

  const place = [postcode, city].filter(Boolean).join(" ");
  if (place) parts.push(place);

  return parts.join(", ");
}

function getAddressScore(result: NominatimResult): number {
  const a = result.address;
  if (!a) return 0;
  if (a.house_number) return 3;
  if (a.road || a.pedestrian || a.footway) return 2;
  if (a.city || a.town || a.village) return 1;
  return 0;
}

// Nominatim usage policy: maximaal 1 request per seconde.
// https://operations.osmfoundation.org/policies/nominatim/
const MIN_INTERVAL_MS = 1100;
let nextSlot = 0;

function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

export async function searchLocations(query: string): Promise<Location[]> {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "8",
    addressdetails: "1",
    dedupe: "1",
  });

  // Browsers sturen zelf een Referer mee; een eigen User-Agent zetten kan vanuit de browser niet.
  await throttle();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "Accept-Language": "nl" },
  });

  if (!res.ok) return [];

  const data: NominatimResult[] = await res.json();

  const sorted = [...data].sort(
    (a, b) => getAddressScore(b) - getAddressScore(a)
  );

  return sorted.slice(0, 6).map((item) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
    shortName: buildShortName(item),
  }));
}

/** Adres bij coördinaten (omgekeerd zoeken), in hetzelfde formaat als de zoekresultaten. */
export async function reverseLocation(lat: number, lon: number): Promise<Location | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), format: "json", addressdetails: "1", zoom: "18" });
  await throttle();
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { "Accept-Language": "nl" } });
  if (!res.ok) return null;
  const item: NominatimResult & { error?: string } = await res.json();
  if (item.error || !item.address) return null;
  return { lat, lon, displayName: item.display_name, shortName: buildShortName(item) };
}
