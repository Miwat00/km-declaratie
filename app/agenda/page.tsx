"use client";

import { useState, useEffect, useRef } from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseIcs, filterEventsByRange } from "@/lib/ics";
import { resolveEvents, buildTrips, generatedTripToTrip, geocodeEventLocation } from "@/lib/tripGenerator";
import type { GeneratedTrip, ResolvedEvent, UnmatchedEvent } from "@/lib/tripGenerator";
import {
  loadTrips, saveTrips, loadRate, loadHomeAddress,
  loadClientDirectory, saveClientDirectory, loadSettings, updateSettings, DEFAULT_RATE,
} from "@/lib/storage";
import { getDrivingDistanceKm } from "@/lib/osrm";
import { toLocalISODate, formatDateNL as formatDate } from "@/lib/date";
import type { CalendarEvent, ClientEntry, Location } from "@/lib/types";
import ClientDirectoryEditor from "@/components/ClientDirectoryEditor";
import LocationInput from "@/components/LocationInput";

type Step = 1 | 2 | 3 | 4 | 5;

function getWeekRange(offset = 0): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayDiff + offset * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    from: toLocalISODate(monday),
    to: toLocalISODate(friday),
  };
}

function groupByDate(trips: GeneratedTrip[]): Map<string, GeneratedTrip[]> {
  const map = new Map<string, GeneratedTrip[]>();
  for (const t of trips) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return map;
}

