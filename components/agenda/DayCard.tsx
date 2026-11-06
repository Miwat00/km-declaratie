"use client";

import { eventSpan, fromMin, toMin, type Leg, type ManualStop, type PlannedEvent } from "@/lib/dayPlan";
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
};

type Entry =
  | { kind: "event"; at: number; item: PlannedEvent }
  | { kind: "leg"; at: number; leg: Leg }
  | { kind: "stop"; at: number; stop: ManualStop; leg?: Leg };

/** Eén dag: afspraken als kaartjes, ritten als dunne regel met de afstand ertussen. */
export default function DayCard({ date, planned, legs, manualStops, selection, onSelect }: Props) {
  const { weekday, day, month } = dayParts(date);
  const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);
  const open = planned.filter((p) => p.status.kind === "todo").length;
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
      <section className="bg-white rounded-xl border border-gray-200 px-3.5 py-2 min-w-0 flex items-center gap-2 flex-wrap" aria-label={`${weekday} ${day} ${month}`}>
        <h3 className="text-sm text-gray-700 whitespace-nowrap">
          {weekday} <span className="font-semibold text-gray-900">{day}</span>
        </h3>
        <span className="text-xs text-gray-500">geen afspraken</span>
        <span className="ml-auto">{addButton}</span>
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
            : st.reason === "online" ? "Online" : "Geen rit";
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
