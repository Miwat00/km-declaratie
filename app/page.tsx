"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import TripForm from "@/components/TripForm";
import TripTable from "@/components/TripTable";
import SummaryBar from "@/components/SummaryBar";
import InstallPrompt from "@/components/InstallPrompt";
import Toast from "@/components/Toast";
import SettingsPanel from "@/components/SettingsPanel";
import PrintView from "@/components/PrintView";
import { loadTrips, saveTrips, loadRate, saveRate, loadSettings, loadHomeAddress, DEFAULT_RATE } from "@/lib/storage";
import { formatDateNL, todayLocal } from "@/lib/date";
import {
  filterTrips, formatMonth, markDeclared, monthsOf, sortTrips, tripSuggestions,
  type StatusFilter, type TripFilter,
} from "@/lib/trips";
import type { Trip } from "@/lib/types";

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [filter, setFilter] = useState<TripFilter>({ month: "all", status: "all" });

  useEffect(() => {
    // localStorage bestaat pas in de browser; laden na mount voorkomt hydration-mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrips(loadTrips());
    setRate(loadRate());
    setMounted(true);
    // Eerste keer: vraag om naam en adressen
    if (!loadSettings().userName && !loadHomeAddress()) setSettingsOpen(true);
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    if (added) {
      setToast(`${added} ${Number(added) === 1 ? "rit" : "ritten"} toegevoegd vanuit agenda`);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const months = useMemo(() => monthsOf(trips), [trips]);
  const visibleTrips = useMemo(() => sortTrips(filterTrips(trips, filter)), [trips, filter]);
  const suggestions = useMemo(() => tripSuggestions(trips), [trips]);

  function persist(updated: Trip[]) {
    setTrips(updated);
    saveTrips(updated);
  }

  function handleAdd(trip: Trip) {
    setTrips((prev) => {
      const updated = [...prev, trip];
      saveTrips(updated);
      return updated;
    });
    setToast(`Rit toegevoegd — ${trip.distanceKm.toFixed(1).replace(".", ",")} km`);
  }

  function handleEdit(trip: Trip) {
    setEditing(trip);
    requestAnimationFrame(() => document.getElementById("trip-form")?.scrollIntoView({ behavior: "smooth" }));
  }

  function handleUpdate(trip: Trip) {
    persist(trips.map((t) => (t.id === trip.id ? trip : t)));
    setEditing(null);
    setToast("Rit bijgewerkt");
  }

  function handleDelete(id: string) {
    if (editing?.id === id) setEditing(null);
    persist(trips.filter((t) => t.id !== id));
  }

  function handleClear() {
    const filtered = visibleTrips.length < trips.length;
    const msg = filtered
      ? `Weet je zeker dat je de ${visibleTrips.length} getoonde ritten wilt verwijderen?`
      : "Weet je zeker dat je alle ritten wilt verwijderen?";
    if (!confirm(msg)) return;
    const ids = new Set(visibleTrips.map((t) => t.id));
    persist(trips.filter((t) => !ids.has(t.id)));
    setEditing(null);
  }

  function handleMarkDeclared() {
    const ids = new Set(visibleTrips.filter((t) => !t.declaredAt).map((t) => t.id));
    persist(markDeclared(trips, ids, todayLocal()));
    setToast(`${ids.size} ${ids.size === 1 ? "rit" : "ritten"} gemarkeerd als gedeclareerd`);
  }

  // Nieuw tarief geldt alleen voor nieuwe ritten; bestaande ritten houden hun tarief en bedrag.
  function handleRateChange(newRate: number) {
    setRate(newRate);
    saveRate(newRate);
  }

  if (!mounted) return null;

  const periodLabel =
    filter.month !== "all"
      ? formatMonth(filter.month)
      : visibleTrips.length > 0
      ? `${formatDateNL(visibleTrips[0].date)} t/m ${formatDateNL(visibleTrips[visibleTrips.length - 1].date)}`
      : "—";

  const selectClass =
    "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8 print:hidden">
        <header className="mb-4 sm:mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kilometer Declaraties</h1>
            <Link
              href="/agenda"
              className="ml-auto flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Agenda importeren</span>
              <span className="sm:hidden">Agenda</span>
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center justify-center text-gray-500 hover:text-blue-600 p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              title="Instellingen"
              aria-label="Instellingen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <p className="hidden sm:block text-sm text-gray-500 ml-[52px]">
            Voeg ritten toe en exporteer je declaratie als CSV of PDF
          </p>
        </header>

        <div className="space-y-4">
          <TripForm
            key={editing?.id ?? "new"}
            rate={rate}
            onAdd={handleAdd}
            editing={editing}
            onUpdate={handleUpdate}
            onCancelEdit={() => setEditing(null)}
            suggestions={suggestions}
          />

          {trips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                aria-label="Maand"
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
                className={selectClass}
              >
                <option value="all">Alle maanden</option>
                {months.map((m) => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
              <select
                aria-label="Status"
                value={filter.status}
                onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as StatusFilter }))}
                className={selectClass}
              >
                <option value="all">Alle ritten</option>
                <option value="open">Nog te declareren</option>
                <option value="declared">Gedeclareerd</option>
              </select>
            </div>
          )}

          {trips.length > 0 && visibleTrips.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500 shadow-sm">
              Geen ritten voor dit filter.
            </div>
          ) : (
            <TripTable trips={visibleTrips} onDelete={handleDelete} onEdit={handleEdit} />
          )}

          <SummaryBar
            trips={visibleTrips}
            rate={rate}
            onRateChange={handleRateChange}
            onClear={handleClear}
            onPrint={() => window.print()}
            onMarkDeclared={handleMarkDeclared}
          />
        </div>

        <footer className="mt-8 text-center text-xs text-gray-400">
          Afstanden berekend via OpenStreetMap · Data opgeslagen in je browser
        </footer>

        <InstallPrompt />
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </main>

      <PrintView trips={visibleTrips} periodLabel={periodLabel} companyName={loadSettings().companyName} />
    </>
  );
}
