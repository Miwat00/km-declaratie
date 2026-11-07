"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { parseIcs } from "@/lib/ics";
import { geocodeEventLocation } from "@/lib/tripGenerator";
import {
  addDays, countedLegs, defaultsFor, eventStatus, legToTrip, mondayOf, normalizeTitle, pickStartWeek, planDay,
  routeKey, weekDays, weekSummary,
  type EventDecision, type LegOverride, type ManualStop, type PlannedEvent, type RouteInfo, type RouteLookup,
} from "@/lib/dayPlan";
import {
  loadTrips, saveTrips, loadRate, loadHomeAddress, saveHomeAddress, loadClientDirectory, saveClientDirectory, loadSettings,
  updateSettings, DEFAULT_RATE, DEFAULT_SETTINGS, loadCalendarUrl, saveCalendarUrl, loadSkipTitles, saveSkipTitles,
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

/** Antwoord op "Waar was deze afspraak?" */
export type Answer = { kind: "location"; location: Location } | { kind: "skip" };

/** Laatste actie, met een manier om die terug te draaien (voor de ongedaan-maken-melding). */
export type LastAction = { id: number; message: string; undo: () => void };

async function fetchCalendarText(url: string): Promise<{ text?: string; error?: string }> {
  try {
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { error: body?.error ?? "De agenda kon niet worden opgehaald." };
    }
    return { text: await res.text() };
  } catch {
    return { error: "Geen verbinding. Controleer je internet en probeer het opnieuw." };
  }
}

