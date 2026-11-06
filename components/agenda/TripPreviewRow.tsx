"use client";

import { formatKm } from "@/lib/format";
import LocationInput from "@/components/LocationInput";
import KmField from "./KmField";
import type { GeneratedTrip } from "@/lib/tripGenerator";
import type { Location } from "@/lib/types";

/** Eén gegenereerde rit in de preview, met uitklapbaar bewerkpaneel. */
export default function TripPreviewRow({
  trip, homeAddress, editing, onToggle, onRemove, onEdit, onPatch, onLocationChange,
}: {
  trip: GeneratedTrip;
  homeAddress: Location | null;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onPatch: (patch: Partial<GeneratedTrip>) => void;
  onLocationChange: (field: "locationA" | "locationB", loc: Location) => void;
}) {
  return (
    <div className={`border rounded-lg transition-colors ${trip.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={trip.enabled}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${trip.enabled ? "text-gray-900" : "text-gray-500 line-through"}`}>
              {trip.locationA.shortName}
            </span>
            <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className={`text-sm font-medium truncate ${trip.enabled ? "text-gray-900" : "text-gray-500 line-through"}`}>
              {trip.locationB.shortName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{trip.purpose}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-500">{trip.client}</span>
            {trip.billable && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Factureerbaar</span>
            )}
          </div>
        </div>
        <span className={`text-sm font-mono font-bold flex-shrink-0 ${trip.distanceKm > 0 || !trip.enabled ? "text-gray-700" : "text-orange-600"}`}>
          {trip.distanceKm > 0 ? `${formatKm(trip.distanceKm)} km` : "? km"}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 p-0.5"
          title="Bewerken"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-0.5"
          title="Verwijderen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {editing && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50 rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <LocationInput
              label="Van"
              value={trip.locationA}
              onChange={(loc) => loc && onLocationChange("locationA", loc)}
              homeAddress={homeAddress}
            />
            <LocationInput
              label="Naar"
              value={trip.locationB}
              onChange={(loc) => loc && onLocationChange("locationB", loc)}
              homeAddress={homeAddress}
            />
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <div>
              <label htmlFor={`${trip.id}-purpose`} className="block text-xs font-medium text-gray-600 mb-1">Doel</label>
              <input
                id={`${trip.id}-purpose`}
                type="text"
                value={trip.purpose}
                onChange={(e) => onPatch({ purpose: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`${trip.id}-client`} className="block text-xs font-medium text-gray-600 mb-1">Klant</label>
              <input
                id={`${trip.id}-client`}
                type="text"
                value={trip.client}
                onChange={(e) => onPatch({ client: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`${trip.id}-km`} className="block text-xs font-medium text-gray-600 mb-1">Afstand</label>
              <KmField id={`${trip.id}-km`} value={trip.distanceKm} onChange={(km) => onPatch({ distanceKm: km })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trip.billable}
              onChange={(e) => onPatch({ billable: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Factureerbaar
          </label>
        </div>
      )}
    </div>
  );
}
