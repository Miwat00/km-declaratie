"use client";

import { useState } from "react";
import LocationInput from "@/components/LocationInput";
import KmField from "./KmField";
import { longDate } from "./QuestionCard";
import { defaultsFor, eventSpan, fromMin, sameLocation as samePlace, type Leg, type ManualStop, type PlannedEvent } from "@/lib/dayPlan";
import { formatKm } from "@/lib/format";
import type { Location } from "@/lib/types";
import type { AgendaImport } from "./useAgendaImport";

const btn = "px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white hover:bg-gray-50";
const primary = "px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const SOURCE: Record<string, string> = {
  koppeling: "onthouden",
  kantoor: "je kantoor",
  agenda: "adres uit je agenda",
  handmatig: "zelf gekozen",
};

function QuickChips({ locations, onPick }: { locations: Location[]; onPick: (l: Location) => void }) {
  if (locations.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-600">Vaker gebruikt:</span>
      {locations.map((l) => (
        <button key={l.shortName} type="button" onClick={() => onPick(l)} className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-800 hover:bg-blue-50 hover:border-blue-300">
          {l.shortName}
        </button>
      ))}
    </div>
  );
}

/** Klant en factureerbaar: meestal goed geraden, dus weggestopt achter "Meer opties". */
function MoreOptions({ id, client, setClient, billable, setBillable }: {
  id: string; client: string; setClient: (v: string) => void; billable: boolean; setBillable: (v: boolean) => void;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-700">
        Meer opties <span className="text-gray-500">· {client || "—"} · {billable ? "factureerbaar" : "intern"}</span>
      </summary>
      <div className="mt-2 grid gap-2">
        <div>
          <label htmlFor={`client-${id}`} className="block text-sm text-gray-700 mb-1">Klant of project</label>
          <input id={`client-${id}`} className={input} value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-gray-700">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          Door te belasten aan de klant (factureerbaar)
        </label>
      </div>
    </details>
  );
}

// ---------- afspraak ----------

