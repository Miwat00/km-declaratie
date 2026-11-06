"use client";

import Link from "next/link";
import ClientDirectoryEditor from "@/components/ClientDirectoryEditor";
import { useAgendaImport } from "@/components/agenda/useAgendaImport";
import StepIndicator from "@/components/agenda/StepIndicator";
import UploadStep from "@/components/agenda/UploadStep";
import PeriodStep from "@/components/agenda/PeriodStep";
import MatchStep from "@/components/agenda/MatchStep";
import PreviewStep from "@/components/agenda/PreviewStep";

export default function AgendaPage() {
  const imp = useAgendaImport();
  const { step, showDirectory, setShowDirectory, directory, handleDirectoryChange } = imp;

  return (
    <main className="max-w-3xl mx-auto px-4 py-4 sm:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/" aria-label="Terug naar je ritten" className="text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agenda importeren</h1>
            <p className="text-xs text-gray-500">Genereer ritten vanuit je Outlook agenda</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDirectory(!showDirectory)}
            className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            title="Klant-locatie koppelingen beheren"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Klanten
          </button>
        </div>
      </header>

      {/* Client Directory panel */}
      {showDirectory && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Klant-locatie koppelingen</h2>
          <p className="text-xs text-gray-500 mb-3">
            Koppel zoekwoorden uit je agenda-titels aan adressen. Bijv. &quot;Klant X&quot; → Adres in Rotterdam.
          </p>
          <ClientDirectoryEditor entries={directory} onChange={handleDirectoryChange} />
        </div>
      )}

      <StepIndicator step={step} />

      {step === 1 && <UploadStep imp={imp} />}
      {step === 2 && <PeriodStep imp={imp} />}
      {step === 3 && <MatchStep imp={imp} />}
      {step === 4 && <PreviewStep imp={imp} />}
    </main>
  );
}
