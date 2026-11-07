"use client";

import { useState } from "react";
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

type Entry =
  | { kind: "event"; at: number; item: PlannedEvent }
  | { kind: "leg"; at: number; leg: Leg }
  | { kind: "stop"; at: number; stop: ManualStop; leg?: Leg };

/** Afspraken zonder eigen rit: online, geen rit, of gewoon op kantoor. Die bundelen we. */
const isQuiet = (p: PlannedEvent) => p.status.kind === "skip" || (p.status.kind === "linked" && p.status.source === "kantoor");

type Block = Entry | { kind: "cluster"; at: number; items: PlannedEvent[] };

function Segmented<T extends string>({ label, options, value, onPick }: {
  label: string; options: { value: T; text: string }[]; value: T | null; onPick: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-full rounded-lg border border-gray-300 overflow-hidden text-xs">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
          className={`flex-1 min-w-0 px-1 py-1 whitespace-nowrap ${i > 0 ? "border-l border-gray-300" : ""} ${
            value === o.value ? "bg-blue-600 text-white" : "bg-white text-gray-800 hover:bg-gray-50"
          } ${focus}`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function subText(p: PlannedEvent): string {
  const st = p.status;
  if (st.kind === "linked") return st.location.shortName.split(",")[0];
  if (st.kind === "todo") return "Waar was dit?";
  return { online: "Online", ov: "OV", thuis: "Thuis", "hele dag": "Hele dag" }[st.reason as string] ?? "Geen rit";
}

/** Eén werkdag: de twee dagkeuzes, ritten met hun afstand, en afspraken zonder eigen rit gebundeld. */
export default function DayCard({ date, planned, legs, manualStops, selection, onSelect, mode, onMode }: Props) {
  const { weekday, day, month } = dayParts(date);
  const dayName = `${weekday} ${day}`;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showQuiet, setShowQuiet] = useState(false);
  const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);
  const toggle = (i: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const dayUnknown = mode.place === null && mode.transport === "auto";
  const open = dayUnknown ? 1 : planned.filter((p) => p.status.kind === "todo").length;
  const dayKm = legs.filter((l) => !l.disabled && !l.alreadyAdded && l.km !== null).reduce((s, l) => s + (l.km ?? 0), 0);
  const quietDay = !dayUnknown && legs.length === 0 && manualStops.length === 0 && open === 0;

  // Tijdlijn van de dag, met opeenvolgende "stille" afspraken samengevoegd
  const entries: Entry[] = [
    ...planned.map((item) => ({ kind: "event" as const, at: item.event.startTime ? eventSpan(item.event).start + 0.5 : -1, item })),
    ...legs.filter((l) => !l.manual).map((leg) => ({ kind: "leg" as const, at: leg.departMin, leg })),
    ...manualStops.map((stop) => ({ kind: "stop" as const, at: toMin(stop.time), stop, leg: legs.find((l) => l.manual && l.to.shortName === stop.location.shortName) })),
  ].sort((a, b) => a.at - b.at);
  const blocks: Block[] = [];
  for (const e of entries) {
    const last = blocks.at(-1);
    if (e.kind === "event" && isQuiet(e.item)) {
      if (last && last.kind === "cluster") last.items.push(e.item);
      else blocks.push({ kind: "cluster", at: e.at, items: [e.item] });
    } else {
      blocks.push(e);
    }
  }

  const status =
    open > 0 ? (
      <span className="text-xs font-medium text-amber-900 bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap">{open === 1 ? "1 vraag" : `${open} vragen`}</span>
    ) : dayKm > 0 ? (
      <span className="text-xs text-gray-900 tabular-nums whitespace-nowrap">{formatKm(dayKm)} km</span>
    ) : planned.length > 0 || manualStops.length > 0 ? (
      <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label="klaar">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : null;

  function legRow(leg: Leg, extraLabel?: string) {
    const sel: Selection = { type: "leg", key: leg.key };
    const km = leg.km !== null ? `${formatKm(leg.km)} km` : leg.routeStatus === "loading" ? "berekenen…" : "afstand?";
    const note = leg.alreadyAdded ? " · al in declaratie" : leg.disabled ? " · telt niet mee" : "";
    const tone = leg.alreadyAdded || leg.disabled ? "text-gray-500" : leg.km === null && leg.routeStatus === "error" ? "text-orange-700 font-medium" : "text-gray-700";
    return (
      <button
        key={leg.key}
        type="button"
        onClick={() => onSelect(sel)}
        aria-pressed={isSel(sel)}
        title={`${leg.from.shortName} → ${leg.to.shortName}`}
        className={`w-full flex items-center gap-1.5 pl-2 py-0.5 text-xs rounded hover:bg-gray-50 ${tone} ${isSel(sel) ? "bg-blue-50 ring-1 ring-blue-400" : ""} ${focus}`}
      >
        <span className="w-px h-3.5 bg-gray-300" aria-hidden="true" />
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17h14M6 17l1.5-6h9L18 17M8 17v2m8-2v2M7.5 11l1-3h7l1 3" />
        </svg>
        <span className="sr-only">Rit </span>
        <span className={`tabular-nums ${leg.disabled ? "line-through" : ""}`}>{km}</span>
        <span className="truncate">{note}</span>
        <span className="sr-only"> {leg.from.shortName.split(",")[0]} → {leg.to.shortName.split(",")[0]}{extraLabel ?? ""}</span>
      </button>
    );
  }

  function eventRow(p: PlannedEvent, compact = false) {
    const { event, status: st } = p;
    const sel: Selection = { type: "event", id: event.id };
    const tone =
      compact ? "text-gray-700 hover:bg-gray-50"
      : st.kind === "linked" ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
      : st.kind === "todo" ? "bg-amber-50 border border-amber-400 text-amber-950"
      : "border border-dashed border-gray-300 text-gray-700";
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => onSelect(sel)}
        aria-pressed={isSel(sel)}
        title={`${event.title} · ${subText(p)}`}
        className={`w-full text-left rounded-lg px-2 py-1 text-xs ${tone} ${isSel(sel) ? "ring-2 ring-blue-500" : ""} ${focus}`}
      >
        <span className="block truncate font-medium">{event.startTime ? `${fromMin(eventSpan(event).start)} ` : ""}{event.title}</span>{" "}
        <span className="block truncate">{subText(p)}</span>
      </button>
    );
  }

  function clusterBlock(items: PlannedEvent[], i: number) {
    if (items.length === 1) return eventRow(items[0]);
    const office = items.some((p) => p.status.kind === "linked");
    const timed = items.filter((p) => p.event.startTime);
    const from = timed.length ? fromMin(Math.min(...timed.map((p) => eventSpan(p.event).start))) : "";
    const to = timed.length ? fromMin(Math.max(...timed.map((p) => eventSpan(p.event).end))) : "";
    const online = items.filter((p) => p.status.kind === "skip" && p.status.reason === "online").length;
    const title = office ? `Kantoor ${from}–${to}` : `${items.length} afspraken`;
    const sub = office
      ? `${items.length} afspraken${online ? `, ${online} online` : ""}`
      : online === items.length ? "online, geen rit" : "geen rit";
    const isOpen = expanded.has(i);
    return (
      <div key={`c${i}`} className={`rounded-lg text-xs ${office ? "bg-emerald-50 border border-emerald-200 text-emerald-950" : "border border-dashed border-gray-300 text-gray-700"}`}>
        <button type="button" onClick={() => toggle(i)} aria-expanded={isOpen} className={`w-full text-left px-2 py-1 flex items-center gap-1 ${focus}`}>
          <span className="flex-1 min-w-0">
            <span className="block font-medium truncate">{title}</span>{" "}
            <span className="block truncate">{sub}</span>
          </span>
          <Chevron open={isOpen} />
        </button>
        {isOpen && <div className="bg-white rounded-b-lg border-t border-gray-200 p-1 space-y-0.5">{items.map((p) => eventRow(p, true))}</div>}
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-2.5 min-w-0 space-y-2" aria-label={`${weekday} ${day} ${month}`}>
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-sm text-gray-700 whitespace-nowrap">
          {weekday} <span className="font-semibold text-gray-900">{day}</span>
          <span className="sr-only"> {month}</span>
        </h3>
        {status}
      </header>

      <div className="space-y-1">
        <Segmented<Place>
          label={`Waar werkte je op ${dayName}`}
          value={mode.place}
          onPick={(place) => onMode({ place })}
          options={[{ value: "thuis", text: "Thuis" }, { value: "kantoor", text: "Kantoor" }, { value: "pad", text: "Op pad" }]}
        />
        <Segmented<Transport>
          label={`Hoe reisde je op ${dayName}`}
          value={mode.transport}
          onPick={(transport) => onMode({ transport })}
          options={[{ value: "auto", text: "Auto" }, { value: "ov", text: "OV" }]}
        />
      </div>

      {planned.length === 0 && entries.length === 0 ? (
        <p className="text-xs text-gray-600 px-0.5">Geen afspraken</p>
      ) : quietDay ? (
        <div className="rounded-lg border border-dashed border-gray-300 text-xs text-gray-700">
          <button type="button" onClick={() => setShowQuiet(!showQuiet)} aria-expanded={showQuiet} className={`w-full text-left px-2 py-1 flex items-center gap-1 ${focus}`}>
            <span className="flex-1 min-w-0">
              <span className="block font-medium">
                {planned.length} {planned.length === 1 ? "afspraak" : "afspraken"}
              </span>{" "}
              <span className="block">{mode.transport === "ov" ? "met het OV" : "thuis"} · geen ritten</span>
            </span>
            <Chevron open={showQuiet} />
          </button>
          {showQuiet && <div className="bg-white rounded-b-lg border-t border-gray-200 p-1 space-y-0.5">{planned.map((p) => eventRow(p, true))}</div>}
        </div>
      ) : (
        <div className="space-y-1">
          {blocks.map((b, i) => {
            if (b.kind === "cluster") return clusterBlock(b.items, i);
            if (b.kind === "leg") return legRow(b.leg);
            if (b.kind === "event") return eventRow(b.item);
            return (
              <div key={b.stop.id} className="space-y-1">
                {b.leg && legRow(b.leg, " (tussenstop)")}
                <button
                  type="button"
                  onClick={() => b.leg && onSelect({ type: "leg", key: b.leg.key })}
                  className={`w-full text-left rounded-lg border border-dashed border-blue-400 px-2 py-1 text-xs text-blue-950 ${focus}`}
                >
                  <span className="sr-only">Tussenstop </span>
                  <span className="block truncate font-medium">{b.stop.time} {b.stop.purpose}</span>{" "}
                  <span className="block truncate">{b.stop.location.shortName.split(",")[0]}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={() => onSelect({ type: "add", date })} className={`text-xs text-blue-700 hover:bg-blue-50 rounded px-1 py-0.5 ${focus}`}>
        + Tussenstop<span className="sr-only"> toevoegen op {weekday} {day}</span>
      </button>
    </section>
  );
}

/** Pijltje voor in- en uitklappen; de tekst is er voor schermlezers. */
function Chevron({ open }: { open: boolean }) {
  return (
    <>
      <span className="sr-only">{open ? " verbergen" : " tonen"}</span>
      <svg className={`w-4 h-4 flex-shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </>
  );
}
