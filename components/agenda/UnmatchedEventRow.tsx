"use client";

import LocationInput from "@/components/LocationInput";
import type { CalendarEvent, Location } from "@/lib/types";

/** Locatie, klant en opties voor een afspraak die niet automatisch gekoppeld kon worden. */
export default function UnmatchedEventRow({
  location, client, billable, remember, homeAddress,
  onLocationChange, onClientChange, onBillableChange, onRememberChange,
}: {
  event: CalendarEvent;
  location: Location | null;
  client: string;
  billable: boolean;
  remember: boolean;
  homeAddress: Location | null;
  onLocationChange: (loc: Location | null) => void;
  onClientChange: (c: string) => void;
  onBillableChange: (b: boolean) => void;
  onRememberChange: (r: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <LocationInput
        label="Locatie"
        value={location}
        onChange={onLocationChange}
        homeAddress={homeAddress}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
          placeholder="Klantnaam"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => onBillableChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Factureerbaar
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => onRememberChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Onthouden
          </label>
        </div>
      </div>
    </div>
  );
}