export default function AgendaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState(getWeekRange());
  const [directory, setDirectory] = useState<ClientEntry[]>([]);
  const [showDirectory, setShowDirectory] = useState(false);
  const [homeAddress, setHomeAddress] = useState<Location | null>(null);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [resolved, setResolved] = useState<ResolvedEvent[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedEvent[]>([]);
  const [unmatchedLocations, setUnmatchedLocations] = useState<Record<string, Location | null>>({});
  const [unmatchedClients, setUnmatchedClients] = useState<Record<string, string>>({});
  const [unmatchedBillable, setUnmatchedBillable] = useState<Record<string, boolean>>({});
  const [unmatchedRemember, setUnmatchedRemember] = useState<Record<string, boolean>>({});
  const [generatedTrips, setGeneratedTrips] = useState<GeneratedTrip[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveName = name.trim();

  useEffect(() => {
    setName(loadSettings().userName);
    setDirectory(loadClientDirectory());
    setHomeAddress(loadHomeAddress());
    setRate(loadRate());
  }, []);

  function handleDirectoryChange(entries: ClientEntry[]) {
    setDirectory(entries);
    saveClientDirectory(entries);
  }

  // Step 1: file upload
  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const events = parseIcs(text);
      if (events.length === 0) {
        setParseError("Geen afspraken gevonden. Is dit een geldig .ics bestand?");
        return;
      }
      setParseError(null);
      setAllEvents(events);
      setStep(2);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  // Step 2: select range → go to step 3
  const eventsInRange = filterEventsByRange(allEvents, range.from, range.to);

  // Step 2 → 3: events koppelen aan locaties (routes worden pas in stap 3 → 4 berekend)
  async function handleGenerateTrips() {
    if (!homeAddress) {
      setGenerateError("Stel eerst je thuisadres in via Instellingen op de hoofdpagina.");
      return;
    }
    setGenerateError(null);
    const result = resolveEvents(eventsInRange, directory, loadSettings());
    setResolved(result.resolved);

    const locs: Record<string, Location | null> = {};
    const clients: Record<string, string> = {};
    const bill: Record<string, boolean> = {};
    const rem: Record<string, boolean> = {};
    for (const u of result.unmatched) {
      locs[u.event.id] = null;
      clients[u.event.id] = u.event.title;
      bill[u.event.id] = true;
      rem[u.event.id] = false;
    }
    setUnmatched(result.unmatched);
    setUnmatchedLocations(locs);
    setUnmatchedClients(clients);
    setUnmatchedBillable(bill);
    setUnmatchedRemember(rem);
    setStep(3);

    // Locatieveld uit de agenda alvast geocoden (de Nominatim-client throttlet naar 1 req/s)
    for (const u of result.unmatched) {
      if (!u.event.location) continue;
      const loc = await geocodeEventLocation(u.event.location);
      if (loc) setUnmatchedLocations((prev) => (prev[u.event.id] ? prev : { ...prev, [u.event.id]: loc }));
    }
  }

  // Step 3 → 4: alle gekoppelde events samen tot één ritketen per dag bouwen
  async function handleResolveAndPreview() {
    if (!homeAddress) return;
    const newEntries: ClientEntry[] = [];
    const extra: ResolvedEvent[] = [];
    for (const u of unmatched) {
      const loc = unmatchedLocations[u.event.id];
      if (!loc) continue;
      const client = unmatchedClients[u.event.id] || u.event.title;
      const billable = unmatchedBillable[u.event.id] ?? true;
      extra.push({ event: u.event, location: loc, client, billable });
      if (unmatchedRemember[u.event.id]) {
        newEntries.push({ keyword: u.event.title, location: loc, client, billable });
      }
    }
    if (newEntries.length > 0) {
      const updated = [...directory, ...newEntries];
      setDirectory(updated);
      saveClientDirectory(updated);
    }

    setGenerating(true);
    setGenerateError(null);
    try {
      setGeneratedTrips(await buildTrips([...resolved, ...extra], homeAddress));
      setEditingTrip(null);
      setStep(4);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setGenerating(false);
    }
  }

  // Step 4: preview & edit
  function toggleTrip(id: string) {
    setGeneratedTrips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  }

  function removeTrip(id: string) {
    setGeneratedTrips((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTrip(id: string, patch: Partial<GeneratedTrip>) {
    setGeneratedTrips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }

  async function handleLocationChange(id: string, field: "locationA" | "locationB", loc: Location) {
    const trip = generatedTrips.find((t) => t.id === id);
    if (!trip) return;
    const from = field === "locationA" ? loc : trip.locationA;
    const to = field === "locationB" ? loc : trip.locationB;
    updateTrip(id, { [field]: loc, distanceKm: 0 });
    try {
      const km = await getDrivingDistanceKm(from, to);
      updateTrip(id, { distanceKm: km });
    } catch {
      // keep 0
    }
  }

  // Step 5: confirm
  function handleConfirm() {
    const toAdd = generatedTrips
      .filter((t) => t.enabled)
      .map((t) => generatedTripToTrip(t, rate, effectiveName));

    if (effectiveName !== loadSettings().userName) updateSettings({ userName: effectiveName });
    const existing = loadTrips();
    saveTrips([...existing, ...toAdd]);
    router.push(`/?added=${toAdd.length}`);
  }

  const enabledCount = generatedTrips.filter((t) => t.enabled).length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-4 sm:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
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

      {/* Progress steps */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {([1, 2, 3, 4] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              step > s ? "bg-green-500 text-white" : step === s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {step > s ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            <span className={`text-xs hidden sm:inline ${step === s ? "text-gray-900 font-medium" : "text-gray-400"}`}>
              {["Uploaden", "Periode", "Koppelen", "Controleren"][i]}
            </span>
            {i < 3 && <div className="w-4 h-px bg-gray-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Je naam</h2>
            <input
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
              <p className="text-xs text-gray-400 mt-1">of klik om te bladeren</p>
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
      )}

      {/* STEP 2: Select period */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Selecteer periode</h2>
            <p className="text-sm text-gray-500 mb-4">
              {allEvents.length} events gevonden in het ICS bestand.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Van</label>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Tot en met</label>
                <input
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
                    <span className="text-gray-400 text-xs ml-2">{formatDate(ev.date)}{ev.startTime ? ` · ${ev.startTime}` : ""}</span>
                    {ev.location && <div className="text-xs text-gray-400 truncate mt-0.5">{ev.location}</div>}
                  </div>
                ))}
              </div>
            )}

            {eventsInRange.length === 0 && (
              <p className="mt-4 text-sm text-gray-400 text-center py-4">Geen events in deze periode.</p>
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
      )}

      {/* STEP 3: Unmatched events */}
      {step === 3 && (
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
                          <p className="text-xs text-gray-400">{formatDate(u.event.date)}{u.event.startTime ? ` · ${u.event.startTime}` : ""}</p>
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
      )}

      {/* STEP 4: Preview & correctie */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Controleer en corrigeer</h2>
              <span className="text-sm text-gray-500">{enabledCount} van {generatedTrips.length} ritten geselecteerd</span>
            </div>

            {generatedTrips.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Geen ritten gegenereerd.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(groupByDate(generatedTrips)).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayTrips]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{formatDate(date)}</p>
                    <div className="space-y-2">
                      {dayTrips.map((trip) => (
                        <TripPreviewRow
                          key={trip.id}
                          trip={trip}
                          homeAddress={homeAddress}
                          editing={editingTrip === trip.id}
                          onToggle={() => toggleTrip(trip.id)}
                          onRemove={() => removeTrip(trip.id)}
                          onEdit={() => setEditingTrip(editingTrip === trip.id ? null : trip.id)}
                          onPatch={(patch) => updateTrip(trip.id, patch)}
                          onLocationChange={(field, loc) => handleLocationChange(trip.id, field, loc)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(3)} className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Terug
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={enabledCount === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Voeg {enabledCount} {enabledCount === 1 ? "rit" : "ritten"} toe
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// Sub-component for unmatched event location row
function UnmatchedEventRow({
  location, client, billable, remember, homeAddress,
  onLocationChange, onClientChange, onBillableChange, onRememberChange,
}: {
  event: CalendarEvent;
  location: Location | null;
  client: string;
  billable: boolean;
  remember: boolean;
  homeAddress: Location | null;
  onLocationChange: (loc: Location | null) => void;
  onClientChange: (c: string) => void;
  onBillableChange: (b: boolean) => void;
  onRememberChange: (r: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <LocationInput
        label="Locatie"
        value={location}
        onChange={onLocationChange}
        homeAddress={homeAddress}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
          placeholder="Klantnaam"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => onBillableChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Factureerbaar
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => onRememberChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Onthouden
          </label>
        </div>
      </div>
    </div>
  );
}

// Sub-component for preview row
function TripPreviewRow({
  trip, homeAddress, editing, onToggle, onRemove, onEdit, onPatch, onLocationChange,
}: {
  trip: GeneratedTrip;
  homeAddress: Location | null;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onPatch: (patch: Partial<GeneratedTrip>) => void;
  onLocationChange: (field: "locationA" | "locationB", loc: Location) => void;
}) {
  return (
    <div className={`border rounded-lg transition-colors ${trip.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={trip.enabled}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${trip.enabled ? "text-gray-900" : "text-gray-400 line-through"}`}>
              {trip.locationA.shortName}
            </span>
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className={`text-sm font-medium truncate ${trip.enabled ? "text-gray-900" : "text-gray-400 line-through"}`}>
              {trip.locationB.shortName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">{trip.purpose}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-500">{trip.client}</span>
            {trip.billable && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Factureerbaar</span>
            )}
          </div>
        </div>
        <span className="text-sm font-mono font-bold text-gray-700 flex-shrink-0">
          {trip.distanceKm > 0 ? `${trip.distanceKm.toFixed(1).replace(".", ",")} km` : "—"}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 p-0.5"
          title="Bewerken"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-0.5"
          title="Verwijderen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {editing && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50 rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <LocationInput
              label="Van"
              value={trip.locationA}
              onChange={(loc) => loc && onLocationChange("locationA", loc)}
              homeAddress={homeAddress}
            />
            <LocationInput
              label="Naar"
              value={trip.locationB}
              onChange={(loc) => loc && onLocationChange("locationB", loc)}
              homeAddress={homeAddress}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Doel</label>
              <input
                type="text"
                value={trip.purpose}
                onChange={(e) => onPatch({ purpose: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Klant</label>
              <input
                type="text"
                value={trip.client}
                onChange={(e) => onPatch({ client: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trip.billable}
              onChange={(e) => onPatch({ billable: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Factureerbaar
          </label>
        </div>
      )}
    </div>
  );
}
