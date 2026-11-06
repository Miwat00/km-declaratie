"use client";

import { useState, useEffect, useRef, useId } from "react";
import dynamic from "next/dynamic";
import LocationInput from "./LocationInput";
import { getRouteWithGeometry } from "@/lib/osrm";
import { loadHomeAddress, saveHomeAddress, loadSettings, updateSettings, SETTINGS_EVENT } from "@/lib/storage";
import { todayLocal } from "@/lib/date";
import { tripRate } from "@/lib/export";
import { formatKm, parseKm } from "@/lib/format";
import type { Suggestion } from "@/lib/trips";
import type { Location, Trip, RouteData } from "@/lib/types";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

type Props = {
  rate: number;
  onAdd: (trip: Trip) => void;
  /** Rit die bewerkt wordt. Geef het formulier een `key` per rit, dan start het met deze waarden. */
  editing?: Trip | null;
  onUpdate?: (trip: Trip) => void;
  onCancelEdit?: () => void;
  suggestions?: Suggestion[];
};

export default function TripForm({ rate, onAdd, editing, onUpdate, onCancelEdit, suggestions = [] }: Props) {
  const [date, setDate] = useState(() => editing?.date ?? todayLocal());
  const [name, setName] = useState(editing?.name ?? "");
  const [purpose, setPurpose] = useState(editing?.purpose ?? "");
  const [client, setClient] = useState(editing?.client ?? "");
  const [billable, setBillable] = useState<boolean | null>(editing ? editing.billable : null);
  const [locA, setLocA] = useState<Location | null>(editing?.locationA ?? null);
  const [locB, setLocB] = useState<Location | null>(editing?.locationB ?? null);
  const [declared, setDeclared] = useState(!!editing?.declaredAt);
  // Afstand: automatisch uit de route, tenzij handmatig ingevuld (of de opgeslagen waarde van een bewerkte rit)
  const [kmManual, setKmManual] = useState(!!editing);
  const [kmInput, setKmInput] = useState(editing ? formatKm(editing.distanceKm) : "");
  const uid = useId();
  const ids = {
    name: `${uid}-name`, date: `${uid}-date`, purpose: `${uid}-purpose`, client: `${uid}-client`,
    km: `${uid}-km`, kmHint: `${uid}-km-hint`, billable: `${uid}-billable`,
  };
  const [retour, setRetour] = useState(false);
  const [routeAB, setRouteAB] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<Location | null>(null);
  const routeFetchRef = useRef<number>(0);

  const isEditing = !!editing;

  useEffect(() => {
    const sync = () => {
      setHomeAddress(loadHomeAddress());
      const saved = loadSettings().userName;
      if (saved && !isEditing) setName(saved);
    };
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, [isEditing]);

  function changeLocA(loc: Location | null) {
    setLocA(loc);
    setKmManual(false);
  }

  function changeLocB(loc: Location | null) {
    setLocB(loc);
    setKmManual(false);
  }

  function handleKmInput(value: string) {
    setKmInput(value);
    setKmManual(true);
  }

  function applySuggestion(s: Suggestion) {
    setLocA(s.locationA);
    setLocB(s.locationB);
    setKmManual(false);
    setPurpose(s.purpose);
    setClient(s.client);
    setBillable(s.billable);
  }

  function handleSaveHome(loc: Location) {
    saveHomeAddress(loc);
    setHomeAddress(loc);
  }

  const effectiveName = name.trim();
  const routeKm = routeAB?.distanceKm ?? null;
  const km = kmManual ? parseKm(kmInput) : routeKm;
  const kmDisplay = kmManual ? kmInput : routeKm !== null ? formatKm(routeKm) : "";
  const kmInvalid = kmManual && kmInput.trim() !== "" && km === null;

  useEffect(() => {
    if (!locA || !locB) {
      setRouteAB(null);
      setRouteError(null);
      return;
    }

    const fetchId = ++routeFetchRef.current;
    setRouteLoading(true);
    setRouteError(null);
    setRouteAB(null);

    getRouteWithGeometry(locA, locB)
      .then((data) => {
        if (fetchId === routeFetchRef.current) setRouteAB(data);
      })
      .catch((err) => {
        if (fetchId === routeFetchRef.current)
          setRouteError(err instanceof Error ? err.message : "Route ophalen mislukt");
      })
      .finally(() => {
        if (fetchId === routeFetchRef.current) setRouteLoading(false);
      });
  }, [locA, locB]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locA || !locB || km === null || !date || !effectiveName || !purpose.trim() || !client.trim() || billable === null) return;

    setSubmitLoading(true);
    setSubmitError(null);
    if (!editing && effectiveName !== loadSettings().userName) updateSettings({ userName: effectiveName });

    if (editing && onUpdate) {
      // Bewerkte rit houdt zijn eigen tarief
      const tripRateValue = tripRate(editing);
      const { declaredAt: previousDeclaredAt, ...rest } = editing;
      onUpdate({
        ...rest,
        ...(declared ? { declaredAt: previousDeclaredAt ?? todayLocal() } : {}),
        date,
        name: effectiveName,
        purpose: purpose.trim(),
        client: client.trim(),
        billable: billable!,
        locationA: locA,
        locationB: locB,
        distanceKm: km,
        rate: tripRateValue,
        amount: Math.round(km * tripRateValue * 100) / 100,
      });
      setSubmitLoading(false);
      return;
    }

    try {
      const makeTrip = (from: Location, to: Location, distKm: number): Trip => ({
        id: crypto.randomUUID(),
        date,
        name: effectiveName,
        purpose: purpose.trim(),
        client: client.trim(),
        billable: billable!,
        locationA: from,
        locationB: to,
        distanceKm: distKm,
        rate,
        amount: Math.round(distKm * rate * 100) / 100,
      });

      onAdd(makeTrip(locA, locB, km));

      if (retour) {
        // Handmatige afstand geldt ook voor de terugweg; anders de terugroute berekenen (valt terug op de heenweg)
        let returnKm = km;
        if (!kmManual) {
          try {
            returnKm = (await getRouteWithGeometry(locB, locA)).distanceKm;
          } catch {
            returnKm = km;
          }
        }
        onAdd(makeTrip(locB, locA, returnKm));
      }

      setDate(todayLocal());
      setPurpose("");
      setClient("");
      setBillable(null);
      setLocA(null);
      setLocB(null);
      setRetour(false);
      setRouteAB(null);
      setKmManual(false);
      setKmInput("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setSubmitLoading(false);
    }
  }

  const canSubmit =
    !!locA && !!locB && km !== null && !!date && !!effectiveName &&
    !!purpose.trim() && !!client.trim() && billable !== null && !submitLoading;

  return (
    <form
      id="trip-form"
      onSubmit={handleSubmit}
      className={`bg-white rounded-xl border shadow-sm scroll-mt-4 ${isEditing ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}
    >
      {/* Zij-aan-zij layout op grote schermen */}
      <div className="flex flex-col lg:flex-row">

        {/* Linker kolom: alle invoervelden */}
        <div className="flex-1 p-5 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {isEditing ? "Rit bewerken" : "Nieuwe rit toevoegen"}
            </h2>
            {isEditing && (
              <button type="button" onClick={onCancelEdit} className="text-sm text-gray-500 hover:text-gray-700">
                Annuleren
              </button>
            )}
          </div>

          {/* Snelkeuze: veelgereden ritten */}
          {!isEditing && suggestions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap -mt-1">
              <span className="text-xs text-gray-500">Snelkeuze:</span>
              {suggestions.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors max-w-[16rem] truncate"
                  title={`${s.locationA.shortName} → ${s.locationB.shortName} · ${s.client} (${s.count}×)`}
                >
                  {s.purpose} · {s.locationB.shortName.split(",")[0]}
                </button>
              ))}
            </div>
          )}

          {/* Rij 1: Wie + Wanneer */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
            <div>
              <label htmlFor={ids.name} className="block text-sm font-medium text-gray-700 mb-1">
                Je naam <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.name}
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jouw naam"
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="sm:w-36">
              <label htmlFor={ids.date} className="block text-sm font-medium text-gray-700 mb-1">
                Datum <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.date}
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Rij 2: Route */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <LocationInput label="Startpunt (adres)" value={locA} onChange={changeLocA} disabled={submitLoading} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
            <div className="flex-shrink-0 text-gray-500 pb-2 hidden sm:block">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <LocationInput label="Eindpunt (adres)" value={locB} onChange={changeLocB} disabled={submitLoading} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
          </div>

          {/* Afstand: automatisch berekend, handmatig aan te passen */}
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor={ids.km} className="text-sm font-medium text-gray-700">
              Afstand <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id={ids.km}
                type="text"
                inputMode="decimal"
                value={kmDisplay}
                onChange={(e) => handleKmInput(e.target.value)}
                placeholder={routeLoading ? "…" : "0,0"}
                aria-describedby={ids.kmHint}
                aria-invalid={kmInvalid}
                className={`w-24 rounded-lg border px-3 py-1.5 pr-9 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  kmInvalid ? "border-red-400" : "border-gray-300"
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">km</span>
            </div>
            <p id={ids.kmHint} className={`text-xs ${kmInvalid || (routeError && !kmManual) ? "text-orange-600" : "text-gray-500"}`} aria-live="polite">
              {routeLoading && !kmManual ? (
                "Route berekenen…"
              ) : kmInvalid ? (
                "Vul een afstand in, bijv. 12,5"
              ) : routeError && !kmManual ? (
                "Route niet gevonden. Vul de afstand zelf in."
              ) : kmManual && routeKm !== null && km !== routeKm ? (
                <>
                  Handmatig aangepast (route: {formatKm(routeKm)} km).{" "}
                  <button type="button" onClick={() => setKmManual(false)} className="text-blue-600 hover:underline">
                    Route gebruiken
                  </button>
                </>
              ) : routeKm !== null && !kmManual ? (
                "Berekend via OpenStreetMap. Je kunt het aanpassen."
              ) : null}
            </p>
          </div>

          {/* Rij 3: Waarom + Facturering */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor={ids.purpose} className="block text-sm font-medium text-gray-700 mb-1">
                Waar was de rit voor? <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.purpose}
                required
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Bijv. klantbezoek, vergadering..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor={ids.client} className="block text-sm font-medium text-gray-700 mb-1">
                Klant / project <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.client}
                required
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Klant- of projectnaam"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-shrink-0 self-start sm:self-auto">
              <span id={ids.billable} className="block text-sm font-medium text-gray-700 mb-1">
                Factureerbaar? <span className="text-red-500" aria-hidden="true">*</span>
              </span>
              <div role="group" aria-labelledby={ids.billable} className="flex rounded-lg overflow-hidden text-sm font-medium border border-gray-300 w-fit">
                <button
                  type="button"
                  aria-pressed={billable === false}
                  onClick={() => setBillable(false)}
                  className={`px-4 py-2 transition-colors ${
                    billable === false
                      ? "bg-gray-800 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Nee
                </button>
                <button
                  type="button"
                  aria-pressed={billable === true}
                  onClick={() => setBillable(true)}
                  className={`px-4 py-2 border-l border-gray-300 transition-colors ${
                    billable === true
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Ja
                </button>
              </div>
            </div>
          </div>

          {/* Submit rij */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex items-center gap-4">
              {submitError ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {submitError}
                </p>
              ) : (
                <p className="text-xs text-gray-500">Alle velden met * zijn verplicht</p>
              )}
              {isEditing && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={declared}
                    onChange={(e) => setDeclared(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Gedeclareerd</span>
                </label>
              )}
              {!isEditing && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={retour}
                    onChange={(e) => setRetour(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Heen en terug</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto"
            >
              {submitLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {retour ? "Heen + terug..." : "Toevoegen..."}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isEditing ? "Wijzigingen opslaan" : retour ? "Heen + terug toevoegen" : "Rit toevoegen"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rechter kolom: kaartpreview — verborgen op mobiel als er geen route is */}
        <div className={`lg:w-96 lg:border-l border-t lg:border-t-0 border-gray-200 bg-gray-50 flex-col overflow-hidden rounded-b-xl lg:rounded-b-none lg:rounded-r-xl max-h-64 lg:max-h-none ${routeAB || routeLoading || routeError ? "flex" : "hidden lg:flex"}`}>
          {/* Kaart header met afstand */}
          {routeAB && locA && locB ? (
            <>
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 bg-white">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="flex items-center gap-1 text-green-700 font-medium truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600 flex-shrink-0 inline-block" />
                    <span className="truncate">{locA.shortName}</span>
                  </span>
                  <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="flex items-center gap-1 text-red-700 font-medium truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0 inline-block" />
                    <span className="truncate">{locB.shortName}</span>
                  </span>
                </div>
                <span className="text-sm font-bold text-blue-700 flex-shrink-0 ml-2">
                  {routeAB.distanceKm.toFixed(1).replace(".", ",")} km
                </span>
              </div>
              <div className="flex-1 p-3">
                <RouteMap route={routeAB} locationA={locA} locationB={locB} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
              {routeLoading ? (
                <>
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Route ophalen...</p>
                </>
              ) : routeError ? (
                <>
                  <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-orange-600">{routeError}</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    Vul start- en eindpunt in<br />om de route te zien
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
