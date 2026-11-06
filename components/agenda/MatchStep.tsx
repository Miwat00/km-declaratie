"use client";

import { formatDateNL as formatDate } from "@/lib/date";
import UnmatchedEventRow from "./UnmatchedEventRow";
import type { AgendaImport } from "./useAgendaImport";

export default function MatchStep({ imp }: { imp: AgendaImport }) {
  const { setStep, homeAddress, unmatched, unmatchedLocations, setUnmatchedLocations, unmatchedClients, setUnmatchedClients, unmatchedBillable, setUnmatchedBillable, unmatchedRemember, setUnmatchedRemember, generating, generateError, handleResolveAndPreview } = imp;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Onbekende events koppelen</h2>
        {unmatched.length === 0 ? (
          <p className="text-sm text-gray-500">Alle events zijn herkend. Je kunt doorgaan naar de preview.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {unmatched.length} {unmatched.length === 1 ? "event" : "events"} kon{unmatched.length === 1 ? "" : "den"} niet gekoppeld worden aan een locatie.
              Koppel ze hieronder of sla ze over.
            </p>
            <div className="space-y-4">
              {unmatched.map((u) => (
                <div key={u.event.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{u.event.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(u.event.date)}{u.event.startTime ? ` · ${u.event.startTime}` : ""}</p>
                    </div>
                    <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">Geen locatie</span>
                  </div>
                  <UnmatchedEventRow
                    event={u.event}
                    location={unmatchedLocations[u.event.id] ?? null}
                    client={unmatchedClients[u.event.id] ?? u.event.title}
                    billable={unmatchedBillable[u.event.id] ?? true}
                    remember={unmatchedRemember[u.event.id] ?? false}
                    homeAddress={homeAddress}
                    onLocationChange={(loc) => setUnmatchedLocations((p) => ({ ...p, [u.event.id]: loc }))}
                    onClientChange={(c) => setUnmatchedClients((p) => ({ ...p, [u.event.id]: c }))}
                    onBillableChange={(b) => setUnmatchedBillable((p) => ({ ...p, [u.event.id]: b }))}
                    onRememberChange={(r) => setUnmatchedRemember((p) => ({ ...p, [u.event.id]: r }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(2)} className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Terug
        </button>
        <button
          type="button"
          onClick={handleResolveAndPreview}
          disabled={generating}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Routes berekenen...
            </>
          ) : (
            "Naar preview"
          )}
        </button>
      </div>
      {generateError && <p className="text-sm text-red-600">{generateError}</p>}
    </div>
  );
}
