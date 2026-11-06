import type { Location, RouteData } from "./types";

export async function getDrivingDistanceKm(
  from: Location,
  to: Location
): Promise<number> {
  const data = await getRouteWithGeometry(from, to);
  return data.distanceKm;
}

export async function getRouteWithGeometry(
  from: Location,
  to: Location
): Promise<RouteData> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Afstandsberekening mislukt");

  const data = await res.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("Geen route gevonden tussen deze locaties");
  }

  const route = data.routes[0];
  const distanceKm = Math.round((route.distance / 1000) * 10) / 10;

  // GeoJSON coordinates are [lon, lat] — convert to [lat, lon] for Leaflet
  const coordinates: [number, number][] = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => [lat, lon]
  );

  return { distanceKm, coordinates };
}
