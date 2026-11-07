"use client";

import Link from "next/link";

const icon = (d: string) => (
  <svg className="w-6 h-6 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);
const CAL = "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z";
const PLUS = "M12 4v16m8-8H4";

/** Eerste bezoek: twee duidelijke manieren om te beginnen. */
export function Welcome({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4" aria-labelledby="welcome-title">
      <div>
        <h2 id="welcome-title" className="text-lg font-semibold text-gray-900">Hoe wil je beginnen?</h2>
        <p className="text-sm text-gray-600">Je kunt later altijd van manier wisselen. Alles blijft in deze browser.</p>
      </div>
      <Link href="/agenda" className="flex items-start gap-3 rounded-xl border-2 border-blue-600 p-4 hover:bg-blue-50">
        {icon(CAL)}
        <span>
          <span className="block font-semibold text-gray-900">Haal je ritten uit je agenda <span className="ml-1 text-xs font-medium text-blue-800 bg-blue-50 rounded px-1.5 py-0.5">aanbevolen</span></span>
          <span className="block text-sm text-gray-700">Plak de link van je Outlook- of Google-agenda. De app maakt de ritten en vraagt alleen wat hij niet weet.</span>
        </span>
      </Link>
      <button type="button" onClick={onAdd} className="w-full flex items-start gap-3 rounded-xl border border-gray-300 p-4 text-left hover:bg-gray-50">
        {icon(PLUS)}
        <span>
          <span className="block font-semibold text-gray-900">Voeg een rit toe</span>
          <span className="block text-sm text-gray-700">Van, naar en waarvoor. De afstand rekent de app zelf uit.</span>
        </span>
      </button>
    </section>
  );
}

/** Op de homepagina: de weg naar je agenda, of een tip om die te koppelen. */
export function AgendaCard({ hasCalendar }: { hasCalendar: boolean }) {
  return (
    <Link
      href="/agenda"
      className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100"
    >
      {icon(CAL)}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-blue-950">
          {hasCalendar ? "Rond je week af vanuit je agenda" : "Haal je ritten uit je agenda"}
        </span>
        <span className="block text-xs text-blue-900">
          {hasCalendar ? "Je agenda wordt opgehaald; je beantwoordt alleen wat de app niet weet." : "Scheelt invullen: plak één keer de link van je agenda."}
        </span>
      </span>
      <span className="text-sm font-medium text-blue-800 flex-shrink-0">{hasCalendar ? "Openen" : "Instellen"} →</span>
    </Link>
  );
}
