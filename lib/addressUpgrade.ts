import type { Location, Trip } from "./types";
import { reverseLocation } from "./nominatim";
import {
  loadClientDirectory, loadHomeAddress, loadSettings, loadTrips,
  saveClientDirectory, saveHomeAddress, saveTrips, updateSettings,
} from "./storage";

/** Heeft dit adres al een (Nederlandse) postcode? Dan is het al volledig. */
export const hasPostcode = (l: Location) => /\b\d{4}\s?[A-Z]{2}\b/.test(l.shortName);

// Adressen die we al eens probeerden aan te vullen, zodat we OpenStreetMap niet bij elk bezoek vragen
const CHECKED_KEY = "kilometer_address_checked";
const keyOf = (l: Location) => `${l.lat.toFixed(5)},${l.lon.toFixed(5)}`;
function loadChecked(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHECKED_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function markChecked(l: Location) {
  localStorage.setItem(CHECKED_KEY, JSON.stringify([...new Set([...loadChecked(), keyOf(l)])]));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const street = (s: string) => norm(s.split(",")[0]);

/**
 * Een opgezocht adres is alleen een aanvulling als het om dezelfde straat en hetzelfde nummer gaat;
 * anders laten we het oude adres staan (omgekeerd zoeken kan een buurpand opleveren).
 */
export function isSameAddress(old: Location, found: Location): boolean {
  return street(old.shortName) === street(found.shortName) && hasPostcode(found);
}

/** Vervang overal dezelfde plek (zelfde coördinaten) door het volledige adres. */
export function replacePlace<T extends { locationA: Location; locationB: Location }>(trips: T[], from: Location, to: Location): T[] {
  const same = (l: Location) => l.lat.toFixed(5) === from.lat.toFixed(5) && l.lon.toFixed(5) === from.lon.toFixed(5);
  const fix = (l: Location) => (same(l) ? { ...l, shortName: to.shortName, displayName: to.displayName } : l);
  return trips.map((t) => (same(t.locationA) || same(t.locationB) ? { ...t, locationA: fix(t.locationA), locationB: fix(t.locationB) } : t));
}

/**
 * Thuis- en kantooradressen van vóór v3.5 hebben geen postcode. Vul die eenmalig aan via
 * OpenStreetMap, ook in eerdere ritten en onthouden plekken. Geeft true terug als er iets veranderde.
 */
export async function upgradeHomeAndOffice(): Promise<boolean> {
  const home = loadHomeAddress();
  const office = loadSettings().office;
  const checked = loadChecked();
  const todo = [home, office].filter((l): l is Location => !!l && !hasPostcode(l) && !checked.includes(keyOf(l)));
  if (todo.length === 0) return false;

  let changed = false;
  for (const old of todo) {
    let found: Location | null = null;
    try {
      found = await reverseLocation(old.lat, old.lon);
    } catch {
      return changed; // geen internet: volgende keer opnieuw
    }
    markChecked(old);
    if (!found || !isSameAddress(old, found)) continue;
    const full: Location = { ...old, shortName: found.shortName, displayName: found.displayName };

    if (home && old === home) saveHomeAddress(full);
    if (office && old === office) updateSettings({ office: full });
    saveTrips(replacePlace<Trip>(loadTrips(), old, full));
    const same = (l: Location) => l.lat.toFixed(5) === old.lat.toFixed(5) && l.lon.toFixed(5) === old.lon.toFixed(5);
    saveClientDirectory(loadClientDirectory().map((e) => (same(e.location) ? { ...e, location: full } : e)));
    changed = true;
  }
  return changed;
}
