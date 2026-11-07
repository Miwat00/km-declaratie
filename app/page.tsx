"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import InstallPrompt from "@/components/InstallPrompt";
import SettingsPanel from "@/components/SettingsPanel";
import PrintView from "@/components/PrintView";
import Sheet from "@/components/Sheet";
import TripForm from "@/components/TripForm";
import UndoToast, { type Notice } from "@/components/UndoToast";
import MonthCard from "@/components/home/MonthCard";
import TripList from "@/components/home/TripList";
import AddTripPanel from "@/components/home/AddTripPanel";
import { AgendaCard, Welcome } from "@/components/home/Intro";
import {
  loadTrips, saveTrips, loadRate, loadSettings, loadHomeAddress, loadCalendarUrl, updateSettings, DEFAULT_RATE, DEFAULT_SETTINGS,
} from "@/lib/storage";
import { todayLocal } from "@/lib/date";
import { formatKm } from "@/lib/format";
import { emailDeclaratie, exportToCsv } from "@/lib/export";
import { markDeclared, sortTrips } from "@/lib/trips";
import { addMonths, frequentRoutes, monthOfDate, monthSummary, monthTitle, pickStartMonth, unmarkDeclared } from "@/lib/month";
import type { Location, Settings, Trip } from "@/lib/types";

type SheetState = { kind: "add" } | { kind: "edit"; trip: Trip } | null;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [home, setHome] = useState<Location | null>(null);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [month, setMonth] = useState(() => monthOfDate(todayLocal()));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reloadSettings = useCallback(() => {
    setRate(loadRate());
    setSettings(loadSettings());
    setHome(loadHomeAddress());
    setHasCalendar(!!loadCalendarUrl());
  }, []);

  useEffect(() => {
    // localStorage bestaat pas in de browser; laden na mount voorkomt hydration-mismatch
    const stored = loadTrips();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrips(stored);
    setMonth(pickStartMonth(todayLocal(), stored));
    reloadSettings();
    setMounted(true);
    const added = new URLSearchParams(window.location.search).get("added");
    if (added) {
      setNotice({ id: Date.now(), message: `${added} ${Number(added) === 1 ? "rit" : "ritten"} toegevoegd vanuit je agenda` });
      window.history.replaceState({}, "", "/");
    }
  }, [reloadSettings]);

  const monthTrips = useMemo(() => sortTrips(trips.filter((t) => monthOfDate(t.date) === month)), [trips, month]);
  const summary = useMemo(() => monthSummary(monthTrips), [monthTrips]);
  const routes = useMemo(() => frequentRoutes(trips), [trips]);

  function persist(updated: Trip[]) {
    setTrips(updated);
    saveTrips(updated);
  }

  function notify(message: string, undo?: () => void) {
    setNotice({ id: Date.now(), message, undo: undo && (() => { undo(); setNotice(null); }) });
  }

  function handleAdd(newTrips: Trip[]) {
    const before = trips;
    persist([...trips, ...newTrips]);
    setSheet(null);
    setMonth(monthOfDate(newTrips[0].date));
    const km = newTrips.reduce((s, t) => s + t.distanceKm, 0);
    notify(`${newTrips.length === 2 ? "Heen en terug" : "Rit"} toegevoegd · ${formatKm(km)} km`, () => persist(before));
  }

  function handleUpdate(trip: Trip) {
    const before = trips;
    persist(trips.map((t) => (t.id === trip.id ? trip : t)));
    setSheet(null);
    notify("Rit bijgewerkt", () => persist(before));
  }

  function handleDelete(journeyTrips: Trip[], one?: Trip) {
    const before = trips;
    const ids = new Set((one ? [one] : journeyTrips).map((t) => t.id));
    persist(trips.filter((t) => !ids.has(t.id)));
    notify(ids.size === 1 ? "Rit verwijderd" : `${ids.size} ritten verwijderd`, () => persist(before));
  }

  function handleDeclare(how: "mail" | "pdf" | "csv", to: string) {
    if (to && to !== settings.adminEmail) {
      updateSettings({ adminEmail: to });
      setSettings(loadSettings());
    }
    if (how === "mail") emailDeclaratie(monthTrips, to);
    if (how === "csv") exportToCsv(monthTrips);
    if (how === "pdf") window.print();

    // Na versturen of downloaden staat de maand op gedeclareerd; ongedaan maken kan
    const openIds = new Set(monthTrips.filter((t) => !t.declaredAt).map((t) => t.id));
    if (openIds.size === 0) return;
    const marked = markDeclared(trips, openIds, todayLocal());
    persist(marked);
    notify(`${monthTitle(month).split(" ")[0]} staat op gedeclareerd`, () => persist(unmarkDeclared(marked, openIds)));
  }

  if (!mounted) return null;

  return (
    <>
      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-8 space-y-4 print:hidden">
        <header className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg" aria-hidden="true">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Kilometers</h1>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto flex items-center justify-center text-gray-600 hover:text-blue-700 p-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300"
            title="Instellingen"
            aria-label="Instellingen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </header>

        {trips.length === 0 ? (
          <Welcome onAdd={() => setSheet({ kind: "add" })} />
        ) : (
          <>
            <MonthCard
              month={month}
              summary={summary}
              onPrev={() => setMonth(addMonths(month, -1))}
              onNext={() => setMonth(addMonths(month, 1))}
              adminEmail={settings.adminEmail}
              onDeclare={handleDeclare}
            />
            <AgendaCard hasCalendar={hasCalendar} />
            <TripList
              trips={monthTrips}
              home={home}
              office={settings.office}
              showNames={summary.names.length > 1}
              onAdd={() => setSheet({ kind: "add" })}
              onEdit={(trip) => setSheet({ kind: "edit", trip })}
              onDelete={handleDelete}
            />
          </>
        )}

        <footer className="pt-2 text-center text-xs text-gray-600">
          Afstanden via OpenStreetMap · Je gegevens blijven in deze browser
        </footer>
      </main>

      {sheet?.kind === "add" && (
        <Sheet title="Rit toevoegen" onClose={() => setSheet(null)}>
          <AddTripPanel rate={rate} userName={settings.userName} routes={routes} home={home} office={settings.office} onAdd={handleAdd} />
        </Sheet>
      )}
      {sheet?.kind === "edit" && (
        <Sheet title="Rit bewerken" onClose={() => setSheet(null)}>
          <TripForm key={sheet.trip.id} rate={rate} onAdd={handleAdd} editing={sheet.trip} onUpdate={handleUpdate} />
        </Sheet>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} onSaved={reloadSettings} />}
      <InstallPrompt />
      <UndoToast notice={notice} onDone={(id) => setNotice((n) => (n?.id === id ? null : n))} />
      <PrintView trips={monthTrips} periodLabel={monthTitle(month)} companyName={settings.companyName} />
    </>
  );
}
