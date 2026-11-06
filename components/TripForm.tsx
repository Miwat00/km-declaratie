"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LocationInput from "./LocationInput";
import { getRouteWithGeometry } from "@/lib/osrm";
import { loadHomeAddress, saveHomeAddress, loadSettings, updateSettings, SETTINGS_EVENT } from "@/lib/storage";
import { todayLocal } from "@/lib/date";
import type { Location, Trip, RouteData } from "@/lib/types";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

type Props = {
  rate: number;
  onAdd: (trip: Trip) => void;
};

export default function TripForm({ rate, onAdd }: Props) {
  const [date, setDate] = useState(todayLocal);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [client, setClient] = useState("");
  const [billable, setBillable] = useState<boolean | null>(null);
  const [locA, setLocA] = useState<Location | null>(null);
  const [locB, setLocB] = useState<Location | null>(null);
  const [retour, setRetour] = useState(false);
  const [routeAB, setRouteAB] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<Location | null>(null);
  const routeFetchRef = useRef<number>(0);

  useEffect(() => {
    const sync = () => {
      setHomeAddress(loadHomeAddress());
      const saved = loadSettings().userName;
      if (saved) setName(saved);
    };
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  function handleSaveHome(loc: Location) {
    saveHomeAddress(loc);
    setHomeAddress(loc);
  }

  const effectiveName = name.trim();

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
    if (!locA || !locB || !routeAB || !date || !effectiveName || !purpose.trim() || !client.trim() || billable === null) return;

    setSubmitLoading(true);
    setSubmitError(null);
    if (effectiveName !== loadSettings().userName) updateSettings({ userName: effectiveName });

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

      onAdd(makeTrip(locA, locB, routeAB.distanceKm));

      if (retour) {
        const returnRoute = await getRouteWithGeometry(locB, locA);
        onAdd(makeTrip(locB, locA, returnRoute.distanceKm));
      }

      setDate(todayLocal());
      setPurpose("");
      setClient("");
      setBillable(null);
      setLocA(null);
      setLocB(null);
      setRetour(false);
      setRouteAB(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setSubmitLoading(false);
    }
  }

  const canSubmit =
    !!routeAB && !routeLoading && !!date && !!effectiveName &&
    !!purpose.trim() && !!client.trim() && billable !== null && !submitLoading;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Zij-aan-zij layout op grote schermen */}
      <div className="flex flex-col lg:flex-row">

        {/* Linker kolom: alle invoervelden */}
        <div className="flex-1 p-5 space-y-4 min-w-0">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Nieuwe rit toevoegen
          </h2>

          {/* Rij 1: Wie + Wanneer */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Je naam <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jouw naam"
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="sm:w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Rij 2: Route */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <LocationInput label="Startpunt (adres)" value={locA} onChange={setLocA} disabled={submitLoading} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
            <div className="flex-shrink-0 text-gray-400 pb-2 hidden sm:block">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <LocationInput label="Eindpunt (adres)" value={locB} onChange={setLocB} disabled={submitLoading} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
          </div>

          {/* Rij 3: Waarom + Facturering */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Waar was de rit voor? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Bijv. klantbezoek, vergadering..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Klant / project <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Klant- of projectnaam"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-shrink-0 self-start sm:self-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Factureerbaar? <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg overflow-hidden text-sm font-medium border border-gray-300 w-fit">
                <button
                  type="button"
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
                <p className="text-xs text-gray-400">Alle velden met * zijn verplicht</p>
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={retour}
                  onChange={(e) => setRetour(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Heen en terug</span>
              </label>
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
                  {retour ? "Heen + terug toevoegen" : "Rit toevoegen"}
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
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <p className="text-sm text-gray-400">
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
