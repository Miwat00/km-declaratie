import { describe, expect, it } from "vitest";
import {
  addDays, eventStatus, fromMin, legToTrip, mondayOf, planDay, routeKey, toMin, weekSummary,
  type EventDecision, type ManualStop, type PlannedEvent, type RouteLookup,
} from "@/lib/dayPlan";
import type { CalendarEvent, ClientEntry, Location } from "@/lib/types";

const loc = (name: string, lat: number, lon: number): Location => ({ lat, lon, shortName: name, displayName: name });
const HOME = loc("Thuis", 52.0, 4.0);
const OFFICE = loc("Kantoor", 52.1, 4.1);
const KLANT = loc("Klant", 52.2, 4.2);
const POMP = loc("Tankstation", 52.05, 4.05);
const DATE = "2026-11-09";

const directory: ClientEntry[] = [{ keyword: "acme", location: KLANT, client: "Acme", billable: true }];
const settings = { office: OFFICE, companyName: "Mijn Bedrijf" };

const ev = (title: string, start?: string, end?: string, location?: string): CalendarEvent => ({
  id: `${title}-${start}`, title, date: DATE, startTime: start, endTime: end, location,
});
const plan = (event: CalendarEvent, decision?: EventDecision, geocoded?: Location | null): PlannedEvent => ({
  event, status: eventStatus(event, decision, directory, settings, geocoded),
});

/** Nep-route: 10 km en 20 minuten per 0,1 graad verschil. */
const lookup: RouteLookup = (a, b) => {
  const d = Math.abs(a.lat - b.lat) + Math.abs(a.lon - b.lon);
  return { km: Math.round(d * 500) / 10, min: Math.round(d * 100) };
};

describe("eventStatus", () => {
  it("koppelt via kantoor en klant-koppeling", () => {
    expect(plan(ev("Kantoordag", "09:00")).status).toMatchObject({ kind: "linked", source: "kantoor", client: "Mijn Bedrijf", billable: false });
    expect(plan(ev("Workshop ACME", "13:00")).status).toMatchObject({ kind: "linked", source: "koppeling", client: "Acme", billable: true });
  });

  it("slaat online en hele-dag-afspraken over, tenzij ze gekoppeld zijn", () => {
    expect(plan(ev("Sync", "09:00", "09:30", "Microsoft Teams Meeting")).status).toEqual({ kind: "skip", reason: "online" });
    expect(plan(ev("Verjaardag")).status).toEqual({ kind: "skip", reason: "hele dag" });
    expect(plan(ev("Kantoordag")).status).toMatchObject({ kind: "linked", source: "kantoor" });
  });

  it("gebruikt een gevonden agenda-adres, anders moet hij gekoppeld worden", () => {
    expect(plan(ev("Lunch", "12:00"), undefined, KLANT).status).toMatchObject({ kind: "linked", source: "agenda", client: "Lunch" });
    expect(plan(ev("Lunch", "12:00")).status).toEqual({ kind: "todo" });
  });

  it("eigen keuze wint van alles", () => {
    expect(plan(ev("Kantoordag", "09:00"), { kind: "skip" }).status).toEqual({ kind: "skip", reason: "handmatig" });
    expect(plan(ev("Lunch", "12:00"), { kind: "link", location: POMP, client: "X", billable: false }).status)
      .toMatchObject({ kind: "linked", source: "handmatig", location: POMP });
  });
});

