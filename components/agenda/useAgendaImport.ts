"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { parseIcs } from "@/lib/ics";
import { geocodeEventLocation } from "@/lib/tripGenerator";
import {
  addDays, countedLegs, eventStatus, legToTrip, mondayOf, planDay, routeKey, weekDays, weekSummary,
  type EventDecision, type LegOverride, type ManualStop, type PlannedEvent, type RouteInfo, type RouteLookup,
} from "@/lib/dayPlan";
import {
  loadTrips, saveTrips, loadRate, loadHomeAddress,
  loadClientDirectory, saveClientDirectory, loadSettings, updateSettings, DEFAULT_RATE, DEFAULT_SETTINGS,
  loadCalendarUrl, saveCalendarUrl,
} from "@/lib/storage";
import { getRouteWithGeometry } from "@/lib/osrm";
import { todayLocal } from "@/lib/date";
import type { CalendarEvent, ClientEntry, Location, Settings, Trip } from "@/lib/types";

export type Step = 1 | 2;

export type Selection =
  | { type: "event"; id: string }
  | { type: "leg"; key: string }
  | { type: "add"; date: string }
  | null;

/** Alle state en acties van de agenda-import: agenda ophalen en de week controleren. */
export function useAgendaImport() {
  // ---------- stap 1: agenda ophalen ----------
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [rememberUrl, setRememberUrl] = useState(true);
  const [hasSavedUrl, setHasSavedUrl] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- gegevens uit opslag ----------
  const [directory, setDirectory] = useState<ClientEntry[]>([]);
  const [showDirectory, setShowDirectory] = useState(false);
  const [homeAddress, setHomeAddress] = useState<Location | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [existingTrips, setExistingTrips] = useState<Trip[]>([]);

  // ---------- stap 2: week ----------
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayLocal()));
  const [decisions, setDecisions] = useState<Record<string, EventDecision>>({});
  const [geocoded, setGeocoded] = useState<Record<string, Location | null>>({});
  const [routes, setRoutes] = useState<Record<string, RouteInfo | "error">>({});
  const [manualStops, setManualStops] = useState<ManualStop[]>([]);
  const [legOverrides, setLegOverrides] = useState<Record<string, LegOverride>>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const pendingRoutes = useRef(new Set<string>());
  const pendingGeocodes = useRef(new Set<string>());

  const effectiveName = name.trim();

  useEffect(() => {
    // localStorage bestaat pas in de browser
    setName(loadSettings().userName);
    const savedUrl = loadCalendarUrl();
    setCalendarUrl(savedUrl);
    setHasSavedUrl(!!savedUrl);
    setDirectory(loadClientDirectory());
    setHomeAddress(loadHomeAddress());
    setSettings(loadSettings());
    setRate(loadRate());
    setExistingTrips(loadTrips());
  }, []);

  function handleDirectoryChange(entries: ClientEntry[]) {
    setDirectory(entries);
    saveClientDirectory(entries);
  }

  function processIcs(text: string) {
    const events = parseIcs(text);
    if (events.length === 0) {
      setParseError("Geen afspraken gevonden in deze agenda.");
      return false;
    }
    setParseError(null);
    setAllEvents(events);
    setDecisions({});
    setManualStops([]);
    setLegOverrides({});
    setSelection(null);
    setAddedMessage(null);
    setStep(2);
    return true;
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => processIcs(e.target?.result as string);
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
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

  // ---------- afgeleide weekplanning ----------
  const allDays = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekEvents = useMemo(
    () => allEvents.filter((e) => e.date >= allDays[0] && e.date <= allDays[6]),
    [allEvents, allDays]
  );
  // Weekend alleen tonen als er dan afspraken of tussenstops zijn
  const days = useMemo(() => {
    const busy = new Set([...weekEvents.map((e) => e.date), ...manualStops.map((m) => m.date)]);
    return busy.has(allDays[5]) || busy.has(allDays[6]) ? allDays : allDays.slice(0, 5);
  }, [allDays, weekEvents, manualStops]);

  const planned: PlannedEvent[] = useMemo(
    () =>
      weekEvents.map((event) => ({
        event,
        status: eventStatus(event, decisions[event.id], directory, settings, event.location ? geocoded[event.location] : undefined),
      })),
    [weekEvents, decisions, directory, settings, geocoded]
  );

  const legs = useMemo(() => {
    if (!homeAddress) return [];
    const lookup: RouteLookup = (a, b) => routes[routeKey(a, b)] ?? "loading";
    return days.flatMap((d) => planDay(d, planned, manualStops, homeAddress, lookup, legOverrides, existingTrips));
  }, [days, planned, manualStops, homeAddress, routes, legOverrides, existingTrips]);

  const summary = useMemo(() => weekSummary(legs), [legs]);
  const todoCount = planned.filter((p) => p.status.kind === "todo").length;

  // Routes ophalen voor ritten in deze week (één voor één, de OSRM-demoserver is gratis)
  useEffect(() => {
    const missing = legs.filter((l) => l.routeStatus === "loading" && !pendingRoutes.current.has(routeKey(l.from, l.to)));
    if (missing.length === 0) return;
    (async () => {
      for (const leg of missing) {
        const key = routeKey(leg.from, leg.to);
        if (pendingRoutes.current.has(key)) continue;
        pendingRoutes.current.add(key);
        try {
          const r = await getRouteWithGeometry(leg.from, leg.to);
          setRoutes((prev) => ({ ...prev, [key]: { km: r.distanceKm, min: r.durationMin } }));
        } catch {
          setRoutes((prev) => ({ ...prev, [key]: "error" }));
        }
      }
    })();
  }, [legs]);

  // Locatievelden uit de agenda opzoeken voor afspraken die nog niet gekoppeld zijn
  useEffect(() => {
    const queries = planned
      .filter((p) => p.status.kind === "todo" && p.event.location)
      .map((p) => p.event.location!)
      .filter((q) => !(q in geocoded) && !pendingGeocodes.current.has(q));
    if (queries.length === 0) return;
    (async () => {
      for (const q of new Set(queries)) {
        pendingGeocodes.current.add(q);
        const loc = await geocodeEventLocation(q);
        setGeocoded((prev) => ({ ...prev, [q]: loc }));
      }
    })();
  }, [planned, geocoded]);

  // ---------- acties ----------
  function goToWeek(monday: string) {
    setWeekStart(monday);
    setSelection(null);
    setAddedMessage(null);
  }
  const prevWeek = () => goToWeek(addDays(weekStart, -7));
  const nextWeek = () => goToWeek(addDays(weekStart, 7));
  const thisWeek = () => goToWeek(mondayOf(todayLocal()));

  /** Locatie kiezen of "geen rit" voor een afspraak. Met `remember` geldt het voor alle afspraken met deze titel. */
  function decideEvent(event: CalendarEvent, decision: EventDecision | null, remember = false) {
    setDecisions((prev) => {
      const next = { ...prev };
      if (decision) next[event.id] = decision;
      else delete next[event.id];
      return next;
    });
    if (decision?.kind === "link" && remember) {
      const keyword = event.title.trim();
      const entry: ClientEntry = { keyword, location: decision.location, client: decision.client, billable: decision.billable };
      handleDirectoryChange([...directory.filter((d) => d.keyword.toLowerCase() !== keyword.toLowerCase()), entry]);
    }
  }

  function setLegOverride(key: string, patch: LegOverride) {
    setLegOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function addManualStop(stop: Omit<ManualStop, "id">) {
    setManualStops((prev) => [...prev, { ...stop, id: crypto.randomUUID() }]);
    setSelection(null);
  }

  function removeManualStop(id: string) {
    setManualStops((prev) => prev.filter((m) => m.id !== id));
    setSelection(null);
  }

  function handleConfirm() {
    setConfirmError(null);
    if (!effectiveName) {
      setConfirmError("Vul eerst je naam in (stap 1).");
      return;
    }
    const toAdd = countedLegs(legs)
      .filter((l) => l.km !== null)
      .map((l) => legToTrip(l, rate, effectiveName));
    if (toAdd.length === 0) return;
    if (effectiveName !== loadSettings().userName) updateSettings({ userName: effectiveName });
    const updated = [...loadTrips(), ...toAdd];
    saveTrips(updated);
    setExistingTrips(updated);
    setSelection(null);
    setAddedMessage(`${toAdd.length} ${toAdd.length === 1 ? "rit" : "ritten"} toegevoegd`);
  }

  /** Adressen die je vaker gebruikt, als snelkeuze bij het koppelen. */
  const recentLocations = useMemo(() => {
    const seen = new Set<string>();
    const skip = [homeAddress, settings.office].filter(Boolean).map((l) => l!.shortName);
    const out: Location[] = [];
    for (const l of [...directory.map((d) => d.location), ...[...existingTrips].reverse().map((t) => t.locationB)]) {
      if (seen.has(l.shortName) || skip.includes(l.shortName)) continue;
      seen.add(l.shortName);
      out.push(l);
      if (out.length >= 3) break;
    }
    return out;
  }, [directory, existingTrips, homeAddress, settings.office]);

  return {
    step,
    setStep,
    name,
    setName,
    parseError,
    calendarUrl,
    setCalendarUrl,
    rememberUrl,
    setRememberUrl,
    hasSavedUrl,
    fetchingUrl,
    handleUrlImport,
    forgetCalendarUrl,
    fileInputRef,
    handleFileUpload,
    handleDrop,
    directory,
    showDirectory,
    setShowDirectory,
    handleDirectoryChange,
    homeAddress,
    settings,
    rate,
    allEvents,
    weekStart,
    days,
    planned,
    legs,
    manualStops,
    summary,
    todoCount,
    selection,
    setSelection,
    prevWeek,
    nextWeek,
    thisWeek,
    decideEvent,
    setLegOverride,
    addManualStop,
    removeManualStop,
    handleConfirm,
    addedMessage,
    confirmError,
    recentLocations,
  };
}

export type AgendaImport = ReturnType<typeof useAgendaImport>;
