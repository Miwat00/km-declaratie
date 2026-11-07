"use client";

import { useState, useEffect, useId } from "react";
import dynamic from "next/dynamic";
import LocationInput from "./LocationInput";
import { getRouteWithGeometry } from "@/lib/osrm";
import { loadHomeAddress, saveHomeAddress, loadSettings, updateSettings, SETTINGS_EVENT } from "@/lib/storage";
import { todayLocal } from "@/lib/date";
import { tripRate } from "@/lib/export";
import { formatKm, parseKm } from "@/lib/format";
import type { Location, Trip, RouteData } from "@/lib/types";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

type Props = {
  rate: number;
  /** Nieuwe ritten (bij heen en terug twee tegelijk) */
  onAdd: (trips: Trip[]) => void;
  /** Rit die bewerkt wordt; het formulier start met deze waarden. */
  editing?: Trip | null;
  onUpdate?: (trip: Trip) => void;
  /** Vooraf ingevulde datum en naam (bijv. uit het snelle paneel) */
  initialDate?: string;
  initialName?: string;
};

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-800 mb-1";

/** Wordt alleen in de browser getoond (in een paneel), dus localStorage mag in de beginwaarden. */
export default function TripForm({ rate, onAdd, editing, onUpdate, initialDate, initialName }: Props) {
  const isEditing = !!editing;
  const [date, setDate] = useState(() => editing?.date ?? initialDate ?? todayLocal());
  const [name, setName] = useState(() => editing?.name ?? (initialName || loadSettings().userName));
  const [purpose, setPurpose] = useState(editing?.purpose ?? "");
  const [client, setClient] = useState(editing?.client === "—" ? "" : editing?.client ?? "");
  const [billable, setBillable] = useState(editing?.billable ?? false);
  const [locA, setLocA] = useState<Location | null>(() => editing?.locationA ?? loadHomeAddress());
  const [locB, setLocB] = useState<Location | null>(editing?.locationB ?? null);
  const [declared, setDeclared] = useState(!!editing?.declaredAt);
  const [retour, setRetour] = useState(!isEditing);
  // Afstand: automatisch uit de route, tenzij zelf ingevuld (of de opgeslagen waarde van een bewerkte rit)
  const [kmManual, setKmManual] = useState(isEditing);
  const [kmInput, setKmInput] = useState(editing ? formatKm(editing.distanceKm) : "");
  // Route hoort bij een van/naar-paar; bij een ander paar is hij vanzelf ongeldig
  const [route, setRoute] = useState<{ key: string; data?: RouteData; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [homeAddress, setHomeAddress] = useState<Location | null>(loadHomeAddress);
  const uid = useId();
  const ids = { name: `${uid}-name`, date: `${uid}-date`, purpose: `${uid}-purpose`, client: `${uid}-client`, km: `${uid}-km`, kmHint: `${uid}-km-hint` };

  useEffect(() => {
    const sync = () => setHomeAddress(loadHomeAddress());
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const changeLocA = (loc: Location | null) => { setLocA(loc); setKmManual(false); };
  const changeLocB = (loc: Location | null) => { setLocB(loc); setKmManual(false); };
  const handleKmInput = (value: string) => { setKmInput(value); setKmManual(true); };
  const handleSaveHome = (loc: Location) => { saveHomeAddress(loc); setHomeAddress(loc); };

  const pairKey = locA && locB ? `${locA.lat},${locA.lon}>${locB.lat},${locB.lon}` : null;
  const current = route && route.key === pairKey ? route : null;
  const routeAB = current?.data ?? null;
  const routeError = current?.error ?? null;
  const routeLoading = !!pairKey && !current;

  const effectiveName = name.trim();
  const routeKm = routeAB?.distanceKm ?? null;
  const km = kmManual ? parseKm(kmInput) : routeKm;
  const kmDisplay = kmManual ? kmInput : routeKm !== null ? formatKm(routeKm) : "";
  const kmInvalid = kmManual && kmInput.trim() !== "" && km === null;

  useEffect(() => {
    if (!pairKey || !locA || !locB) return;
    let cancelled = false;
    getRouteWithGeometry(locA, locB)
      .then((data) => !cancelled && setRoute({ key: pairKey, data }))
      .catch((err) => !cancelled && setRoute({ key: pairKey, error: err instanceof Error ? err.message : "Route ophalen mislukt" }));
    return () => { cancelled = true; };
    // pairKey bevat locA en locB
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  const canSubmit = !!locA && !!locB && km !== null && !!date && !!effectiveName && !!purpose.trim() && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !locA || !locB || km === null) return;
    setSubmitting(true);
    if (!loadSettings().userName) updateSettings({ userName: effectiveName });

    const base = { date, name: effectiveName, purpose: purpose.trim(), client: client.trim(), billable };
    if (editing && onUpdate) {
      // Een bewerkte rit houdt zijn eigen tarief
      const r = tripRate(editing);
      const { declaredAt: prevDeclared, ...rest } = editing;
      onUpdate({
        ...rest, ...base, locationA: locA, locationB: locB, distanceKm: km, rate: r,
        amount: Math.round(km * r * 100) / 100,
        ...(declared ? { declaredAt: prevDeclared ?? todayLocal() } : {}),
      });
      return;
    }

    const make = (from: Location, to: Location, d: number): Trip => ({
      id: crypto.randomUUID(), ...base, locationA: from, locationB: to, distanceKm: d, rate, amount: Math.round(d * rate * 100) / 100,
    });
    const trips = [make(locA, locB, km)];
    if (retour) {
      // Zelf ingevulde afstand geldt ook terug; anders de terugroute berekenen (valt terug op de heenweg)
      let back = km;
      if (!kmManual) {
        try {
          back = (await getRouteWithGeometry(locB, locA)).distanceKm;
        } catch {
          back = km;
        }
      }
      trips.push(make(locB, locA, back));
    }
    onAdd(trips);
  }

  return (
    <form id="trip-form" onSubmit={handleSubmit} className="space-y-4" aria-label={isEditing ? "Rit bewerken" : "Rit toevoegen"}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
        <div>
          <label htmlFor={ids.name} className={label}>Naam</label>
          <input id={ids.name} required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jouw naam" autoComplete="name" className={input} />
        </div>
        <div>
          <label htmlFor={ids.date} className={label}>Datum</label>
          <input id={ids.date} required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
      </div>

      <LocationInput label="Van" value={locA} onChange={changeLocA} disabled={submitting} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
      <LocationInput label="Naar" value={locB} onChange={changeLocB} disabled={submitting} homeAddress={homeAddress} onSaveHome={handleSaveHome} />

      {/* Afstand: berekend, aan te passen */}
      <div className="flex items-center gap-2 flex-wrap">
        <label htmlFor={ids.km} className="text-sm font-medium text-gray-800">Afstand</label>
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
            className={`w-24 rounded-lg border px-3 py-1.5 pr-9 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${kmInvalid ? "border-red-400" : "border-gray-300"}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">km</span>
        </div>
        <p id={ids.kmHint} className={`text-xs ${kmInvalid || (routeError && !kmManual) ? "text-orange-700" : "text-gray-600"}`} aria-live="polite">
          {routeLoading && !kmManual ? "Route berekenen…"
            : kmInvalid ? "Vul een afstand in, bijv. 12,5"
            : routeError && !kmManual ? "Route niet gevonden. Vul de afstand zelf in."
            : kmManual && routeKm !== null && km !== routeKm ? (
              <>
                Zelf aangepast (route: {formatKm(routeKm)} km).{" "}
                <button type="button" onClick={() => setKmManual(false)} className="text-blue-700 hover:underline">Route gebruiken</button>
              </>
            )
            : routeKm !== null && !kmManual ? "Berekend via OpenStreetMap. Je kunt het aanpassen."
            : null}
        </p>
      </div>

      {routeAB && locA && locB && (
        <div className="rounded-lg overflow-hidden">
          <RouteMap route={routeAB} locationA={locA} locationB={locB} />
        </div>
      )}

      <div>
        <label htmlFor={ids.purpose} className={label}>Waarvoor?</label>
        <input id={ids.purpose} required type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Klantbezoek, overleg, cursus…" className={input} />
      </div>

      <details className="text-sm" open={isEditing && (!!client || billable)}>
        <summary className="cursor-pointer text-gray-700">
          Meer opties <span className="text-gray-500">· {client || "geen klant"} · {billable ? "doorbelasten" : "niet doorbelasten"}</span>
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={ids.client} className={label}>Klant of project <span className="font-normal text-gray-500">(optioneel)</span></label>
            <input id={ids.client} type="text" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Klantnaam" className={input} />
          </div>
          <label className="flex items-center gap-2 text-gray-800">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Doorbelasten aan de klant
          </label>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        {isEditing ? (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Gedeclareerd
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={retour} onChange={(e) => setRetour(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Heen en terug
          </label>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold"
        >
          {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
          {isEditing ? "Opslaan" : retour ? "Heen en terug toevoegen" : "Rit toevoegen"}
        </button>
      </div>
    </form>
  );
}
