"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { parseIcs } from "@/lib/ics";
import { geocodeEventLocation } from "@/lib/tripGenerator";
import {
  addDays, applyDayMode, weekdayIndex, countedLegs, defaultsFor, eventStatus, inferPlace, legToTrip, mondayOf, normalizeTitle,
  pickStartWeek, planDay, routeKey, weekDays, weekSummary,
  type DayMode, type EventDecision, type LegOverride, type ManualStop, type Place, type PlannedEvent, type RouteInfo,
  type RouteLookup, type Transport,
} from "@/lib/dayPlan";
import {
  loadTrips, saveTrips, loadRate, loadHomeAddress, saveHomeAddress, loadClientDirectory, saveClientDirectory, loadSettings,
  updateSettings, DEFAULT_RATE, DEFAULT_SETTINGS, loadCalendarUrl, saveCalendarUrl, loadSkipTitles, saveSkipTitles,
  loadDayModes, saveDayModes,
} from "@/lib/storage";
import { getRouteWithGeometry } from "@/lib/osrm";
import { todayLocal } from "@/lib/date";
import type { CalendarEvent, ClientEntry, Location, Settings, Trip } from "@/lib/types";

const PLACE_LABEL: Record<Place, string> = { thuis: "thuis", kantoor: "op kantoor", pad: "op pad" };

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
  /** Per dag: waar de laatste rit naartoe gaat als dat niet thuis is */
  const [dayEnds, setDayEnds] = useState<Record<string, Location>>({});
  const [dayStarts, setDayStarts] = useState<Record<string, Location>>({});
  /** Per dag: waar je werkte en hoe je reisde, als je dat zelf koos */
  const [dayChoices, setDayChoicesState] = useState<Record<string, { place?: Place; transport?: Transport }>>({});
  const [showWeekend, setShowWeekend] = useState(false);
  // Dagkeuzes blijven per datum bewaard, zodat een week er later nog net zo uitziet
  const setDayChoices = (update: (prev: typeof dayChoices) => typeof dayChoices) =>
    setDayChoicesState((prev) => {
      const next = update(prev);
      saveDayModes(next);
      return next;
    });
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
    setDayEnds({});
    setDayStarts({});
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
    setDayChoicesState(loadDayModes());

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
  // Eerst wat de afspraak zelf zegt (koppeling, kantoor, online…), dan wat de dag zegt (thuis, kantoor, OV)
  const basePlanned: PlannedEvent[] = useMemo(
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

  // Het weekend staat standaard uit; je kunt het tonen als je toch eens in het weekend reed
  const days = useMemo(() => (showWeekend ? allDays : allDays.slice(0, 5)), [allDays, showWeekend]);
  const weekendInfo = useMemo(() => {
    const weekend = basePlanned.filter((p) => p.event.date >= allDays[5]);
    return { count: weekend.length, withPlace: weekend.filter((p) => p.status.kind === "linked").length };
  }, [basePlanned, allDays]);

  const dayModes: Record<string, DayMode> = useMemo(() => {
    const out: Record<string, DayMode> = {};
    for (const d of days) {
      const chosen = dayChoices[d] ?? {};
      const guess = inferPlace(basePlanned.filter((p) => p.event.date === d).map((p) => p.status));
      // In het weekend werk je meestal niet: geen vraag, tenzij je zelf iets kiest
      const inferred = guess === null && weekdayIndex(d) >= 5 ? "thuis" : guess;
      out[d] = { place: chosen.place ?? inferred, transport: chosen.transport ?? "auto", chosen: !!chosen.place };
    }
    return out;
  }, [days, dayChoices, basePlanned]);

  const planned: PlannedEvent[] = useMemo(
    () =>
      basePlanned.map((p) => {
        const mode = dayModes[p.event.date];
        return mode ? { ...p, status: applyDayMode(p.status, mode, settings) } : p;
      }),
    [basePlanned, dayModes, settings]
  );

  const legs = useMemo(() => {
    if (!homeAddress) return [];
    const lookup: RouteLookup = (a, b) => routes[routeKey(a, b)] ?? "loading";
    return days.flatMap((d) => {
      const mode = dayModes[d];
      const officeDay =
        mode?.place === "kantoor" && mode.transport === "auto" && settings.office
          ? { location: settings.office, client: settings.companyName || "Kantoor" }
          : undefined;
      return planDay(d, planned, manualStops, homeAddress, lookup, legOverrides, existingTrips, dayEnds[d] ?? homeAddress, officeDay, dayStarts[d] ?? homeAddress);
    });
  }, [days, dayModes, planned, manualStops, homeAddress, routes, legOverrides, existingTrips, dayEnds, dayStarts, settings]);

  const summary = useMemo(() => weekSummary(legs), [legs]);

  /** Dagen waarvan de app niet kan raden waar je werkte: die vraagt hij eerst, per dag. */
  const dayQuestions = useMemo(
    () => days.filter((d) => dayModes[d]?.place === null && dayModes[d]?.transport === "auto"),
    [days, dayModes]
  );

  /** Daarna alleen nog afspraken op "op pad"-dagen waarvan de plek onbekend is. */
  const questions = useMemo(
    () =>
      planned
        .filter((p) => p.status.kind === "todo" && dayModes[p.event.date]?.place === "pad")
        .sort((a, b) => (a.event.date + (a.event.startTime ?? "")).localeCompare(b.event.date + (b.event.startTime ?? ""))),
    [planned, dayModes]
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

  // Locatievelden uit de agenda opzoeken voor afspraken zonder bekende plek (helpt ook de dag te raden)
  useEffect(() => {
    const queries = basePlanned
      .filter((p) => p.status.kind === "todo")
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
  }, [basePlanned, geocoded]);

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


  /** Waar je werkte en/of hoe je reisde op een dag (of op meerdere dagen tegelijk). */
  function setDayMode(dates: string | string[], patch: { place?: Place; transport?: Transport }) {
    const list = Array.isArray(dates) ? dates : [dates];
    const previous = Object.fromEntries(list.map((d) => [d, dayChoices[d]]));
    setDayChoices((prev) => {
      const next = { ...prev };
      for (const d of list) next[d] = { ...prev[d], ...patch };
      return next;
    });
    setSelection(null);
    const dayLabel =
      list.length === 1
        ? new Date(`${list[0]}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })
        : `${list.length} dagen`;
    const parts = [patch.place ? PLACE_LABEL[patch.place] : null, patch.transport ? (patch.transport === "ov" ? "met het OV" : "met de auto") : null];
    setLastAction({
      id: ++actionId.current,
      message: `${dayLabel}: ${parts.filter(Boolean).join(", ")}`,
      undo: () => {
        setDayChoices((prev) => {
          const next = { ...prev };
          for (const d of list) {
            if (previous[d]) next[d] = previous[d];
            else delete next[d];
          }
          return next;
        });
        setLastAction(null);
      },
    });
  }

  /** Kantooradres instellen vanuit de agenda (als je dat nog niet had gedaan). */
  function saveOffice(location: Location) {
    setSettings(updateSettings({ office: location }));
  }

  /** Alles van deze week terug naar wat de app zelf raadt (met ongedaan maken). */
  function resetWeek() {
    const inWeek = (date: string) => date >= allDays[0] && date <= allDays[6];
    const eventIds = new Set(weekEvents.map((e) => e.id));
    const snapshot = { dayChoices, decisions, manualStops, legOverrides, dayEnds, dayStarts };
    const without = <T,>(rec: Record<string, T>, keep: (k: string) => boolean) =>
      Object.fromEntries(Object.entries(rec).filter(([k]) => keep(k)));

    setDayChoices((prev) => without(prev, (d) => !inWeek(d)));
    setDecisions((prev) => without(prev, (id) => !eventIds.has(id)));
    setManualStops((prev) => prev.filter((m) => !inWeek(m.date)));
    setLegOverrides((prev) => without(prev, (k) => !inWeek(k.slice(0, 10))));
    setDayEnds((prev) => without(prev, (d) => !inWeek(d)));
    setDayStarts((prev) => without(prev, (d) => !inWeek(d)));
    setSelection(null);
    setLastAction({
      id: ++actionId.current,
      message: "Week teruggezet naar wat de app raadt",
      undo: () => {
        setDayChoices(() => snapshot.dayChoices);
        setDecisions(snapshot.decisions);
        setManualStops(snapshot.manualStops);
        setLegOverrides(snapshot.legOverrides);
        setDayEnds(snapshot.dayEnds);
        setDayStarts(snapshot.dayStarts);
        setLastAction(null);
      },
    });
  }

  /** Dagkeuzes van vorige week, als voorstel voor deze week (alleen als je deze week nog niets koos). */
  const previousWeek = useMemo(() => {
    const thisWeekChosen = allDays.some((d) => dayChoices[d]);
    if (thisWeekChosen) return null;
    const pairs = allDays.slice(0, 5).map((d) => ({ date: d, prev: dayChoices[addDays(d, -7)] })).filter((p) => p.prev?.place || p.prev?.transport);
    if (pairs.length === 0) return null;
    const label = (c: { place?: Place; transport?: Transport }) =>
      `${c.place ? PLACE_LABEL[c.place] : "?"}${c.transport === "ov" ? " · OV" : c.place && c.place !== "thuis" ? " · auto" : ""}`;
    const labels = [...new Set(pairs.map((p) => label(p.prev!)))];
    return { pairs, summary: labels.length === 1 && pairs.length === 5 ? `ma–vr ${labels[0]}` : `${pairs.length} dagen` };
  }, [allDays, dayChoices]);

  function copyPreviousWeek() {
    if (!previousWeek) return;
    setDayChoices((prev) => {
      const next = { ...prev };
      for (const { date, prev: c } of previousWeek.pairs) next[date] = { ...c };
      return next;
    });
    setLastAction({
      id: ++actionId.current,
      message: "Dagen van vorige week overgenomen",
      undo: () => {
        setDayChoices((prev) => Object.fromEntries(Object.entries(prev).filter(([d]) => !previousWeek.pairs.some((p) => p.date === d))));
        setLastAction(null);
      },
    });
  }

  /** Waar je die dag na je laatste afspraak naartoe reed; null = gewoon naar huis. */
  function setDayEnd(date: string, location: Location | null) {
    setDayEndpoint("end", date, location);
  }
  /** Waar je die dag 's ochtends vertrok; null = gewoon vanaf huis. */
  function setDayStart(date: string, location: Location | null) {
    setDayEndpoint("start", date, location);
  }
  function setDayEndpoint(kind: "start" | "end", date: string, location: Location | null) {
    const setter = kind === "start" ? setDayStarts : setDayEnds;
    const previous = (kind === "start" ? dayStarts : dayEnds)[date] ?? null;
    const apply = (loc: Location | null) =>
      setter((prev) => {
        const next = { ...prev };
        if (loc) next[date] = loc;
        else delete next[date];
        return next;
      });
    apply(location);
    setSelection(null);
    setLastAction({
      id: ++actionId.current,
      message:
        kind === "start"
          ? location ? `Vertrek vanaf ${location.shortName}` : "Vertrek weer vanaf huis"
          : location ? `Terugrit naar ${location.shortName}` : "Terugrit weer naar huis",
      undo: () => {
        apply(previous);
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
    dayModes,
    dayQuestions,
    setDayMode,
    showWeekend,
    setShowWeekend,
    weekendInfo,
    resetWeek,
    previousWeek,
    copyPreviousWeek,
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
    setDayEnd,
    setDayStart,
    saveOffice,
    dayStarts,
    dayEnds,
    handleConfirm,
    addedMessage,
    confirmError,
    frequentLocations,
  };
}

export type AgendaImport = ReturnType<typeof useAgendaImport>;
