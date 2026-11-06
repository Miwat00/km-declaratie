export type Location = {
  lat: number;
  lon: number;
  displayName: string;
  shortName: string;
};

export type Trip = {
  id: string;
  date: string;
  name: string;
  purpose: string;
  client: string;
  billable: boolean;
  locationA: Location;
  locationB: Location;
  distanceKm: number;
  /** Tarief (€/km) op het moment van invoeren. Ontbreekt bij ritten van vóór v2.1. */
  rate?: number;
  amount: number;
  /** YYYY-MM-DD waarop de rit als gedeclareerd is gemarkeerd. */
  declaredAt?: string;
};

export type RouteData = {
  distanceKm: number;
  /** Reistijd in minuten volgens de routeservice */
  durationMin: number;
  coordinates: [number, number][]; // [lat, lon] pairs for Leaflet
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;
  location?: string;  // raw adresveld uit agenda
};

export type ClientEntry = {
  keyword: string;   // matched tegen event title (case-insensitive contains)
  location: Location;
  client: string;    // klantnaam voor de rit
  billable: boolean;
};

export type Settings = {
  userName: string;
  companyName: string;
  office: Location | null;
};
