import { describe, expect, it } from "vitest";
import { hasPostcode, isSameAddress, replacePlace } from "@/lib/addressUpgrade";
import type { Location } from "@/lib/types";

const loc = (shortName: string, lat = 52.373, lon = 4.8925): Location => ({ lat, lon, shortName, displayName: shortName });

describe("adressen aanvullen met postcode", () => {
  it("herkent of een adres al een postcode heeft", () => {
    expect(hasPostcode(loc("Dam 1, 1012 JS Amsterdam"))).toBe(true);
    expect(hasPostcode(loc("Dam 1, 1012JS Amsterdam"))).toBe(true);
    expect(hasPostcode(loc("Dam 1, Amsterdam"))).toBe(false);
  });

  it("neemt het gevonden adres alleen over bij dezelfde straat en hetzelfde nummer", () => {
    expect(isSameAddress(loc("Dam 1, Amsterdam"), loc("Dam 1, 1012 JS Amsterdam"))).toBe(true);
    expect(isSameAddress(loc("Dam 1, Amsterdam"), loc("Dam 2, 1012 JS Amsterdam"))).toBe(false);
    expect(isSameAddress(loc("Dam 1, Amsterdam"), loc("Dam 1, Amsterdam"))).toBe(false); // geen postcode gevonden
  });

  it("vervangt de plek in ritten op basis van coördinaten", () => {
    const oud = loc("Dam 1, Amsterdam");
    const nieuw = loc("Dam 1, 1012 JS Amsterdam");
    const elders = loc("Coolsingel 40, Rotterdam", 51.9227, 4.4792);
    const [a, b] = replacePlace([
      { id: "1", locationA: oud, locationB: elders },
      { id: "2", locationA: elders, locationB: elders },
    ], oud, nieuw);
    expect(a.locationA.shortName).toBe("Dam 1, 1012 JS Amsterdam");
    expect(a.locationB.shortName).toBe("Coolsingel 40, Rotterdam");
    expect(b.locationA).toBe(elders);
  });
});
