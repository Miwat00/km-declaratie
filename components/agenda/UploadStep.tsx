"use client";

import type { AgendaImport } from "./useAgendaImport";

export default function UploadStep({ imp }: { imp: AgendaImport }) {
  const {
    name, setName, parseError, fileInputRef, handleFileUpload, handleDrop,
    calendarUrl, setCalendarUrl, rememberUrl, setRememberUrl, hasSavedUrl, fetchingUrl,
    handleUrlImport, forgetCalendarUrl,
  } = imp;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      <div>
        <label htmlFor="agenda-name" className="block text-base font-semibold text-gray-900 mb-1">Je naam</label>
        <input
          id="agenda-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jouw naam"
          autoComplete="name"
          className="w-full sm:w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Optie 1: agenda-link plakken */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleUrlImport();
        }}
        className="space-y-2"
      >
        <label htmlFor="agenda-url" className="block text-base font-semibold text-gray-900">
          Agenda-link plakken
        </label>
        <p className="text-sm text-gray-500">
          Een gepubliceerde agenda (ICS-link) van Outlook, Google Agenda of iCloud. Met een onthouden link haal je
          volgende keer je afspraken met één klik op.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="agenda-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics"
            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!calendarUrl.trim() || fetchingUrl}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {fetchingUrl ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Ophalen…
              </>
            ) : (
              "Afspraken ophalen"
            )}
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberUrl}
              onChange={(e) => setRememberUrl(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Link onthouden op dit apparaat
          </label>
          {hasSavedUrl && (
            <button type="button" onClick={forgetCalendarUrl} className="text-sm text-blue-600 hover:underline">
              Opgeslagen link vergeten
            </button>
          )}
        </div>

        <details className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <summary className="cursor-pointer font-medium text-gray-700">Waar vind ik mijn agenda-link?</summary>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            <li>
              <span className="font-medium">Outlook (web of nieuwe Outlook):</span> Instellingen → Agenda → Gedeelde
              agenda&apos;s → Een agenda publiceren. Kies je agenda en <em>Kan alle details weergeven</em> (anders zie
              je alleen &quot;Bezet&quot;), klik op Publiceren en kopieer de <em>ICS</em>-link. Bij werkaccounts kan je
              organisatie dit hebben uitgezet.
            </li>
            <li>
              <span className="font-medium">Google Agenda:</span> Instellingen → je agenda → Agenda integreren →{" "}
              <em>Geheim adres in iCal-indeling</em>.
            </li>
            <li>
              <span className="font-medium">iCloud:</span> Agenda-app → deel de agenda als openbare agenda en kopieer
              de link (begint met webcal://).
            </li>
          </ul>
          <p className="mt-2 text-gray-500">
            Let op: met deze link kan iedereen je agenda lezen. Deel hem niet. De app stuurt de link alleen naar de
            eigen server om de agenda op te halen (je browser mag dat niet rechtstreeks), en slaat hem daar niet op.
          </p>
        </details>
      </form>

      <div className="flex items-center gap-3 text-xs text-gray-500" aria-hidden="true">
        <div className="flex-1 h-px bg-gray-200" />
        of
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Optie 2: bestand uploaden */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">ICS-bestand uploaden</h2>
        <p className="text-sm text-gray-500 mb-3">
          Exporteer je agenda uit Outlook: <span className="font-medium text-gray-700">Bestand → Agenda opslaan → .ics</span>
        </p>
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-600">Sleep je .ics bestand hierheen</p>
          <p className="text-xs text-gray-500 mt-1">of klik om te bladeren</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
          />
        </div>
      </div>

      {parseError && (
        <p className="text-sm text-red-600" role="alert">
          {parseError}
        </p>
      )}
    </div>
  );
}
