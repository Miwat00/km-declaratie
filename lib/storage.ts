import type { Trip, Location, ClientEntry, Settings } from "./types";

const TRIPS_KEY = "kilometer_trips";
const RATE_KEY = "kilometer_rate";
const HOME_KEY = "kilometer_home_address";
const CLIENT_DIR_KEY = "kilometer_client_directory";
const SETTINGS_KEY = "kilometer_settings";

export const DEFAULT_RATE = 0.23;
export const DEFAULT_SETTINGS: Settings = { userName: "", companyName: "", office: null };

export function loadTrips(): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function loadRate(): number {
  if (typeof window === "undefined") return DEFAULT_RATE;
  const raw = localStorage.getItem(RATE_KEY);
  const val = raw ? parseFloat(raw) : NaN;
  return isNaN(val) || val <= 0 ? DEFAULT_RATE : val;
}

export function saveRate(rate: number): void {
  localStorage.setItem(RATE_KEY, String(rate));
}

export function loadHomeAddress(): Location | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveHomeAddress(loc: Location | null): void {
  if (loc === null) {
    localStorage.removeItem(HOME_KEY);
  } else {
    localStorage.setItem(HOME_KEY, JSON.stringify(loc));
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function loadClientDirectory(): ClientEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLIENT_DIR_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClientDirectory(entries: ClientEntry[]): void {
  localStorage.setItem(CLIENT_DIR_KEY, JSON.stringify(entries));
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const SETTINGS_EVENT = "kilometer-settings-changed";

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  saveSettings(next);
  return next;
}

const CALENDAR_URL_KEY = "kilometer_calendar_url";

/** Agenda-link die de gebruiker liet onthouden. Geeft leestoegang tot de agenda: alleen lokaal bewaard. */
export function loadCalendarUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CALENDAR_URL_KEY) ?? "";
}

export function saveCalendarUrl(url: string | null): void {
  if (url) localStorage.setItem(CALENDAR_URL_KEY, url);
  else localStorage.removeItem(CALENDAR_URL_KEY);
}
