"use client";

import { formatDateNL as formatDate } from "@/lib/date";
import { groupByDate } from "./helpers";
import TripPreviewRow from "./TripPreviewRow";
import type { AgendaImport } from "./useAgendaImport";

export default function PreviewStep({ imp }: { imp: AgendaImport }) {
  const { setStep, homeAddress, generatedTrips, editingTrip, setEditingTrip, enabledCount, missingKmCount, toggleTrip, removeTrip, updateTrip, handleLocationChange, handleConfirm } = imp;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Controleer en corrigeer</h2>
          <span className="text-sm text-gray-500">{enabledCount} van {generatedTrips.length} ritten geselecteerd</span>
        </div>

        {generatedTrips.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Geen ritten gegenereerd.</p>
        ) : (
          <div className="space-y-2">
            {Array.from(groupByDate(generatedTrips)).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayTrips]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{formatDate(date)}</p>
                <div className="space-y-2">
                  {dayTrips.map((trip) => (
                    <TripPreviewRow
                      key={trip.id}
                      trip={trip}
                      homeAddress={homeAddress}
                      editing={editingTrip === trip.id}
                      onToggle={() => toggleTrip(trip.id)}
                      onRemove={() => removeTrip(trip.id)}
                      onEdit={() => setEditingTrip(editingTrip === trip.id ? null : trip.id)}
                      onPatch={(patch) => updateTrip(trip.id, patch)}
                      onLocationChange={(field, loc) => handleLocationChange(trip.id, field, loc)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {missingKmCount > 0 && (
        <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2" role="alert">
          {missingKmCount} {missingKmCount === 1 ? "rit heeft" : "ritten hebben"} nog geen afstand (de route kon niet
          berekend worden). Vul de kilometers in via het potlood, of vink de rit uit.
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(3)} className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Terug
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={enabledCount === 0 || missingKmCount > 0}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Voeg {enabledCount} {enabledCount === 1 ? "rit" : "ritten"} toe
        </button>
      </div>
    </div>
  );
}
