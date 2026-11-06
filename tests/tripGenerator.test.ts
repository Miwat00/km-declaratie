import { describe, expect, it } from "vitest";
import { buildTrips, generatedTripToTrip, isOnlineLocation, pickBestMatch, resolveEvents } from "@/lib/tripGenerator";
import type { CalendarEvent, ClientEntry, Location } from "@/lib/types";

const loc = (name: string, lat: number, lon: number): Location => ({
  lat, lon, shortName: name, displayName: name,
});
const HOME = loc("Thuis", 52.0, 4.0);
const OFFICE = loc("Kantoor", 52.1, 4.1);
const KLANT = loc("Klant A", 52.2, 4.2);

const event = (title: string, date: string, startTime?: string): CalendarEvent => ({
  id: `${title}-${date}-${startTime}`, title, date, startTime,
});

const directory: ClientEntry[] = [
  { keyword: "acme", location: KLANT, client: "Acme", billable: true },
];
const settings = { office: OFFICE, companyName: "Mijn Bedrijf" };

describe("resolveEvents", () => {
  it("koppelt via klant-koppelingen en kantoor-trefwoord", () => {
    const { resolved, unmatched } = resolveEvents(
      [event("Kantoordag", "2025-03-10"), event("Workshop ACME", "2025-03-10"), event("Lunch", "2025-03-10")],
      directory,
      settings,
    );
    expect(resolved.map((r) => [r.event.title, r.client, r.billable])).toEqual([
      ["Kantoordag", "Mijn Bedrijf", false],
      ["Workshop ACME", "Acme", true],
    ]);
    expect(unmatched.map((u) => u.event.title)).toEqual(["Lunch"]);
  });

  it("klant-koppeling gaat voor op het woord 'kantoor'", () => {
    const { resolved } = resolveEvents([event("Acme op kantoor", "2025-03-10")], directory, settings);
    expect(resolved[0].client).toBe("Acme");
  });

  it("zonder ingesteld kantoor blijft een kantoor-afspraak ongekoppeld", () => {
    const { unmatched } = resolveEvents([event("Kantoor", "2025-03-10")], [], { office: null, companyName: "" });
    expect(unmatched).toHaveLength(1);
  });
});

describe("buildTrips", () => {
  const fakeDistance = async (a: Location, b: Location) =>
    Math.round((Math.abs(a.lat - b.lat) + Math.abs(a.lon - b.lon)) * 1000) / 10;

  it("maakt per dag één keten thuis → stops → thuis, op volgorde van starttijd", async () => {
    const { resolved } = resolveEvents(
      [event("Workshop Acme", "2025-03-10", "14:00"), event("Kantoor", "2025-03-10", "09:00")],
      directory,
      settings,
    );
    const trips = await buildTrips(resolved, HOME, fakeDistance);
    expect(trips.map((t) => `${t.locationA.shortName} → ${t.locationB.shortName} (${t.client})`)).toEqual([
      "Thuis → Kantoor (Mijn Bedrijf)",
      "Kantoor → Klant A (Acme)",
      "Klant A → Thuis (Acme)",
    ]);
    expect(trips.every((t) => t.distanceKm > 0)).toBe(true);
  });

  it("slaat ritten tussen dezelfde locatie over", async () => {
    const { resolved } = resolveEvents(
      [event("Acme ochtend", "2025-03-10", "09:00"), event("Acme middag", "2025-03-10", "13:00")],
      directory,
      settings,
    );
    const trips = await buildTrips(resolved, HOME, fakeDistance);
    expect(trips).toHaveLength(2);
  });

  it("zet afstand op 0 als de routeservice faalt", async () => {
    const { resolved } = resolveEvents([event("Acme", "2025-03-10")], directory, settings);
    const trips = await buildTrips(resolved, HOME, async () => {
      throw new Error("offline");
    });
    expect(trips.map((t) => t.distanceKm)).toEqual([0, 0]);
  });
});

describe("generatedTripToTrip", () => {
  it("rekent het bedrag uit en bewaart het tarief", () => {
    const trip = generatedTripToTrip(
      {
        id: "1", date: "2025-03-10", locationA: HOME, locationB: KLANT, purpose: "x", client: "Acme",
        billable: true, distanceKm: 12.3, enabled: true,
      },
      0.23,
      "Sam",
    );
    expect(trip).toMatchObject({ rate: 0.23, amount: 2.83, name: "Sam" });
  });
});

describe("pickBestMatch", () => {
  it("kiest het resultaat in de juiste plaats, ook als het niet bovenaan staat", () => {
    const results = [
      { ...loc("Stationsplein 1, Amersfoort", 0, 0), displayName: "1, Stationsplein, Amersfoort, Utrecht, Nederland" },
      { ...loc("Stationsplein 1, Utrecht", 0, 0), displayName: "1, Stationsplein, Utrecht, Utrecht, Nederland" },
    ];
    expect(pickBestMatch("Stationsplein 1, Utrecht", results)?.shortName).toBe("Stationsplein 1, Utrecht");
  });
  it("herkent de plaats ook met postcode ervoor", () => {
    const results = [loc("Coolsingel 40, Den Haag", 0, 0), loc("Coolsingel 40, Rotterdam", 0, 0)];
    expect(pickBestMatch("Coolsingel 40, 3011 AD Rotterdam", results)?.shortName).toBe("Coolsingel 40, Rotterdam");
  });
  it("geeft niets terug als geen enkel resultaat in de gevraagde plaats ligt", () => {
    expect(pickBestMatch("Stationsplein 1, Utrecht", [loc("Stationsplein 1, Amersfoort", 0, 0)])).toBeNull();
  });
  it("zonder plaats in de zoekvraag valt hij terug op het eerste resultaat", () => {
    expect(pickBestMatch("Jaarbeurs", [loc("Jaarbeursplein 6, Utrecht", 0, 0)])?.shortName).toBe("Jaarbeursplein 6, Utrecht");
  });
});

describe("isOnlineLocation", () => {
  it.each(["Microsoft Teams Meeting", "https://zoom.us/j/123", "Online"])("%s is online", (s) => {
    expect(isOnlineLocation(s)).toBe(true);
  });
  it("een adres is niet online", () => {
    expect(isOnlineLocation("Coolsingel 40, Rotterdam")).toBe(false);
  });
});
