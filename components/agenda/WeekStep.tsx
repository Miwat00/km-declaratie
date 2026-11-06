"use client";

import { useState } from "react";
import Link from "next/link";
import WeekGrid from "./WeekGrid";
import { AddStopPanel, EventPanel, LegPanel } from "./DetailPanels";
import { formatKm } from "@/lib/format";
import type { AgendaImport } from "./useAgendaImport";

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const short = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default function WeekStep({ imp }: { imp: AgendaImport }) {
  const {
    days, planned, legs, manualStops, summary, todoCount, selection, setSelection, rate,
    prevWeek, nextWeek, thisWeek, handleConfirm, addedMessage, confirmError, homeAddress, setStep,
  } = imp;
  // Mobiel: één dag tegelijk
  const [mobileDay, setMobileDay] = useState(0);
  const dayIndex = Math.min(mobileDay, days.length - 1);

  const selectedEvent = selection?.type === "event" ? planned.find((p) => p.event.id === selection.id) : undefined;
  const selectedLeg = selection?.type === "leg" ? legs.find((l) => l.key === selection.key) : undefined;
  const todoDays = new Set(planned.filter((p) => p.status.kind === "todo").map((p) => p.event.date));
  const canConfirm = summary.count > 0 && summary.missingKm === 0 && summary.loading === 0;

  const grid = (visibleDays: string[]) => (
    <WeekGrid
      days={visibleDays}
      planned={planned.filter((p) => visibleDays.includes(p.event.date))}
      legs={legs.filter((l) => visibleDays.includes(l.date))}
      manualStops={manualStops.filter((m) => visibleDays.includes(m.date))}
      selection={selection}
      onSelect={setSelection}
    />
  );

  return (
    <div className="space-y-4">
      {/* Weeknavigatie */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Vorige week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-base font-semibold text-gray-900 px-2" aria-live="polite">
            {short(days[0])} – {short(days[days.length - 1])}
          </h2>
          <button type="button" onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Volgende week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button type="button" onClick={thisWeek} className="ml-1 text-sm text-blue-700 hover:underline">Deze week</button>
        </div>
        <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-600 hover:text-gray-900">Andere agenda</button>
      </div>

      {!homeAddress && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Geen thuisadres ingesteld, dus de app kan geen ritten plannen. Stel het in via Instellingen (tandwiel) op de{" "}
          <Link href="/" className="underline">hoofdpagina</Link>.
        </div>
      )}

      {todoCount > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {todoCount} {todoCount === 1 ? "afspraak wacht" : "afspraken wachten"} op een locatie. Klik op een oranje blok om hem te
          koppelen, of op &ldquo;Geen rit&rdquo;. Zolang dat niet gebeurt, {todoCount === 1 ? "telt hij" : "tellen ze"} niet mee.
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        {planned.length === 0 && manualStops.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-10">Geen afspraken in deze week. Blader naar een andere week.</p>
        ) : (
          <>
            {/* Desktop: hele week naast elkaar */}
            <div className="hidden sm:block">{grid(days)}</div>
            {/* Mobiel: dag-tabs */}
            <div className="sm:hidden">
              <div className="flex gap-1 mb-2 overflow-x-auto" role="tablist" aria-label="Dagen">
                {days.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={i === dayIndex}
                    onClick={() => setMobileDay(i)}
                    className={`relative flex-1 min-w-[3rem] rounded-lg px-2 py-1.5 text-xs border ${i === dayIndex ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-700"}`}
                  >
                    {WEEKDAYS[i]} {Number(d.slice(8))}
                    {todoDays.has(d) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="locatie nodig" />}
                  </button>
                ))}
              </div>
              {grid([days[dayIndex]])}
            </div>
            <ul className="flex gap-x-4 gap-y-1 flex-wrap text-xs text-gray-600 mt-3" aria-label="Legenda">
              <li className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-emerald-50 border border-emerald-300" />Gekoppeld</li>
              <li className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-amber-50 border border-amber-400" />Locatie nodig</li>
              <li className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm border border-dashed border-gray-400" />Geen rit</li>
              <li className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-blue-50 border border-blue-300" />Rit</li>
              <li className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-gray-100 border border-gray-300" />Al toegevoegd</li>
            </ul>
          </>
        )}
      </div>

      {/* Detailpaneel van wat je aanklikt */}
      {selectedEvent && <EventPanel key={selectedEvent.event.id} imp={imp} item={selectedEvent} />}
      {selectedLeg && <LegPanel key={selectedLeg.key} imp={imp} leg={selectedLeg} />}
      {selection?.type === "add" && <AddStopPanel key={selection.date} imp={imp} date={selection.date} />}

      {addedMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-900 flex items-center gap-3 flex-wrap" role="status">
          <span>{addedMessage}.</span>
          <Link href="/" className="font-medium underline">Naar je ritten</Link>
          <button type="button" onClick={nextWeek} className="font-medium underline">Volgende week</button>
        </div>
      )}

      {/* Weektotaal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-700 space-y-0.5">
          <p>
            <span className="font-semibold text-gray-900">{summary.count} {summary.count === 1 ? "rit" : "ritten"}</span> ·{" "}
            {formatKm(summary.km)} km · € {(summary.km * rate).toFixed(2).replace(".", ",")}
          </p>
          {summary.loading > 0 && <p className="text-gray-600">Routes berekenen…</p>}
          {summary.missingKm > 0 && (
            <p className="text-orange-700">{summary.missingKm} {summary.missingKm === 1 ? "rit heeft" : "ritten hebben"} nog geen afstand. Klik erop om hem in te vullen.</p>
          )}
          {summary.alreadyAdded > 0 && <p className="text-gray-600">{summary.alreadyAdded} {summary.alreadyAdded === 1 ? "rit staat" : "ritten staan"} al in je overzicht.</p>}
          {confirmError && <p className="text-red-700">{confirmError}</p>}
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Voeg {summary.count} {summary.count === 1 ? "rit" : "ritten"} toe
        </button>
      </div>
    </div>
  );
}
