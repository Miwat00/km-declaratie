"use client";

import Link from "next/link";
import { formatDateNL as formatDate } from "@/lib/date";
import { getWeekRange } from "./helpers";
import type { AgendaImport } from "./useAgendaImport";

export default function PeriodStep({ imp }: { imp: AgendaImport }) {
  const { setStep, allEvents, range, setRange, homeAddress, generateError, effectiveName, eventsInRange, handleGenerateTrips } = imp;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Selecteer periode</h2>
        <p className="text-sm text-gray-500 mb-4">
          {allEvents.length} events gevonden in het ICS bestand.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="agenda-from" className="block text-xs font-medium text-gray-600 mb-1">Van</label>
            <input
              id="agenda-from"
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="agenda-to" className="block text-xs font-medium text-gray-600 mb-1">Tot en met</label>
            <input
              id="agenda-to"
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[-1, 0, 1].map((offset) => {
            const w = getWeekRange(offset);
            const label = offset === -1 ? "Vorige week" : offset === 0 ? "Deze week" : "Volgende week";
            const active = range.from === w.from && range.to === w.to;
            return (
              <button
                key={offset}
                type="button"
                onClick={() => setRange(w)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  active ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {eventsInRange.length > 0 && (
          <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {eventsInRange.map((ev) => (
              <div key={ev.id} className="px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{ev.title}</span>
                <span className="text-gray-500 text-xs ml-2">{formatDate(ev.date)}{ev.startTime ? ` · ${ev.startTime}` : ""}</span>
                {ev.location && <div className="text-xs text-gray-500 truncate mt-0.5">{ev.location}</div>}
              </div>
            ))}
          </div>
        )}

        {eventsInRange.length === 0 && (
          <p className="mt-4 text-sm text-gray-500 text-center py-4">Geen events in deze periode.</p>
        )}
      </div>

      {!homeAddress && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Geen thuisadres ingesteld. Stel dit eerst in via Instellingen (tandwiel) op de <Link href="/" className="underline">hoofdpagina</Link>.
        </div>
      )}

      {generateError && (
        <p className="text-sm text-red-600">{generateError}</p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(1)} className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Terug
        </button>
        <button
          type="button"
          onClick={handleGenerateTrips}
          disabled={eventsInRange.length === 0 || !homeAddress || !effectiveName}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {`Verwerk ${eventsInRange.length} events`}
        </button>
      </div>
    </div>
  );
}