describe("planDay", () => {
  it("maakt thuis → afspraken → thuis, met reistijd vóór de afspraak", () => {
    const legs = planDay(DATE, [plan(ev("Workshop Acme", "13:00", "16:00")), plan(ev("Kantoor", "09:00", "12:00"))], [], HOME, lookup, {}, []);
    expect(legs.map((l) => `${l.from.shortName}→${l.to.shortName} ${fromMin(l.departMin)}-${fromMin(l.arriveMin)} ${l.client}`)).toEqual([
      "Thuis→Kantoor 08:40-09:00 Mijn Bedrijf",
      "Kantoor→Klant 12:40-13:00 Acme",
      "Klant→Thuis 16:00-16:40 Acme",
    ]);
    expect(legs.map((l) => l.km)).toEqual([10, 10, 20]);
  });

  it("negeert overgeslagen en ongekoppelde afspraken, en dubbele locaties", () => {
    const legs = planDay(DATE, [
      plan(ev("Acme ochtend", "09:00", "11:00")),
      plan(ev("Sync", "11:00", "11:30", "Teams")),
      plan(ev("Lunch", "12:00")),
      plan(ev("Acme middag", "13:00", "15:00")),
    ], [], HOME, lookup, {}, []);
    expect(legs.map((l) => `${l.from.shortName}→${l.to.shortName}`)).toEqual(["Thuis→Klant", "Klant→Thuis"]);
    expect(legs[1].departMin).toBe(toMin("15:00"));
  });

  it("voegt een zelf toegevoegde tussenstop op tijd in de route in", () => {
    const pomp: ManualStop = { id: "m", date: DATE, time: "08:00", location: POMP, purpose: "Tanken", client: "Mijn Bedrijf", billable: false };
    const legs = planDay(DATE, [plan(ev("Kantoordag", "09:00", "17:00"))], [pomp], HOME, lookup, {}, []);
    expect(legs.map((l) => `${l.from.shortName}→${l.to.shortName}${l.manual ? " (zelf)" : ""}`)).toEqual([
      "Thuis→Tankstation (zelf)", "Tankstation→Kantoor", "Kantoor→Thuis",
    ]);
  });

  it("past eigen afstand en uitzetten toe via stabiele sleutels", () => {
    const events = [plan(ev("Kantoordag", "09:00", "17:00"))];
    const first = planDay(DATE, events, [], HOME, lookup, {}, []);
    const overrides = { [first[0].key]: { km: 12.5 }, [first[1].key]: { disabled: true } };
    const legs = planDay(DATE, events, [], HOME, lookup, overrides, []);
    expect(legs[0]).toMatchObject({ km: 12.5, routeKm: 10, disabled: false });
    expect(legs[1].disabled).toBe(true);
    expect(first[0].key).toBe(`${DATE}|${routeKey(HOME, OFFICE)}|1`);
  });

  it("markeert ritten die al in je overzicht staan", () => {
    const legs = planDay(DATE, [plan(ev("Kantoordag", "09:00"))], [], HOME, lookup, {}, [
      { date: DATE, locationA: HOME, locationB: OFFICE },
    ]);
    expect(legs.map((l) => l.alreadyAdded)).toEqual([true, false]);
  });

  it("laat de afstand leeg als de route niet lukt", () => {
    const failing: RouteLookup = () => "error";
    const legs = planDay(DATE, [plan(ev("Kantoordag", "09:00"))], [], HOME, failing, {}, []);
    expect(legs[0]).toMatchObject({ km: null, routeStatus: "error" });
    expect(weekSummary(legs)).toMatchObject({ count: 2, missingKm: 2, km: 0 });
  });
});

describe("weekSummary en legToTrip", () => {
  it("telt alleen ritten die meedoen", () => {
    const events = [plan(ev("Kantoordag", "09:00", "17:00"))];
    const base = planDay(DATE, events, [], HOME, lookup, {}, []);
    const legs = planDay(DATE, events, [], HOME, lookup, { [base[1].key]: { disabled: true } }, []);
    expect(weekSummary(legs)).toMatchObject({ count: 1, km: 10, missingKm: 0 });
    expect(legToTrip(legs[0], 0.23, "Sam")).toMatchObject({ distanceKm: 10, amount: 2.3, rate: 0.23, name: "Sam", purpose: "Kantoordag" });
  });
});

describe("weekhulp", () => {
  it("vindt de maandag en telt dagen op", () => {
    expect(mondayOf("2026-11-12")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
