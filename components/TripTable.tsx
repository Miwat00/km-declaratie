"use client";

import { useState, useRef, useEffect } from "react";
import type { Trip } from "@/lib/types";

type Props = {
  trips: Trip[];
  onDelete: (id: string) => void;
  onEdit: (trip: Trip) => void;
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

function DeclaredBadge({ date }: { date: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 flex-shrink-0"
      title={`Gedeclareerd op ${formatDate(date)}`}
    >
      Gedeclareerd
    </span>
  );
}

export default function TripTable({ trips, onDelete, onEdit }: Props) {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const teaseShown = useRef(false);

  useEffect(() => {
    if (teaseShown.current) return;
    if (trips.length === 0) return;
    if (sessionStorage.getItem("swipe-tease-shown")) return;
    teaseShown.current = true;
    sessionStorage.setItem("swipe-tease-shown", "1");
    const firstId = trips[0].id;
    const t1 = setTimeout(() => setSwipedId(firstId), 600);
    const t2 = setTimeout(() => setSwipedId(null), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [trips]);

  if (trips.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="text-gray-500 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">Nog geen ritten toegevoegd</p>
        <p className="text-xs text-gray-500 mt-1">Vul een rit in via het formulier hierboven</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Mobiel: kaartjes met swipe-to-delete */}
      <div className="sm:hidden divide-y divide-gray-100">
        {trips.map((trip) => {
          const swiped = swipedId === trip.id;
          return (
            <div key={trip.id} className="relative overflow-hidden">
              {/* Rode delete achtergrond: alleen zichtbaar bij vegen, anders piept er een rode rand onder de kaart uit */}
              <div className={`absolute inset-y-0 right-0 w-20 bg-red-600 flex items-center justify-center ${swiped ? "" : "invisible"}`}>
                <button
                  onClick={() => onDelete(trip.id)}
                  className="flex flex-col items-center gap-1 text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-xs font-medium">Wis</span>
                </button>
              </div>

              {/* Kaart inhoud — verschuift bij swipe */}
              <div
                className={`relative px-4 py-3 transition-transform duration-200 cursor-pointer ${trip.declaredAt ? "bg-gray-50" : "bg-white"}`}
                style={{ transform: swiped ? "translateX(-80px)" : "translateX(0)" }}
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const delta = touchStartX.current - e.changedTouches[0].clientX;
                  if (delta > 50) setSwipedId(trip.id);
                  else if (delta < -20) setSwipedId(null);
                }}
                onClick={() => { if (swiped) setSwipedId(null); else onEdit(trip); }}
              >
                {/* Rij 1: doel + km */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{trip.purpose}</p>
                  <span className="text-sm font-mono font-bold text-gray-800 whitespace-nowrap flex-shrink-0">
                    {trip.distanceKm.toFixed(1).replace(".", ",")}
                    <span className="text-xs font-normal text-gray-500 ml-0.5">km</span>
                  </span>
                </div>
                {/* Rij 2: datum · naam · klant · factureerbaar */}
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{formatDate(trip.date)}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{trip.name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500 truncate">{trip.client}</span>
                  {trip.billable && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">Factureerbaar</span>
                  )}
                  {trip.declaredAt && <DeclaredBadge date={trip.declaredAt} />}
                </div>
                {/* Rij 3: route */}
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {trip.locationA.shortName}
                  <span className="mx-1">→</span>
                  {trip.locationB.shortName}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabel */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Datum</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Naam</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Doel</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Klant</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Route</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">KM</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Factureerbaar</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trips.map((trip) => (
              <tr key={trip.id} className={`hover:bg-gray-50 transition-colors ${trip.declaredAt ? "text-gray-500" : ""}`}>
                <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                  {formatDate(trip.date)}
                  {trip.declaredAt && <div className="mt-0.5"><DeclaredBadge date={trip.declaredAt} /></div>}
                </td>
                <td className="px-3 py-3 text-gray-700 whitespace-nowrap font-medium">{trip.name}</td>
                <td className="px-3 py-3 text-gray-700 max-w-[140px]">
                  <span className="block truncate" title={trip.purpose}>{trip.purpose}</span>
                </td>
                <td className="px-3 py-3 text-gray-700 max-w-[120px]">
                  <span className="block truncate" title={trip.client}>{trip.client}</span>
                </td>
                <td className="px-3 py-3 text-gray-700 max-w-[220px]">
                  <span
                    className="block truncate text-xs"
                    title={`${trip.locationA.displayName} → ${trip.locationB.displayName}`}
                  >
                    {trip.locationA.shortName}
                    <span className="mx-1 text-gray-500">→</span>
                    {trip.locationB.shortName}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap font-mono">
                  {trip.distanceKm.toFixed(1).replace(".", ",")} km
                </td>
                <td className="px-3 py-3 text-center">
                  {trip.billable ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Ja
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Nee
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(trip)}
                    className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded"
                    title="Rit bewerken"
                    aria-label="Rit bewerken"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(trip.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded"
                    title="Rit verwijderen"
                    aria-label="Rit verwijderen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
