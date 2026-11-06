"use client";

import type { AgendaImport } from "./useAgendaImport";

export default function UploadStep({ imp }: { imp: AgendaImport }) {
  const { name, setName, parseError, fileInputRef, handleFileUpload, handleDrop } = imp;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
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

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">ICS bestand uploaden</h2>
        <p className="text-sm text-gray-500 mb-3">
          Exporteer je agenda uit Outlook: <span className="font-medium text-gray-700">Bestand → Opslaan als → .ics</span>
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
        {parseError && <p className="text-sm text-red-600 mt-2">{parseError}</p>}
      </div>
    </div>
  );
}
