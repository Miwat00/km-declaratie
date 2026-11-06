import { describe, expect, it } from "vitest";
import { buildCsv, buildEmail, tripRate } from "@/lib/export";
import type { Trip } from "@/lib/types";

const loc = (name: string) => ({ lat: 0, lon: 0, shortName: name, displayName: name });
const trip = (over: Partial<Trip>): Trip => ({
  id: "1", date: "2025-03-10", name: "Sam", purpose: "Bezoek", client: "Acme", billable: true,
  locationA: loc("Thuis"), locationB: loc("Coolsingel 40, Rotterdam"),
  distanceKm: 10, rate: 0.23, amount: 2.3, ...over,
});

describe("buildCsv", () => {
  it("gebruikt ; en komma-decimalen, sorteert op datum en telt op", () => {
    const csv = buildCsv([
      trip({ id: "2", date: "2025-03-11", distanceKm: 20.5, rate: 0.25, amount: 5.13 }),
      trip({ id: "1" }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain('"Klant / project"');
    expect(lines[1]).toBe(
      '"10-03-2025";"Sam";"Bezoek";"Acme";"Ja";"Thuis";"Coolsingel 40, Rotterdam";"10,0";"0,23";"2,30"'
    );
    expect(lines[2]).toContain('"0,25";"5,13"');
    expect(lines[3]).toBe('"Totaal";"";"";"";"";"";"";"30,5";"";"7,43"');
  });

  it("escapet aanhalingstekens", () => {
    expect(buildCsv([trip({ purpose: 'Project "X"' })])).toContain('"Project ""X"""');
  });
});

describe("tripRate", () => {
  it("leidt het tarief af bij oude ritten zonder opgeslagen tarief", () => {
    expect(tripRate(trip({ rate: undefined, distanceKm: 10, amount: 2.1 }))).toBe(0.21);
  });
});

describe("buildEmail", () => {
  it("vat periode, kilometers en bedrag samen", () => {
    const { subject, body } = buildEmail([trip({}), trip({ id: "2", date: "2025-03-14" })]);
    expect(subject).toBe("Kilometerdeclaratie Sam — 10-03-2025 t/m 14-03-2025");
    expect(body).toContain("Totaal kilometers: 20,0 km");
    expect(body).toContain("Totaal bedrag:     € 4,60");
  });
});
