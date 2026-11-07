"use client";

import { eventSpan, fromMin, toMin, type DayMode, type Leg, type ManualStop, type Place, type PlannedEvent, type Transport } from "@/lib/dayPlan";
import { formatKm } from "@/lib/format";
import type { Selection } from "./useAgendaImport";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function dayParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { weekday: WEEKDAYS[dow], day: d, month: MONTHS[m - 1] };
}

const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

type Props = {
  date: string;
  planned: PlannedEvent[];
  legs: Leg[];
  manualStops: ManualStop[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  mode: DayMode;
  onMode: (patch: { place?: Place; transport?: Transport }) => void;
};

const ICON: Record<string, string> = {
  thuis: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  kantoor: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  pad: "M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
  auto: "M5 17h14M6 17l1.5-6h9L18 17M8 17v2m8-2v2M7.5 11l1-3h7l1 3",
  ov: "M8 17l-2 4m10-4l2 4M7 3h10a2 2 0 012 2v8a4 4 0 01-4 4H9a4 4 0 01-4-4V5a2 2 0 012-2zm-2 8h14M9 14h.01M15 14h.01",
};
const PLACE_TEXT: Record<Place, string> = { thuis: "Thuis", kantoor: "Kantoor", pad: "Op pad" };

/** Een rij icoonknoppen; de naam staat in aria-label en als tooltip. */
function IconGroup<T extends string>({ label, options, value, onPick }: {
  label: string; options: { value: T; text: string }[]; value: T | null; onPick: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-gray-300 overflow-hidden">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o.text}
          title={o.text}
          onClick={() => onPick(o.value)}
          className={`p-1.5 ${i > 0 ? "border-l border-gray-300" : ""} ${
            value === o.value ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
          } ${focus}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON[o.value]} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Twee keuzes per dag: waar werkte je, en hoe reisde je. */
function DayModeControls({ mode, onMode, dayName }: { mode: DayMode; onMode: Props["onMode"]; dayName: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <IconGroup<Place>
          label={`Waar werkte je op ${dayName}`}
          value={mode.place}
          onPick={(place) => onMode({ place })}
          options={[{ value: "thuis", text: "Thuis" }, { value: "kantoor", text: "Kantoor" }, { value: "pad", text: "Op pad" }]}
        />
        <IconGroup<Transport>
          label={`Hoe reisde je op ${dayName}`}
          value={mode.transport}
          onPick={(transport) => onMode({ transport })}
          options={[{ value: "auto", text: "Auto" }, { value: "ov", text: "OV" }]}
        />
      </div>
      <p className="text-xs text-gray-700 px-0.5">
        {mode.place ? PLACE_TEXT[mode.place] : "Waar werkte je?"} · {mode.transport === "ov" ? "OV" : "auto"}
      </p>
    </div>
  );
}

type Entry =
  | { kind: "event"; at: number; item: PlannedEvent }
  | { kind: "leg"; at: number; leg: Leg }
  | { kind: "stop"; at: number; stop: ManualStop; leg?: Leg };

export default function DayCard({ date, planned, legs, manualStops, selection, onSelect, mode, onMode }: Props) {
  const { weekday, day, month } = dayParts(date);
  const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);
  // Onbekende dag = één vraag ("hoe zag deze dag eruit?"); op pad tellen afspraken zonder plek
  const dayUnknown = mode.place === null && mode.transport === "auto";
  const open = dayUnknown ? 1 : planned.filter((p) => p.status.kind === "todo").length;
  const dayName = `${weekday} ${day}`;
  const allDay = planned.filter((p) => !p.event.startTime);

  const entries: Entry[] = [
    ...planned.filter((p) => p.event.startTime).map((item) => ({ kind: "event" as const, at: eventSpan(item.event).start + 0.5, item })),
    ...legs.filter((l) => !l.manual).map((leg) => ({ kind: "leg" as const, at: leg.departMin, leg })),
    ...manualStops.map((stop) => ({
      kind: "stop" as const,
      at: toMin(stop.time),
      stop,
      leg: legs.find((l) => l.manual && l.to.shortName === stop.location.shortName),
    })),
  ].sort((a, b) => a.at - b.at);

  const status =
    open > 0 ? (
      <span className="text-xs font-medium text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 whitespace-nowrap">{open === 1 ? "1 vraag" : `${open} vragen`}</span>
    ) : planned.length > 0 || manualStops.length > 0 ? (
      <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label="klaar">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : null;

  function legRow(leg: Leg, extraLabel?: string) {
    const sel: Selection = { type: "leg", key: leg.key };
    const km = leg.km !== null ? `${formatKm(leg.km)} km` : leg.routeStatus === "loading" ? "berekenen…" : "afstand?";
    const note = leg.alreadyAdded ? " · al in declaratie" : leg.disabled ? " · telt niet mee" : "";
    const tone = leg.alreadyAdded || leg.disabled
      ? "text-gray-500"
      : leg.km === null && leg.routeStatus === "error"
      ? "text-orange-700 font-medium"
      : "text-gray-700";
    return (
      <button
        key={leg.key}
        type="button"
        onClick={() => onSelect(sel)}
        aria-pressed={isSel(sel)}
        title={`${leg.from.shortName} → ${leg.to.shortName}`}
        className={`group w-full flex items-center gap-1.5 pl-3 py-1 text-xs rounded hover:bg-gray-50 ${tone} ${isSel(sel) ? "bg-blue-50 ring-1 ring-blue-400" : ""} ${focus}`}
      >
        <span className="w-px h-4 bg-gray-300" aria-hidden="true" />
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17h14M6 17l1.5-6h9L18 17M8 17v2m8-2v2M7.5 11l1-3h7l1 3" />
        </svg>
        <span className="sr-only">Rit </span>
        <span className={leg.disabled ? "line-through" : ""}>{km}</span>
        <span>{note}</span>
        <span className="sr-only"> {leg.from.shortName.split(",")[0]} → {leg.to.shortName.split(",")[0]}{extraLabel ?? ""}</span>
      </button>
    );
  }

  const addButton = (
    <button
      type="button"
      onClick={() => onSelect({ type: "add", date })}
      className={`text-xs text-blue-700 hover:bg-blue-50 rounded px-1 py-0.5 whitespace-nowrap ${focus}`}
    >
      + Tussenstop<span className="sr-only"> toevoegen op {weekday} {day}</span>
    </button>
  );

  if (entries.length === 0 && allDay.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-2.5 min-w-0 space-y-2" aria-label={`${weekday} ${day} ${month}`}>
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-sm text-gray-700 whitespace-nowrap">
            {weekday} <span className="font-semibold text-gray-900">{day}</span>
          </h3>
          <span className="text-xs text-gray-500">geen afspraken</span>
        </div>
        <DayModeControls mode={mode} onMode={onMode} dayName={dayName} />
        <div>{addButton}</div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-2.5 min-w-0" aria-label={`${weekday} ${day} ${month}`}>
      <header className="flex items-center justify-between gap-2 px-1 mb-2">
        <h3 className="text-sm text-gray-700 whitespace-nowrap">
          {weekday} <span className="font-semibold text-gray-900">{day}</span>
          <span className="sr-only"> {month}</span>
        </h3>
        {status}
      </header>
      <div className="mb-2">
        <DayModeControls mode={mode} onMode={onMode} dayName={dayName} />
      </div>
      {mode.transport === "ov" && <p className="text-xs text-gray-600 px-1 mb-1">Met het OV: geen ritten deze dag.</p>}

      <div className="space-y-0.5">
        {allDay.map((p) => (
          <button
            key={p.event.id}
            type="button"
            onClick={() => onSelect({ type: "event", id: p.event.id })}
            className={`w-full text-left text-xs rounded px-2 py-1 truncate border ${p.status.kind === "todo" ? "bg-amber-50 border-amber-400 text-amber-900" : "border-dashed border-gray-300 text-gray-600"} ${focus}`}
          >
            {p.event.title} <span className="text-gray-500">· hele dag</span>
          </button>
        ))}

        {entries.map((e) => {
          if (e.kind === "leg") return legRow(e.leg);
          if (e.kind === "stop") {
            return (
              <div key={e.stop.id}>
                {e.leg && legRow(e.leg, ` (tussenstop)`)}
                <button
                  type="button"
                  onClick={() => e.leg && onSelect({ type: "leg", key: e.leg.key })}
                  className={`w-full text-left rounded-lg border border-dashed border-blue-400 px-2 py-1.5 text-xs text-blue-900 ${focus}`}
                >
                  <span className="sr-only">Tussenstop </span>
                  <span className="font-medium">{e.stop.time} {e.stop.purpose}</span>{" "}
                  <span className="block truncate text-blue-800">{e.stop.location.shortName}</span>
                </button>
              </div>
            );
          }
          const { event, status: st } = e.item;
          const sel: Selection = { type: "event", id: event.id };
          const span = eventSpan(event);
          const sub =
            st.kind === "linked" ? st.location.shortName.split(",")[0]
            : st.kind === "todo" ? "Waar was dit?"
            : st.reason === "online" ? "Online"
            : st.reason === "ov" ? "OV"
            : st.reason === "thuis" ? "Thuis"
            : "Geen rit";
          const tone =
            st.kind === "linked" ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : st.kind === "todo" ? "bg-amber-50 border-amber-400 text-amber-950"
            : "bg-white border-dashed border-gray-300 text-gray-600";
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(sel)}
              aria-pressed={isSel(sel)}
              title={st.kind === "linked" ? `${event.title} · ${st.location.shortName}` : event.title}
              className={`w-full text-left rounded-lg border px-2 py-1.5 text-xs ${tone} ${isSel(sel) ? "ring-2 ring-blue-500" : ""} ${focus}`}
            >
              <span className="font-medium">{fromMin(span.start)} {event.title}</span>{" "}
              <span className="block truncate">{sub}</span>
            </button>
          );
        })}

      </div>

      <div className="mt-2">{addButton}</div>
    </section>
  );
}
