"use client";

import { useState } from "react";
import LocationInput from "@/components/LocationInput";
import KmField from "./KmField";
import { eventSpan, fromMin, type Leg, type ManualStop, type PlannedEvent } from "@/lib/dayPlan";
import { formatDateNL } from "@/lib/date";
import { formatKm } from "@/lib/format";
import type { Location } from "@/lib/types";
import type { AgendaImport } from "./useAgendaImport";

const panel = "bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3";
const btn = "px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50";
const primary = "px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const SOURCE: Record<string, string> = {
  koppeling: "via je klant-koppeling",
  kantoor: "je kantooradres",
  agenda: "adres uit je agenda",
  handmatig: "zelf gekozen",
};

function RecentChips({ locations, onPick }: { locations: Location[]; onPick: (l: Location) => void }) {
  if (locations.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-500">Recent:</span>
      {locations.map((l) => (
        <button key={l.shortName} type="button" onClick={() => onPick(l)} className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300">
          {l.shortName}
        </button>
      ))}
    </div>
  );
}

// ---------- afspraak ----------

export function EventPanel({ imp, item }: { imp: AgendaImport; item: PlannedEvent }) {
  const { event, status } = item;
  const { decideEvent, homeAddress, recentLocations, settings, setSelection } = imp;
  const [editing, setEditing] = useState(status.kind === "todo");
  const [location, setLocation] = useState<Location | null>(status.kind === "linked" ? status.location : null);
  const [client, setClient] = useState(status.kind === "linked" ? status.client : event.title);
  const [billable, setBillable] = useState(status.kind === "linked" ? status.billable : true);
  const [remember, setRemember] = useState(true);
  const span = eventSpan(event);
  const when = `${formatDateNL(event.date)} · ${event.startTime ? `${fromMin(span.start)}–${fromMin(span.end)}` : "hele dag"}`;
  const hasDecision = status.kind === "linked" && status.source === "handmatig";

  function link() {
    if (!location) return;
    decideEvent(event, { kind: "link", location, client: client.trim() || event.title, billable }, remember);
    setSelection(null);
  }

  return (
    <section className={panel} aria-label={`Afspraak ${event.title}`}>
      <div>
        <h3 className="font-semibold text-gray-900">{event.title}</h3>
        <p className="text-sm text-gray-600">
          {when}
          {event.location && <> · in je agenda: {event.location}</>}
        </p>
      </div>

      {!editing && status.kind === "linked" && (
        <>
          <p className="text-sm text-gray-700">
            <span className="font-medium">{status.location.shortName}</span> · {status.client}
            {status.billable && <span className="ml-1.5 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Factureerbaar</span>}
            <span className="text-gray-500"> · {SOURCE[status.source]}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btn} onClick={() => setEditing(true)}>Andere locatie</button>
            <button type="button" className={btn} onClick={() => decideEvent(event, { kind: "skip" })}>Geen rit</button>
            {hasDecision && <button type="button" className={btn} onClick={() => decideEvent(event, null)}>Terugzetten</button>}
          </div>
        </>
      )}

      {!editing && status.kind === "skip" && (
        <>
          <p className="text-sm text-gray-700">
            {status.reason === "online" ? "Online afspraak: telt niet mee." : status.reason === "hele dag" ? "Hele-dag-afspraak zonder locatie: telt niet mee." : "Je hebt aangegeven dat dit geen rit is."}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btn} onClick={() => setEditing(true)}>Toch een rit</button>
            {status.reason === "handmatig" && <button type="button" className={btn} onClick={() => decideEvent(event, null)}>Terugzetten</button>}
          </div>
        </>
      )}

      {editing && (
        <div className="space-y-3">
          <LocationInput label="Waar was dit?" value={location} onChange={setLocation} homeAddress={homeAddress} />
          <RecentChips locations={recentLocations} onPick={setLocation} />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor={`client-${event.id}`} className="block text-sm font-medium text-gray-700 mb-1">Klant / project</label>
              <input id={`client-${event.id}`} className={input} value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
              Factureerbaar
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Onthouden voor afspraken met &ldquo;{event.title}&rdquo;
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={primary} disabled={!location} onClick={link}>Koppelen</button>
            <button type="button" className={btn} onClick={() => { decideEvent(event, { kind: "skip" }); setSelection(null); }}>Geen rit</button>
            {status.kind !== "todo" && <button type="button" className={btn} onClick={() => setEditing(false)}>Annuleren</button>}
          </div>
          {location && settings.office && location.shortName === settings.office.shortName && billable && (
            <p className="text-xs text-gray-500">Tip: ritten naar kantoor zijn meestal niet factureerbaar.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- rit ----------

export function LegPanel({ imp, leg }: { imp: AgendaImport; leg: Leg }) {
  const { setLegOverride, manualStops, removeManualStop } = imp;
  const manualStop: ManualStop | undefined = leg.manual
    ? manualStops.find((m) => m.date === leg.date && m.location.shortName === leg.to.shortName)
    : undefined;
  const overridden = leg.km !== null && leg.routeKm !== null && leg.km !== leg.routeKm;

  return (
    <section className={panel} aria-label={`Rit ${leg.from.shortName} naar ${leg.to.shortName}`}>
      <div>
        <h3 className="font-semibold text-gray-900">{leg.from.shortName} → {leg.to.shortName}</h3>
        <p className="text-sm text-gray-600">
          {formatDateNL(leg.date)} · rond {fromMin(leg.departMin)}–{fromMin(leg.arriveMin)} · {leg.purpose} · {leg.client}
          {leg.manual && " · zelf toegevoegd"}
        </p>
      </div>

      {leg.alreadyAdded ? (
        <p className="text-sm text-gray-700">Deze rit staat al in je overzicht en wordt niet nog eens toegevoegd.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor={`km-${leg.key}`} className="text-sm font-medium text-gray-700">Afstand</label>
            <KmField id={`km-${leg.key}`} value={leg.km ?? 0} onChange={(km) => setLegOverride(leg.key, { km })} />
            <span className="text-sm text-gray-600" aria-live="polite">
              {leg.routeStatus === "loading" && "Route berekenen…"}
              {leg.routeStatus === "error" && leg.km === null && "Route niet gevonden. Vul de afstand zelf in."}
              {overridden && (
                <>
                  Route: {formatKm(leg.routeKm!)} km.{" "}
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => setLegOverride(leg.key, { km: undefined })}>
                    Route gebruiken
                  </button>
                </>
              )}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btn} onClick={() => setLegOverride(leg.key, { disabled: !leg.disabled })}>
              {leg.disabled ? "Toch declareren" : "Niet declareren"}
            </button>
            {manualStop && (
              <button type="button" className={btn} onClick={() => removeManualStop(manualStop.id)}>Tussenstop verwijderen</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- reisblok toevoegen ----------

export function AddStopPanel({ imp, date }: { imp: AgendaImport; date: string }) {
  const { addManualStop, homeAddress, recentLocations, settings, setSelection } = imp;
  const [location, setLocation] = useState<Location | null>(null);
  const [time, setTime] = useState("08:00");
  const [purpose, setPurpose] = useState("");
  const [client, setClient] = useState(settings.companyName);
  const [billable, setBillable] = useState(false);

  return (
    <section className={panel} aria-label="Reisblok toevoegen">
      <div>
        <h3 className="font-semibold text-gray-900">Reisblok toevoegen · {formatDateNL(date)}</h3>
        <p className="text-sm text-gray-600">
          Voor een rit die niet in je agenda staat, zoals tanken, materiaal ophalen of een collega oppikken. De app zet hem op
          het juiste moment in je dagroute en past de ritten ervoor en erna aan.
        </p>
      </div>
      <LocationInput label="Waar ging je naartoe?" value={location} onChange={setLocation} homeAddress={homeAddress} />
      <RecentChips locations={recentLocations} onPick={setLocation} />
      <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_1fr] gap-3">
        <div>
          <label htmlFor="stop-time" className="block text-sm font-medium text-gray-700 mb-1">Aankomst rond</label>
          <input id="stop-time" type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label htmlFor="stop-purpose" className="block text-sm font-medium text-gray-700 mb-1">Waarvoor?</label>
          <input id="stop-purpose" className={input} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Materiaal ophalen" />
        </div>
        <div>
          <label htmlFor="stop-client" className="block text-sm font-medium text-gray-700 mb-1">Klant / project</label>
          <input id="stop-client" className={input} value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
        Factureerbaar
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={primary}
          disabled={!location || !time}
          onClick={() =>
            location &&
            addManualStop({ date, time, location, purpose: purpose.trim() || "Tussenstop", client: client.trim() || "—", billable })
          }
        >
          Toevoegen
        </button>
        <button type="button" className={btn} onClick={() => setSelection(null)}>Annuleren</button>
      </div>
    </section>
  );
}
