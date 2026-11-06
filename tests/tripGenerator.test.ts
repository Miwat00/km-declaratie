import { describe, expect, it } from "vitest";
import { isOnlineLocation, pickBestMatch, resolveStop } from "@/lib/tripGenerator";
import type { CalendarEvent, ClientEntry, Location } from "@/lib/types";

const loc = (name: string, lat: number, lon: number): Location => ({
  lat, lon, shortName: name, displayName: name,
});
const OFFICE = loc("Kantoor", 52.1, 4.1);
const KLANT = loc("Klant A", 52.2, 4.2);
const event = (title: string): CalendarEvent => ({ id: title, title, date: "2025-03-10" });
const directory: ClientEntry[] = [{ keyword: "acme", location: KLANT, client: "Acme", billable: true }];
const settings = { office: OFFICE, companyName: "Mijn Bedrijf" };

describe("resolveStop", () => {
  it("koppelt via klant-koppelingen en het kantoor-trefwoord", () => {
    expect(resolveStop(event("Workshop ACME"), directory, settings)).toEqual({ location: KLANT, client: "Acme", billable: true });
    expect(resolveStop(event("Kantoordag"), directory, settings)).toEqual({ location: OFFICE, client: "Mijn Bedrijf", billable: false });
    expect(resolveStop(event("Lunch"), directory, settings)).toBeNull();
  });

  it("klant-koppeling gaat voor op het woord 'kantoor'", () => {
    expect(resolveStop(event("Acme op kantoor"), directory, settings)?.client).toBe("Acme");
  });

  it("zonder ingesteld kantoor blijft een kantoor-afspraak ongekoppeld", () => {
    expect(resolveStop(event("Kantoor"), [], { office: null, companyName: "" })).toBeNull();
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