export function EventPanel({ imp, item }: { imp: AgendaImport; item: PlannedEvent }) {
  const { event, status } = item;
  const { decideEvent, homeAddress, frequentLocations, settings, setSelection } = imp;
  const [editing, setEditing] = useState(status.kind === "todo");
  const [location, setLocation] = useState<Location | null>(status.kind === "linked" ? status.location : null);
  const [client, setClient] = useState(status.kind === "linked" ? status.client : event.title);
  const [billable, setBillable] = useState(status.kind === "linked" ? status.billable : true);
  const [optionsTouched, setOptionsTouched] = useState(false);
  const [remember, setRemember] = useState(false);
  const span = eventSpan(event);
  const when = `${longDate(event.date)} · ${event.startTime ? `${fromMin(span.start)}–${fromMin(span.end)}` : "hele dag"}`;

  function pick(l: Location | null) {
    setLocation(l);
    // Klant en factureerbaar meeschuiven met de locatie, tot je ze zelf aanpast
    if (l && !optionsTouched) {
      const d = defaultsFor(event.title, l, settings);
      setClient(d.client);
      setBillable(d.billable);
    }
  }

  function save() {
    if (!location) return;
    decideEvent(event, { kind: "link", location, client: client.trim() || event.title, billable }, remember);
    setSelection(null);
  }

  return (
    <section className="space-y-3" aria-label={`Afspraak ${event.title}`}>
      <div>
        <h3 className="font-semibold text-gray-900">{event.title}</h3>
        <p className="text-sm text-gray-600">
          {when}
          {event.location && <> · in je agenda: {event.location}</>}
        </p>
      </div>

      {!editing && status.kind === "linked" && (
        <>
          <p className="text-sm text-gray-800">
            <span className="font-medium">{status.location.shortName}</span>
            <span className="text-gray-600"> · {SOURCE[status.source]} · {status.billable ? "factureerbaar" : "intern"}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btn} onClick={() => setEditing(true)}>Andere plek</button>
            <button type="button" className={btn} onClick={() => { decideEvent(event, { kind: "skip" }); setSelection(null); }}>Geen rit</button>
          </div>
        </>
      )}

      {!editing && status.kind === "skip" && (
        <>
          <p className="text-sm text-gray-800">
            {status.reason === "online" ? "Online afspraak, dus geen rit."
              : status.reason === "hele dag" ? "Hele-dag-afspraak zonder plek, dus geen rit."
              : status.reason === "onthouden" ? "Je hebt eerder gezegd: voortaan geen rit voor deze afspraak."
              : status.reason === "ov" ? "Deze dag reisde je met het OV, dus geen rit. Zet de dag op Auto als je toch met de auto ging."
              : status.reason === "thuis" ? "Deze dag werkte je thuis, dus geen rit."
              : "Je hebt aangegeven dat dit geen rit is."}
          </p>
          {status.reason !== "ov" && (
            <button type="button" className={btn} onClick={() => setEditing(true)}>Toch een rit</button>
          )}
        </>
      )}

      {editing && (
        <div className="space-y-3">
          <LocationInput label="Waar was dit?" value={location} onChange={pick} homeAddress={homeAddress} />
          <QuickChips locations={frequentLocations} onPick={pick} />
          <MoreOptions
            id={event.id}
            client={client}
            setClient={(v) => { setClient(v); setOptionsTouched(true); }}
            billable={billable}
            setBillable={(v) => { setBillable(v); setOptionsTouched(true); }}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Voortaan automatisch voor &ldquo;{event.title}&rdquo;
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={primary} disabled={!location} onClick={save}>Opslaan</button>
            <button type="button" className={btn} onClick={() => { decideEvent(event, { kind: "skip" }, remember); setSelection(null); }}>Geen rit</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- rit ----------

/** Eerste en laatste rit van de dag: standaard vanaf en naar huis, maar je kunt een ander adres kiezen. */
function DayEndpoint({ imp, leg, kind }: { imp: AgendaImport; leg: Leg; kind: "start" | "end" }) {
  const { homeAddress, frequentLocations, setDayEnd, setDayStart, settings } = imp;
  const [changing, setChanging] = useState(false);
  const isStart = kind === "start";
  const point = isStart ? leg.from : leg.to;
  const other = isStart ? leg.to : leg.from;
  const set = (loc: Location | null) => (isStart ? setDayStart : setDayEnd)(leg.date, loc);
  const atHome = !!homeAddress && samePlace(point, homeAddress);
  const choices = [settings.office, ...frequentLocations].filter(
    (l): l is Location => !!l && !samePlace(l, point) && !samePlace(l, other) && !(homeAddress && samePlace(l, homeAddress))
  );
  const label = isStart ? "Vertrek vanaf" : "Terug naar";

  return (
    <div className="rounded-lg bg-gray-50 p-3 space-y-2">
      <p className="text-sm text-gray-800">
        {label}: <span className="font-medium">{atHome ? "Thuis" : point.shortName}</span>
      </p>
      {!changing ? (
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={btn} onClick={() => setChanging(true)}>Ander adres</button>
          {!atHome && homeAddress && (
            <button type="button" className={btn} onClick={() => set(null)}>{isStart ? "Vanaf huis" : "Terug naar huis"}</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <LocationInput label={label} value={null} onChange={(loc) => loc && set(loc)} homeAddress={homeAddress} />
          <QuickChips locations={choices.slice(0, 3)} onPick={set} />
          <button type="button" className="text-sm text-gray-700 hover:underline" onClick={() => setChanging(false)}>Annuleren</button>
        </div>
      )}
    </div>
  );
}

export function LegPanel({ imp, leg }: { imp: AgendaImport; leg: Leg }) {
  const { setLegOverride, manualStops, removeManualStop } = imp;
  const manualStop: ManualStop | undefined = leg.manual
    ? manualStops.find((m) => m.date === leg.date && m.location.shortName === leg.to.shortName)
    : undefined;
  const overridden = leg.km !== null && leg.routeKm !== null && leg.km !== leg.routeKm;

  return (
    <section className="space-y-3" aria-label={`Rit ${leg.from.shortName} naar ${leg.to.shortName}`}>
      <div>
        <h3 className="font-semibold text-gray-900">{leg.from.shortName} → {leg.to.shortName}</h3>
        <p className="text-sm text-gray-600">
          {longDate(leg.date)} · rond {fromMin(leg.departMin)} · voor {leg.purpose}
        </p>
      </div>

      {leg.isFirst && !leg.alreadyAdded && <DayEndpoint imp={imp} leg={leg} kind="start" />}
      {leg.isReturn && !leg.alreadyAdded && <DayEndpoint imp={imp} leg={leg} kind="end" />}

      {leg.alreadyAdded ? (
        <p className="text-sm text-gray-800">Deze rit staat al in je declaratie en wordt niet nog eens toegevoegd.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor={`km-${leg.key}`} className="text-sm font-medium text-gray-800">Afstand</label>
            <KmField id={`km-${leg.key}`} value={leg.km ?? 0} onChange={(km) => setLegOverride(leg.key, { km })} />
          </div>
          <p className="text-sm text-gray-600" aria-live="polite">
            {leg.routeStatus === "loading" && "Afstand berekenen…"}
            {leg.routeStatus === "error" && leg.km === null && "De afstand kon niet berekend worden. Vul hem zelf in."}
            {leg.routeStatus === "ok" && !overridden && "Berekend via de kortste route. Reed je anders, pas het dan aan."}
            {overridden && (
              <>
                Route: {formatKm(leg.routeKm!)} km.{" "}
                <button type="button" className="text-blue-700 hover:underline" onClick={() => setLegOverride(leg.key, { km: undefined })}>
                  Terug naar route
                </button>
              </>
            )}
          </p>
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

// ---------- tussenstop toevoegen ----------

export function AddStopPanel({ imp, date }: { imp: AgendaImport; date: string }) {
  const { addManualStop, homeAddress, frequentLocations, settings } = imp;
  const [location, setLocation] = useState<Location | null>(null);
  const [time, setTime] = useState("08:00");
  const [purpose, setPurpose] = useState("");
  const [client, setClient] = useState(settings.companyName);
  const [billable, setBillable] = useState(false);

  return (
    <section className="space-y-3" aria-label="Tussenstop toevoegen">
      <div>
        <h3 className="font-semibold text-gray-900">Tussenstop op {longDate(date).toLowerCase()}</h3>
        <p className="text-sm text-gray-600">
          Voor een rit die niet in je agenda staat, zoals tanken of materiaal ophalen. De route van die dag past zich aan.
        </p>
      </div>
      <LocationInput label="Waar ging je naartoe?" value={location} onChange={setLocation} homeAddress={homeAddress} />
      <QuickChips locations={frequentLocations} onPick={setLocation} />
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <div>
          <label htmlFor="stop-time" className="block text-sm text-gray-700 mb-1">Rond</label>
          <input id="stop-time" type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label htmlFor="stop-purpose" className="block text-sm text-gray-700 mb-1">Waarvoor?</label>
          <input id="stop-purpose" className={input} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Materiaal ophalen" />
        </div>
      </div>
      <MoreOptions id={`stop-${date}`} client={client} setClient={setClient} billable={billable} setBillable={setBillable} />
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
    </section>
  );
}
