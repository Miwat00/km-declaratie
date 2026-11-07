import { describe, expect, it } from "vitest";
import { markDeclared, sortTrips } from "@/lib/trips";
import type { Location, Trip } from "@/lib/types";

const loc = (name: string, lat: number): Location => ({ lat, lon: 4, shortName: name, displayName: name });
const trip = (id: string, date: string, over: Partial<Trip> = {}): Trip => ({
  id, date, name: "Sam", purpose: "Kantoor", client: "Bedrijf", billable: false,
  locationA: loc("Thuis", 52), locationB: loc("Kantoor", 51.9), distanceKm: 10, rate: 0.23, amount: 2.3, ...over,
});

describe("sortTrips", () => {
  it("sorteert op datum en houdt de volgorde binnen een dag", () => {
    expect(sortTrips([trip("a", "2026-11-03"), trip("b", "2026-11-02"), trip("c", "2026-11-03")]).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});

describe("markDeclared", () => {
  it("markeert alleen de gekozen ritten en laat eerdere datums staan", () => {
    const trips = [trip("a", "2026-11-02"), trip("b", "2026-11-04", { declaredAt: "2026-11-05" })];
    const marked = markDeclared(trips, new Set(["a"]), "2026-11-06");
    expect(marked.map((t) => t.declaredAt)).toEqual(["2026-11-06", "2026-11-05"]);
  });
});
