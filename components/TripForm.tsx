"use client";

import { useState, useEffect, useId } from "react";
import dynamic from "next/dynamic";
import LocationInput from "./LocationInput";
import { KmRow, useRouteDistance } from "./useRouteDistance";
import { getRouteWithGeometry } from "@/lib/osrm";
import { loadHomeAddress, saveHomeAddress, loadSettings, updateSettings, SETTINGS_EVENT } from "@/lib/storage";
import { todayLocal } from "@/lib/date";
import { tripRate } from "@/lib/export";
import type { Location, Trip } from "@/lib/types";

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
const smallBtn = "px-2.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-800 bg-white hover:bg-gray-50";

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
  // Terugrit: standaard naar het vertrekadres, maar je kunt een ander adres kiezen
  const [returnTo, setReturnTo] = useState<Location | null>(null);
  const [choosingReturn, setChoosingReturn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [homeAddress, setHomeAddress] = useState<Location | null>(loadHomeAddress);
  const uid = useId();
  const ids = { name: `${uid}-name`, date: `${uid}-date`, purpose: `${uid}-purpose`, client: `${uid}-client`, km: `${uid}-km`, kmBack: `${uid}-km-back` };

  const out = useRouteDistance(locA, locB, editing ? editing.distanceKm : undefined);
  const back = useRouteDistance(retour && returnTo ? locB : null, retour ? returnTo : null);

  useEffect(() => {
    const sync = () => setHomeAddress(loadHomeAddress());
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const handleSaveHome = (loc: Location) => { saveHomeAddress(loc); setHomeAddress(loc); };
  const placeName = (l: Location) => (homeAddress && l.shortName === homeAddress.shortName ? "Thuis" : l.shortName);

  const effectiveName = name.trim();
  const backOk = !retour || !returnTo || back.km !== null;
  const canSubmit = !!locA && !!locB && out.km !== null && backOk && !!date && !!effectiveName && !!purpose.trim() && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const km = out.km;
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
      if (returnTo) {
        trips.push(make(locB, returnTo, back.km!));
      } else {
        // Terug naar het vertrekadres: zelf ingevulde afstand geldt ook terug, anders de terugroute (valt terug op de heenweg)
        let backKm = km;
        if (!out.manual) {
          try {
            backKm = (await getRouteWithGeometry(locB, locA)).distanceKm;
          } catch {
            backKm = km;
          }
        }
        trips.push(make(locB, locA, backKm));
      }
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

      <LocationInput label="Van" value={locA} onChange={setLocA} disabled={submitting} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
      <LocationInput label="Naar" value={locB} onChange={setLocB} disabled={submitting} homeAddress={homeAddress} onSaveHome={handleSaveHome} />
      <KmRow id={ids.km} label="Afstand" d={out} />

      {out.routeData && locA && locB && (
        <div className="rounded-lg overflow-hidden">
          <RouteMap route={out.routeData} locationA={locA} locationB={locB} />
        </div>
      )}

      {!isEditing && (
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={retour} onChange={(e) => setRetour(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Heen en terug
          </label>
          {retour && (
            <>
              <p className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                Terug naar: <span className="font-medium text-gray-900">{returnTo ? returnTo.shortName : locA ? placeName(locA) : "het vertrekadres"}</span>
                {!choosingReturn && (
                  <button type="button" className={smallBtn} onClick={() => setChoosingReturn(true)}>Ander adres</button>
                )}
                {returnTo && (
                  <button type="button" className={smallBtn} onClick={() => { setReturnTo(null); setChoosingReturn(false); }}>
                    Terug naar {locA ? placeName(locA) : "vertrekadres"}
                  </button>
                )}
              </p>
              {choosingReturn && !returnTo && (
                <div className="space-y-1">
                  <LocationInput label="Terug naar" value={null} onChange={(loc) => loc && setReturnTo(loc)} homeAddress={homeAddress} />
                  <button type="button" className="text-xs text-gray-700 hover:underline" onClick={() => setChoosingReturn(false)}>Annuleren</button>
                </div>
              )}
              {returnTo && <KmRow id={ids.kmBack} label="Afstand terug" d={back} />}
            </>
          )}
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
          <span />
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
