"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { RouteData, Location } from "@/lib/types";

// Fix Leaflet default marker icons in Next.js/webpack
const greenIcon = L.divIcon({
  className: "",
  html: `<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const redIcon = L.divIcon({
  className: "",
  html: `<div style="background:#dc2626;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [24, 24] });
    }
  }, [map, coordinates]);
  return null;
}

type Props = {
  route: RouteData;
  locationA: Location;
  locationB: Location;
};

export default function RouteMap({ route, locationA, locationB }: Props) {
  const center: [number, number] = [
    (locationA.lat + locationB.lat) / 2,
    (locationA.lon + locationB.lon) / 2,
  ];

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 260 }}>
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* OSM-tegels vereisen naamsvermelding: https://operations.osmfoundation.org/policies/tiles/ */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Polyline positions={route.coordinates} color="#2563eb" weight={4} opacity={0.85} />
        <Marker position={[locationA.lat, locationA.lon]} icon={greenIcon} />
        <Marker position={[locationB.lat, locationB.lon]} icon={redIcon} />
        <FitBounds coordinates={route.coordinates} />
      </MapContainer>
    </div>
  );
}
