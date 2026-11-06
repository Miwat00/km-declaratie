import { test as base, expect, type Page } from "@playwright/test";

/**
 * Vaste adressen voor de nep-Nominatim. De tests praten nooit met echte OpenStreetMap-diensten:
 * dat houdt ze snel en voorspelbaar, en belast de gratis servers niet.
 */
export const ADDRESSES = {
  home: { q: "Dam 1", lat: 52.373, lon: 4.8925, road: "Dam", house_number: "1", city: "Amsterdam" },
  office: { q: "Coolsingel 40", lat: 51.9227, lon: 4.4792, road: "Coolsingel", house_number: "40", city: "Rotterdam" },
  client: { q: "Jaarbeursplein 6", lat: 52.0883, lon: 5.1112, road: "Jaarbeursplein", house_number: "6", city: "Utrecht" },
} as const;

type Address = (typeof ADDRESSES)[keyof typeof ADDRESSES];

export const shortName = (a: Address) => `${a.road} ${a.house_number}, ${a.city}`;

/** Afstand die de nep-OSRM teruggeeft: hemelsbreed × 1,3, afgerond op 100 m (zelfde afronding als de app). */
export function fakeRouteKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
  return Math.round(km * 10) / 10;
}

export type MapServices = {
  /** Laat de routeservice falen, zoals bij een storing van de OSRM-demoserver. */
  failRouting: (fail?: boolean) => void;
};

async function mockMapServices(page: Page): Promise<MapServices> {
  let failRouting = false;

  await page.route("https://nominatim.openstreetmap.org/search?**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const hits = Object.values(ADDRESSES).filter((a) => q.includes(a.q.toLowerCase()));
    return route.fulfill({
      json: hits.map((a, i) => ({
        place_id: i + 1,
        lat: String(a.lat),
        lon: String(a.lon),
        display_name: `${a.house_number}, ${a.road}, ${a.city}, Nederland`,
        type: "house",
        class: "place",
        address: { road: a.road, house_number: a.house_number, city: a.city },
      })),
    });
  });

  await page.route("https://router.project-osrm.org/route/**", (route) => {
    if (failRouting) return route.abort("internetdisconnected");
    const coords = new URL(route.request().url()).pathname.split("/").pop()!;
    const [[lonA, latA], [lonB, latB]] = coords.split(";").map((p) => p.split(",").map(Number));
    const km = fakeRouteKm({ lat: latA, lon: lonA }, { lat: latB, lon: lonB });
    return route.fulfill({
      json: {
        code: "Ok",
        routes: [{ distance: km * 1000, geometry: { type: "LineString", coordinates: [[lonA, latA], [lonB, latB]] } }],
      },
    });
  });

  // Kaarttegels zijn niet nodig voor de tests
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());

  return { failRouting: (fail = true) => void (failRouting = fail) };
}

type Seed = {
  settings?: { userName: string; companyName: string; office: unknown };
  home?: unknown;
  trips?: unknown[];
};

export const locationOf = (a: Address) => ({
  lat: a.lat,
  lon: a.lon,
  shortName: shortName(a),
  displayName: `${a.house_number}, ${a.road}, ${a.city}, Nederland`,
});

export const DEFAULT_SEED: Seed = {
  settings: { userName: "Sam Tester", companyName: "Voorbeeld BV", office: locationOf(ADDRESSES.office) },
  home: locationOf(ADDRESSES.home),
};

/** Zet app-data in localStorage en laadt de pagina opnieuw. */
export async function seed(page: Page, data: Seed, path = "/") {
  await page.goto(path);
  await page.evaluate((d) => {
    localStorage.clear();
    if (d.settings) localStorage.setItem("kilometer_settings", JSON.stringify(d.settings));
    if (d.home) localStorage.setItem("kilometer_home_address", JSON.stringify(d.home));
    if (d.trips) localStorage.setItem("kilometer_trips", JSON.stringify(d.trips));
  }, data);
  await page.reload();
}

export const test = base.extend<{ map: MapServices }>({
  // auto: elke test krijgt de nepdiensten, ook als hij `map` niet zelf gebruikt
  map: [
    async ({ page }, use) => {
      await use(await mockMapServices(page));
    },
    { auto: true },
  ],
});

/** Tabel (desktop) en kaartjes (mobiel) staan allebei in de DOM; dit pakt de zichtbare. */
export const visible = <T extends { filter: (o: { visible: boolean }) => T }>(locator: T) =>
  locator.filter({ visible: true });

export { expect };