/** Alle state en acties van de agenda-import: agenda ophalen en de week afronden. */
export function useAgendaImport() {
  // ---------- stap 1: agenda ophalen ----------
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [hasSavedName, setHasSavedName] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [rememberUrl, setRememberUrl] = useState(true);
  const [hasSavedUrl, setHasSavedUrl] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- gegevens uit opslag ----------
  const [directory, setDirectory] = useState<ClientEntry[]>([]);
  const [skipTitles, setSkipTitles] = useState<string[]>([]);
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
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const pendingRoutes = useRef(new Set<string>());
  const pendingGeocodes = useRef(new Set<string>());
  const actionId = useRef(0);

  const effectiveName = name.trim();

  /** Agenda verwerken en openen op de week die je waarschijnlijk wilt declareren. */
  function processIcs(text: string) {
    const events = parseIcs(text);
    if (events.length === 0) {
      setParseError("Geen afspraken gevonden in deze agenda.");
      return false;
    }
    // Direct uit opslag lezen: deze functie draait ook vanuit het laad-effect
    const dir = loadClientDirectory();
    const s = loadSettings();
    const skips = loadSkipTitles();
    const trips = loadTrips();
    const tripDates = events
      .filter((e) => eventStatus(e, undefined, dir, s, undefined, skips).kind !== "skip")
      .map((e) => e.date);
    setWeekStart(pickStartWeek(todayLocal(), tripDates, trips.map((t) => t.date)));

    setParseError(null);
    setAllEvents(events);
    setDecisions({});
    setManualStops([]);
    setLegOverrides({});
    setSelection(null);
    setLastAction(null);
    setAddedMessage(null);
    setFetchedAt(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
    setStep(2);
    return true;
  }

  // localStorage bestaat pas in de browser, dus alles na mount inladen
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const s = loadSettings();
    setName(s.userName);
    setHasSavedName(!!s.userName);
    setSettings(s);
    setDirectory(loadClientDirectory());
    setSkipTitles(loadSkipTitles());
    setHomeAddress(loadHomeAddress());
    setRate(loadRate());
    setExistingTrips(loadTrips());

    // Met een onthouden link halen we de agenda meteen op en sla je stap 1 over
    const savedUrl = loadCalendarUrl();
    setCalendarUrl(savedUrl);
    setHasSavedUrl(!!savedUrl);
    if (!savedUrl) return;
    setAutoFetching(true);
    fetchCalendarText(savedUrl).then(({ text, error }) => {
      if (text) processIcs(text);
      else setParseError(error ?? null);
      setAutoFetching(false);
    });
    // Eenmalig bij openen; processIcs leest zelf uit opslag
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleDirectoryChange(entries: ClientEntry[]) {
    setDirectory(entries);
    saveClientDirectory(entries);
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
    const { text, error } = await fetchCalendarText(calendarUrl);
    setFetchingUrl(false);
    if (!text) {
      setParseError(error ?? null);
      return;
    }
    if (processIcs(text)) {
      saveCalendarUrl(rememberUrl ? calendarUrl.trim() : null);
      setHasSavedUrl(rememberUrl);
    }
  }

  async function refresh() {
    if (!hasSavedUrl) return;
    setAutoFetching(true);
    const { text, error } = await fetchCalendarText(calendarUrl);
    setAutoFetching(false);
    if (!text) {
      setParseError(error ?? null);
      setStep(1);
      return;
    }
    const keepWeek = weekStart;
    if (processIcs(text)) setWeekStart(keepWeek);
  }

  function saveHome(loc: Location) {
    saveHomeAddress(loc);
    setHomeAddress(loc);
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
        status: eventStatus(
          event, decisions[event.id], directory, settings,
          event.location ? geocoded[event.location] : undefined, skipTitles
        ),
      })),
    [weekEvents, decisions, directory, settings, geocoded, skipTitles]
  );

  const legs = useMemo(() => {
    if (!homeAddress) return [];
    const lookup: RouteLookup = (a, b) => routes[routeKey(a, b)] ?? "loading";
    return days.flatMap((d) => planDay(d, planned, manualStops, homeAddress, lookup, legOverrides, existingTrips));
  }, [days, planned, manualStops, homeAddress, routes, legOverrides, existingTrips]);

  const summary = useMemo(() => weekSummary(legs), [legs]);

  /** Afspraken waarvan we niet weten waar ze waren, in volgorde van de week. */
  const questions = useMemo(
    () =>
      planned
        .filter((p) => p.status.kind === "todo")
        .sort((a, b) => (a.event.date + (a.event.startTime ?? "")).localeCompare(b.event.date + (b.event.startTime ?? ""))),
    [planned]
  );

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

  // Locatievelden uit de agenda opzoeken voor afspraken die nog een vraag zijn
  useEffect(() => {
    const queries = questions
      .map((p) => p.event.location)
      .filter((q): q is string => !!q && !(q in geocoded) && !pendingGeocodes.current.has(q));
    if (queries.length === 0) return;
    (async () => {
      for (const q of new Set(queries)) {
        pendingGeocodes.current.add(q);
        const loc = await geocodeEventLocation(q);
        setGeocoded((prev) => ({ ...prev, [q]: loc }));
      }
    })();
  }, [questions, geocoded]);

  // ---------- acties ----------
  function goToWeek(monday: string) {
    setWeekStart(monday);
    setSelection(null);
    setAddedMessage(null);
  }
  const prevWeek = () => goToWeek(addDays(weekStart, -7));
  const nextWeek = () => goToWeek(addDays(weekStart, 7));

  function setDecision(eventId: string, decision: EventDecision | null) {
    setDecisions((prev) => {
      const next = { ...prev };
      if (decision) next[eventId] = decision;
      else delete next[eventId];
      return next;
    });
  }

  function saveDirectory(entries: ClientEntry[]) {
    setDirectory(entries);
    saveClientDirectory(entries);
  }
  function saveSkips(titles: string[]) {
    setSkipTitles(titles);
    saveSkipTitles(titles);
  }

  /**
   * Een afspraak beantwoorden: locatie kiezen of geen rit. Met `remember` geldt het voortaan voor alle
   * afspraken met deze titel. Geeft een ongedaan-maken-melding.
   */
  function decideEvent(event: CalendarEvent, decision: EventDecision | null, remember = false) {
    const prevDecision = decisions[event.id] ?? null;
    const prevDirectory = directory;
    const prevSkips = skipTitles;
    const title = normalizeTitle(event.title);

    setDecision(event.id, decision);
    if (remember && decision?.kind === "link") {
      const entry: ClientEntry = { keyword: event.title.trim(), location: decision.location, client: decision.client, billable: decision.billable };
      saveDirectory([...directory.filter((d) => normalizeTitle(d.keyword) !== title), entry]);
      saveSkips(skipTitles.filter((t) => t !== title));
    }
    if (remember && decision?.kind === "skip" && !skipTitles.includes(title)) {
      saveSkips([...skipTitles, title]);
    }

    const message = !decision
      ? `${event.title}: teruggezet`
      : decision.kind === "skip"
      ? `${event.title}: geen rit${remember ? ", ook voortaan" : ""}`
      : `${event.title}: ${decision.location.shortName}${remember ? ", ook voortaan" : ""}`;
    setLastAction({
      id: ++actionId.current,
      message,
      undo: () => {
        setDecision(event.id, prevDecision);
        saveDirectory(prevDirectory);
        saveSkips(prevSkips);
        setLastAction(null);
      },
    });
  }

  /** Antwoord op de vraag "Waar was deze afspraak?", met slimme standaardwaarden voor klant en factureerbaar. */
  function answerQuestion(event: CalendarEvent, answer: Answer, remember: boolean) {
    if (answer.kind === "skip") {
      decideEvent(event, { kind: "skip" }, remember);
      return;
    }
    const { client, billable } = defaultsFor(event.title, answer.location, settings);
    decideEvent(event, { kind: "link", location: answer.location, client, billable }, remember);
  }

  function setLegOverride(key: string, patch: LegOverride) {
    setLegOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function addManualStop(stop: Omit<ManualStop, "id">) {
    const id = crypto.randomUUID();
    setManualStops((prev) => [...prev, { ...stop, id }]);
    setSelection(null);
    setLastAction({
      id: ++actionId.current,
      message: `Tussenstop ${stop.purpose} toegevoegd`,
      undo: () => {
        setManualStops((prev) => prev.filter((m) => m.id !== id));
        setLastAction(null);
      },
    });
  }

  function removeManualStop(id: string) {
    setManualStops((prev) => prev.filter((m) => m.id !== id));
    setSelection(null);
  }

  function handleConfirm() {
    setConfirmError(null);
    if (!effectiveName) {
      setConfirmError("Vul eerst je naam in via Instellingen op de hoofdpagina.");
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
    setLastAction(null);
    setAddedMessage(`${toAdd.length} ${toAdd.length === 1 ? "rit staat" : "ritten staan"} in je declaratie`);
  }

  /** Adressen die je het vaakst gebruikt (koppelingen en eerdere ritten), als snelle antwoorden. */
  const frequentLocations = useMemo(() => {
    const skip = new Set([homeAddress, settings.office].filter(Boolean).map((l) => l!.shortName));
    const counts = new Map<string, { location: Location; n: number }>();
    const add = (l: Location, weight: number) => {
      if (skip.has(l.shortName)) return;
      const cur = counts.get(l.shortName);
      counts.set(l.shortName, { location: l, n: (cur?.n ?? 0) + weight });
    };
    directory.forEach((d) => add(d.location, 2));
    existingTrips.forEach((t) => add(t.locationB, 1));
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3).map((c) => c.location);
  }, [directory, existingTrips, homeAddress, settings.office]);

  return {
    step,
    setStep,
    name,
    setName,
    hasSavedName,
    parseError,
    calendarUrl,
    setCalendarUrl,
    rememberUrl,
    setRememberUrl,
    hasSavedUrl,
    fetchingUrl,
    autoFetching,
    fetchedAt,
    handleUrlImport,
    refresh,
    forgetCalendarUrl,
    fileInputRef,
    handleFileUpload,
    handleDrop,
    directory,
    showDirectory,
    setShowDirectory,
    handleDirectoryChange,
    homeAddress,
    saveHome,
    settings,
    rate,
    weekStart,
    days,
    planned,
    legs,
    manualStops,
    summary,
    questions,
    selection,
    setSelection,
    prevWeek,
    nextWeek,
    decideEvent,
    answerQuestion,
    lastAction,
    setLastAction,
    setLegOverride,
    addManualStop,
    removeManualStop,
    handleConfirm,
    addedMessage,
    confirmError,
    frequentLocations,
  };
}

export type AgendaImport = ReturnType<typeof useAgendaImport>;
