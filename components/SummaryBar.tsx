"use client";

import { useState, useEffect } from "react";
import { exportToCsv, emailDeclaratie } from "@/lib/export";
import type { Trip } from "@/lib/types";

type Props = {
  trips: Trip[];
  rate: number;
  onRateChange: (rate: number) => void;
  onClear: () => void;
};

export default function SummaryBar({ trips, rate, onRateChange, onClear }: Props) {
  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);
  const totalAmount = trips.reduce((s, t) => s + t.amount, 0);
  const [rateInput, setRateInput] = useState(String(rate));
  const [showAttachHint, setShowAttachHint] = useState(false);

  useEffect(() => {
    setRateInput(String(rate));
  }, [rate]);

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setRateInput(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) onRateChange(val);
  }

  function handleRateBlur() {
    const val = parseFloat(rateInput);
    if (isNaN(val) || val <= 0) setRateInput(String(rate));
  }

  function handleVerstuur() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const canShare = isMobile && !!navigator.share && !!navigator.canShare;
    if (canShare) {
      emailDeclaratie(trips);
    } else {
      setShowAttachHint(true);
    }
  }

  const buttons = (
    <>
      <button
        onClick={onClear}
        className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 border border-gray-200 sm:border-0"
        title="Verwijder alle ritten"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span className="sm:hidden">Leeg maken</span>
        <span className="hidden sm:inline">Leeg maken</span>
      </button>
      <button
        onClick={() => exportToCsv(trips)}
        className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        title="Download als CSV"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>CSV</span>
      </button>
      <button
        onClick={handleVerstuur}
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        title="Verstuur declaratie per e-mail"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="sm:hidden">Verstuur</span>
        <span className="hidden sm:inline">Verstuur declaratie</span>
      </button>
    </>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 sm:px-5">

      {/* Mobiel layout */}
      <div className="sm:hidden space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">KM</p>
            <p className="text-xl font-bold text-gray-900">
              {totalKm.toFixed(1).replace(".", ",")}
              <span className="text-xs font-normal text-gray-400 ml-0.5">km</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Tarief</p>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-xs text-gray-500">€</span>
              <input
                type="number"
                value={rateInput}
                onChange={handleRateChange}
                onBlur={handleRateBlur}
                step="0.01"
                min="0.01"
                max="10"
                className="w-14 rounded-lg border border-gray-300 px-1.5 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Totaal</p>
            <p className="text-xl font-bold text-blue-600">
              €{totalAmount.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
        {trips.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* Verstuur: brede primaire knop */}
            <button
              onClick={handleVerstuur}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Verstuur declaratie
            </button>
            {/* CSV + Leeg maken: secundaire rij */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => exportToCsv(trips)}
                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={onClear}
                className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 border border-gray-200"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Leeg maken
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:flex sm:items-center gap-4">
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Totaal km</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalKm.toFixed(1).replace(".", ",")}
            <span className="text-sm font-normal text-gray-500 ml-1">km</span>
          </p>
        </div>
        <span className="h-10 w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Tarief nieuwe ritten</p>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-600">€</span>
            <input
              type="number"
              value={rateInput}
              onChange={handleRateChange}
              onBlur={handleRateBlur}
              step="0.01"
              min="0.01"
              max="10"
              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-600">/km</span>
          </div>
        </div>
        <span className="h-10 w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Totaal</p>
          <p className="text-2xl font-bold text-blue-600">
            €{totalAmount.toFixed(2).replace(".", ",")}
          </p>
        </div>
        {trips.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {buttons}
          </div>
        )}
      </div>

      {trips.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {trips.length} {trips.length === 1 ? "rit" : "ritten"} · een gewijzigd tarief geldt alleen voor nieuwe ritten
        </p>
      )}

      {showAttachHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm w-full mx-4 flex flex-col items-center gap-5 text-center relative">
            <button
              onClick={() => setShowAttachHint(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Sluiten"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-blue-50 text-blue-600 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900 mb-1">Declaratie versturen</p>
              <p className="text-sm text-gray-500">
                Het <span className="font-medium text-gray-700">.csv bestand</span> wordt gedownload.
                Voeg dit toe als bijlage in je e-mailprogramma en vul de ontvanger in voor het versturen.
              </p>
            </div>
            <button
              onClick={() => {
                setShowAttachHint(false);
                emailDeclaratie(trips);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Mail openen &amp; CSV downloaden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
