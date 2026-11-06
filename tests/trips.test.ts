import { describe, expect, it } from "vitest";
import {
  filterTrips, formatMonth, markDeclared, monthsOf, sortTrips, tripSuggestions,
} from "@/lib/trips";
import type { Location, Trip } from "@/lib/types";

const loc = (name: string, lat: number): Location => ({ lat, lon: 4, shortName: name, displayName: name });
const HOME = loc("Thuis", 52);
const OFFICE = loc("Kantoor", 51.9);
const KLANT = loc("Klant", 52.1);

let n = 0;
const trip = (over: Partial<Trip>): Trip => ({
  id: String(++n), date: "2026-11-02", name: "Sam", purpose: "Kantoor", client: "Bedrijf", billable: false,
  locationA: HOME, locationB: OFFICE, distanceKm: 10, rate: 0.23, amount: 2.3, ...over,
});

describe("sortTrips", () => {
  it("sorteert op datum en houdt de volgorde binnen een dag", () => {
    const a = trip({ id: "a", date: "2026-11-03" });
    const b = trip({ id: "b", date: "2026-11-02" });
    const c = trip({ id: "c", date: "2026-11-03" });
    expect(sortTrips([a, b, c]).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});

describe("filters", () => {
  const trips = [
    trip({ id: "okt", date: "2026-10-30", declaredAt: "2026-11-01" }),
    trip({ id: "nov1", date: "2026-11-02" }),
    trip({ id: "nov2", date: "2026-11-04", declaredAt: "2026-11-05" }),
  ];

  it("geeft maanden nieuwste eerst", () => {
    expect(monthsOf(trips)).toEqual(["2026-11", "2026-10"]);
  });

  it("filtert op maand en status", () => {
    const ids = (f: Parameters<typeof filterTrips>[1]) => filterTrips(trips, f).map((t) => t.id);
    expect(ids({ month: "2026-11", status: "all" })).toEqual(["nov1", "nov2"]);
    expect(ids({ month: "all", status: "open" })).toEqual(["nov1"]);
    expect(ids({ month: "2026-11", status: "declared" })).toEqual(["nov2"]);
  });

  it("markeert alleen de gekozen ritten en laat eerdere datums staan", () => {
    const marked = markDeclared(trips, new Set(["nov1"]), "2026-11-06");
    expect(marked.find((t) => t.id === "nov1")?.declaredAt).toBe("2026-11-06");
    expect(marked.find((t) => t.id === "nov2")?.declaredAt).toBe("2026-11-05");
  });

  it("schrijft maanden uit", () => {
    expect(formatMonth("2026-11")).toBe("november 2026");
  });
});

describe("tripSuggestions", () => {
  it("bundelt heen en terug en toont alleen routes die vaker gereden zijn", () => {
    const trips = [
      trip({ locationA: HOME, locationB: OFFICE }),
      trip({ locationA: OFFICE, locationB: HOME }),
      trip({ locationA: HOME, locationB: OFFICE, date: "2026-11-09" }),
      trip({ locationA: HOME, locationB: KLANT, purpose: "Workshop", client: "Acme" }),
    ];
    const s = tripSuggestions(trips);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ purpose: "Kantoor", count: 2 }); // 2 verschillende dagen
  });

  it("één keer heen en terug is nog geen snelkeuze", () => {
    expect(tripSuggestions([
      trip({ locationA: HOME, locationB: OFFICE }),
      trip({ locationA: OFFICE, locationB: HOME }),
    ])).toEqual([]);
  });

  it("sorteert op aantal keer en dan op meest recent", () => {
    const trips = [
      trip({ locationB: KLANT, purpose: "A", date: "2026-10-01" }),
      trip({ locationB: KLANT, purpose: "A", date: "2026-10-02" }),
      trip({ locationB: OFFICE, purpose: "B", date: "2026-11-01" }),
      trip({ locationB: OFFICE, purpose: "B", date: "2026-11-02" }),
    ];
    expect(tripSuggestions(trips).map((s) => s.purpose)).toEqual(["B", "A"]);
  });
});
