import { describe, expect, it } from "vitest";
import {
  addMonths, frequentRoutes, journeyLabel, journeys, monthSummary, monthTitle, pickStartMonth, unmarkDeclared, weekStartOf,
} from "@/lib/month";
import type { Location, Trip } from "@/lib/types";

const loc = (shortName: string, lat: number): Location => ({ lat, lon: 4, shortName, displayName: shortName });
const HOME = loc("Dam 1, Amsterdam", 52.37);
const OFFICE = loc("Jaarbeursplein 6, Utrecht", 52.09);
const CLIENT = loc("Grote Markt 1, Haarlem", 52.38);

let n = 0;
const trip = (date: string, a: Location, b: Location, km: number, over: Partial<Trip> = {}): Trip => ({
  id: `t${++n}`, date, name: "Sam", purpose: "Kantoordag", client: "Bedrijf", billable: false,
  locationA: a, locationB: b, distanceKm: km, rate: 0.23, amount: Math.round(km * 23) / 100, ...over,
});
const named = (l: Location) => (l === HOME || l.shortName === HOME.shortName ? "Thuis" : l.shortName === OFFICE.shortName ? "Kantoor" : l.shortName.split(",")[0]);

describe("maanden", () => {
  it("rekent maanden door de jaargrens heen", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthTitle("2026-11")).toBe("November 2026");
  });

  it("vat een maand samen met status", () => {
    const open = [trip("2026-11-02", HOME, OFFICE, 46), trip("2026-11-02", OFFICE, HOME, 44.4)];
    expect(monthSummary(open)).toMatchObject({ count: 2, km: 90.4, amount: 20.79, status: { kind: "open" }, names: ["Sam"] });
    expect(monthSummary([]).status).toEqual({ kind: "leeg" });
    const half = [open[0], { ...open[1], declaredAt: "2026-12-01" }];
    expect(monthSummary(half).status).toEqual({ kind: "deels", open: 1 });
    expect(monthSummary(half.map((t) => ({ ...t, declaredAt: "2026-12-03" }))).status).toEqual({ kind: "gedeclareerd", on: "2026-12-03" });
  });

  it("opent op vorige maand als deze maand leeg is en vorige nog open staat", () => {
    const oct = [trip("2026-10-30", HOME, OFFICE, 46)];
    expect(pickStartMonth("2026-11-02", oct)).toBe("2026-10");
    expect(pickStartMonth("2026-11-02", oct.map((t) => ({ ...t, declaredAt: "2026-11-01" })))).toBe("2026-11");
    expect(pickStartMonth("2026-11-02", [...oct, trip("2026-11-02", HOME, OFFICE, 46)])).toBe("2026-11");
  });

  it("kan declareren ongedaan maken", () => {
    const t = { ...trip("2026-11-02", HOME, OFFICE, 46), declaredAt: "2026-12-01" };
    expect("declaredAt" in unmarkDeclared([t], new Set([t.id]))[0]).toBe(false);
  });

  it("vindt de maandag van een week", () => {
    expect(weekStartOf("2026-11-05")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02");
  });
});

describe("journeys", () => {
  it("voegt heen en terug samen tot één reis", () => {
    const js = journeys([trip("2026-11-02", HOME, OFFICE, 46), trip("2026-11-02", OFFICE, HOME, 44.4)]);
    expect(js).toHaveLength(1);
    expect(journeyLabel(js[0], named)).toBe("Thuis ⇄ Kantoor");
    expect(js[0]).toMatchObject({ km: 90.4, purposes: ["Kantoordag"], clients: ["Bedrijf"], declared: false });
  });

  it("toont een rondje met tussenstops als keten", () => {
    const js = journeys([
      trip("2026-11-03", HOME, CLIENT, 22, { purpose: "Kick-off", client: "Theater" }),
      trip("2026-11-03", CLIENT, OFFICE, 50),
      trip("2026-11-03", OFFICE, HOME, 44),
    ]);
    expect(journeyLabel(js[0], named)).toBe("Thuis → Grote Markt 1 → Kantoor → Thuis");
    expect(js[0].purposes).toEqual(["Kick-off", "Kantoordag"]);
  });

  it("houdt verschillende dagen en personen apart", () => {
    const js = journeys([
      trip("2026-11-02", HOME, OFFICE, 46),
      trip("2026-11-02", OFFICE, HOME, 44, { name: "Collega" }),
      trip("2026-11-03", HOME, OFFICE, 46),
    ]);
    expect(js.map((j) => `${j.date} ${j.name} ${j.trips.length}`)).toEqual(["2026-11-02 Sam 1", "2026-11-02 Collega 1", "2026-11-03 Sam 1"]);
  });
});

describe("frequentRoutes", () => {
  it("geeft routes die je op twee dagen reed, met de afstand van heen en terug", () => {
    const trips = [
      trip("2026-11-02", HOME, OFFICE, 46), trip("2026-11-02", OFFICE, HOME, 44.4),
      trip("2026-11-05", HOME, OFFICE, 46.1), trip("2026-11-05", OFFICE, HOME, 44.5),
      trip("2026-11-03", HOME, CLIENT, 22, { purpose: "Kick-off" }), trip("2026-11-03", CLIENT, HOME, 33),
    ];
    const r = frequentRoutes(trips);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ from: HOME, to: OFFICE, purpose: "Kantoordag", kmThere: 46.1, kmBack: 44.5, days: 2 });
  });
});
