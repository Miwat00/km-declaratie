"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseIcs, filterEventsByRange } from "@/lib/ics";
import { resolveEvents, buildTrips, generatedTripToTrip, geocodeEventLocation } from "@/lib/tripGenerator";
import type { GeneratedTrip, ResolvedEvent, UnmatchedEvent } from "@/lib/tripGenerator";
import {
  loadTrips, saveTrips, loadRate, loadHomeAddress,
  loadClientDirectory, saveClientDirectory, loadSettings, updateSettings, DEFAULT_RATE,
  loadCalendarUrl, saveCalendarUrl,
} from "@/lib/storage";
import { getDrivingDistanceKm } from "@/lib/osrm";
import type { CalendarEvent, ClientEntry, Location } from "@/lib/types";
import { getWeekRange } from "./helpers";

export type Step = 1 | 2 | 3 | 4;

/** Alle state en acties van de agenda-import-wizard. */
export function useAgendaImport() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [rememberUrl, setRememberUrl] = useState(true);
  const [hasSavedUrl, setHasSavedUrl] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
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
    const savedUrl = loadCalendarUrl();
    setCalendarUrl(savedUrl);
    setHasSavedUrl(!!savedUrl);
    setDirectory(loadClientDirectory());
    setHomeAddress(loadHomeAddress());
    setRate(loadRate());
  }, []);

  function handleDirectoryChange(entries: ClientEntry[]) {
    setDirectory(entries);
    saveClientDirectory(entries);
  }

  // Step 1: file upload
  function processIcs(text: string) {
    const events = parseIcs(text);
    if (events.length === 0) {
      setParseError("Geen afspraken gevonden in deze agenda.");
      return false;
    }
    setParseError(null);
    setAllEvents(events);
    setStep(2);
    return true;
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => processIcs(e.target?.result as string);
    reader.readAsText(file, "utf-8");
  }

  // Agenda ophalen via de server: Outlook en Google staan ophalen vanuit de browser niet toe (CORS)
  async function handleUrlImport() {
    setParseError(null);
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: calendarUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setParseError(body?.error ?? "De agenda kon niet worden opgehaald.");
        return;
      }
      if (processIcs(await res.text())) {
        saveCalendarUrl(rememberUrl ? calendarUrl.trim() : null);
        setHasSavedUrl(rememberUrl);
      }
    } catch {
      setParseError("Geen verbinding. Controleer je internet en probeer het opnieuw.");
    } finally {
      setFetchingUrl(false);
    }
  }

  function forgetCalendarUrl() {
    saveCalendarUrl(null);
    setHasSavedUrl(false);
    setCalendarUrl("");
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
  const missingKmCount = generatedTrips.filter((t) => t.enabled && t.distanceKm <= 0).length;

  return {
    calendarUrl,
    setCalendarUrl,
    rememberUrl,
    setRememberUrl,
    hasSavedUrl,
    fetchingUrl,
    handleUrlImport,
    forgetCalendarUrl,
    step,
    setStep,
    name,
    setName,
    parseError,
    allEvents,
    range,
    setRange,
    directory,
    showDirectory,
    setShowDirectory,
    homeAddress,
    unmatched,
    unmatchedLocations,
    setUnmatchedLocations,
    unmatchedClients,
    setUnmatchedClients,
    unmatchedBillable,
    setUnmatchedBillable,
    unmatchedRemember,
    setUnmatchedRemember,
    generatedTrips,
    generating,
    generateError,
    editingTrip,
    setEditingTrip,
    fileInputRef,
    effectiveName,
    eventsInRange,
    enabledCount,
    missingKmCount,
    handleDirectoryChange,
    handleFileUpload,
    handleDrop,
    handleGenerateTrips,
    handleResolveAndPreview,
    toggleTrip,
    removeTrip,
    updateTrip,
    handleLocationChange,
    handleConfirm,
  };
}

export type AgendaImport = ReturnType<typeof useAgendaImport>;
