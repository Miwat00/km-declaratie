"use client";

import { eventSpan, fromMin, MANUAL_STOP_MIN, toMin, type Leg, type ManualStop, type PlannedEvent } from "@/lib/dayPlan";
import { formatKm } from "@/lib/format";
import type { Selection } from "./useAgendaImport";

const PX_PER_MIN = 0.8;
const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

type Item = {
  id: string;
  start: number;
  end: number;
  render: (height: number) => React.ReactNode;
  className: string;
  /** Tooltip met alle details */
  title: string;
  selected: boolean;
  onClick: () => void;
};
type Placed = Item & { lane: number; lanes: number };

/** Verdeelt overlappende blokken over naast elkaar liggende banen. */
function layoutLanes(items: Item[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: (Item & { lane: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = laneEnds.length;
    cluster.forEach((c) => out.push({ ...c, lanes }));
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.end;
    cluster.push({ ...it, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { weekday: WEEKDAYS[dow], day: d };
};

const statusClass: Record<string, string> = {
  linked: "bg-emerald-50 border-emerald-300 text-emerald-900",
  todo: "bg-amber-50 border-amber-400 text-amber-900",
  skip: "bg-white border-dashed border-gray-300 text-gray-600",
};

function legClass(leg: Leg) {
  if (leg.alreadyAdded) return "bg-gray-100 border-gray-300 text-gray-600";
  if (leg.disabled) return "bg-white border-dashed border-gray-300 text-gray-500 line-through";
  if (leg.km === null && leg.routeStatus === "error") return "bg-orange-50 border-orange-400 text-orange-900";
  return `bg-blue-50 border-blue-300 text-blue-900 ${leg.manual ? "border-dashed" : ""}`;
}

type Props = {
  days: string[];
  planned: PlannedEvent[];
  legs: Leg[];
  manualStops: ManualStop[];
  selection: Selection;
  onSelect: (s: Selection) => void;
};

export default function WeekGrid({ days, planned, legs, manualStops, selection, onSelect }: Props) {
  const timed = planned.filter((p) => p.event.startTime);
  const allDay = planned.filter((p) => !p.event.startTime);

  // Uren die in beeld moeten: minstens 7:00–19:00, ruimer als er eerder of later iets is
  const starts = [...timed.map((p) => eventSpan(p.event).start), ...legs.map((l) => l.departMin), ...manualStops.map((m) => toMin(m.time))];
  const ends = [...timed.map((p) => eventSpan(p.event).end), ...legs.map((l) => l.arriveMin)];
  const startH = Math.max(0, Math.min(7, Math.floor(Math.min(...starts, 7 * 60) / 60)));
  const endH = Math.min(24, Math.max(19, Math.ceil(Math.max(...ends, 19 * 60) / 60)));
  const top = (min: number) => (min - startH * 60) * PX_PER_MIN;
  const height = (endH - startH) * 60 * PX_PER_MIN;

  const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);

  function itemsFor(date: string): Item[] {
    const items: Item[] = [];
    for (const p of timed) {
      if (p.event.date !== date) continue;
      const { start, end } = eventSpan(p.event);
      const sel: Selection = { type: "event", id: p.event.id };
      const sub =
        p.status.kind === "linked" ? p.status.location.shortName
        : p.status.kind === "todo" ? "Locatie nodig"
        : p.status.reason === "online" ? "Online · geen rit" : "Geen rit";
      items.push({
        id: `e-${p.event.id}`, start, end,
        className: statusClass[p.status.kind],
        title: `${p.event.title}, ${fromMin(start)}–${fromMin(end)}: ${sub}`,
        selected: isSel(sel),
        onClick: () => onSelect(sel),
        render: (h) => (
          <>
            <span className="block font-medium truncate">{p.event.title}</span>
            {h > 30 ? (
              <span className="block truncate">{fromMin(start)} · {sub}</span>
            ) : (
              <span className="sr-only"> {fromMin(start)} · {sub}</span>
            )}
          </>
        ),
      });
    }
    for (const leg of legs) {
      if (leg.date !== date) continue;
      const sel: Selection = { type: "leg", key: leg.key };
      const kmText = leg.km !== null ? `${formatKm(leg.km)} km` : leg.routeStatus === "loading" ? "berekenen…" : "afstand?";
      const note = leg.alreadyAdded ? " · al toegevoegd" : leg.disabled ? " · telt niet mee" : "";
      const from = leg.from.shortName.split(",")[0];
      const to = leg.to.shortName.split(",")[0];
      items.push({
        id: `l-${leg.key}`, start: leg.departMin, end: Math.max(leg.arriveMin, leg.departMin + 15),
        className: legClass(leg),
        title: `${leg.from.shortName} → ${leg.to.shortName}, ${kmText}${note}`,
        selected: isSel(sel),
        onClick: () => onSelect(sel),
        render: (h) => (
          <>
            <span className="sr-only">Rit </span>
            <span className="block font-medium truncate">
              <svg className="w-3 h-3 inline -mt-0.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17h14M6 17l1.5-6h9L18 17M8 17v2m8-2v2M7.5 11l1-3h7l1 3" />
              </svg>
              {h > 30 ? `${from} → ${to}` : kmText}
            </span>
            {h > 30 ? (
              <span className="block truncate">{kmText}{note}</span>
            ) : (
              <span className="sr-only"> {from} → {to}{note}</span>
            )}
          </>
        ),
      });
    }
    for (const m of manualStops) {
      if (m.date !== date) continue;
      const start = toMin(m.time);
      const leg = legs.find((l) => l.manual && l.date === date && l.to.shortName === m.location.shortName);
      const sel: Selection = leg ? { type: "leg", key: leg.key } : null;
      items.push({
        id: `m-${m.id}`, start, end: start + MANUAL_STOP_MIN,
        className: "bg-white border-dashed border-blue-400 text-blue-900",
        title: `Tussenstop ${m.purpose} bij ${m.location.shortName} om ${m.time}`,
        selected: false,
        onClick: () => onSelect(sel),
        render: () => (
          <>
            <span className="sr-only">Tussenstop </span>
            <span className="block font-medium truncate">{m.purpose}</span>
            <span className="sr-only"> om {m.time}</span>
          </>
        ),
      });
    }
    return items;
  }

  return (
    <div className="flex">
      {/* Tijd-as */}
      <div className="w-10 flex-shrink-0 pt-8" aria-hidden="true">
        {allDay.length > 0 && <div className="h-7" />}
        <div className="relative" style={{ height }}>
          {Array.from({ length: endH - startH + 1 }, (_, i) => startH + i).map((h) => (
            <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-gray-500" style={{ top: top(h * 60) }}>
              {h}:00
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 grid gap-1 min-w-0" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((date) => {
          const { weekday, day } = dayLabel(date);
          const dayAllDay = allDay.filter((p) => p.event.date === date);
          const placed = layoutLanes(itemsFor(date));
          return (
            <div key={date} className="min-w-0" role="group" aria-label={`${weekday} ${day}`}>
              <div className="h-8 flex items-center justify-between gap-1 px-1">
                <span className="text-xs text-gray-600">
                  {weekday} <span className="font-semibold text-gray-900">{day}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onSelect({ type: "add", date })}
                  className="text-xs text-blue-700 hover:bg-blue-50 rounded px-1 py-0.5"
                  title="Reisblok toevoegen"
                >
                  + rit<span className="sr-only"> toevoegen op {weekday} {day}</span>
                </button>
              </div>
              {allDay.length > 0 && (
                <div className="h-7 flex gap-1 overflow-hidden px-0.5">
                  {dayAllDay.map((p) => (
                    <button
                      key={p.event.id}
                      type="button"
                      onClick={() => onSelect({ type: "event", id: p.event.id })}
                      className={`text-[11px] truncate rounded border px-1.5 h-6 min-w-0 ${statusClass[p.status.kind]} ${isSel({ type: "event", id: p.event.id }) ? "ring-2 ring-blue-500" : ""}`}
                      title={`${p.event.title} (hele dag)`}
                    >
                      {p.event.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative border-l border-gray-200" style={{ height }}>
                {Array.from({ length: endH - startH }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-gray-100" style={{ top: top((startH + i) * 60) }} aria-hidden="true" />
                ))}
                {placed.map((it) => {
                  const h = Math.max(18, (it.end - it.start) * PX_PER_MIN - 2);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={it.onClick}
                      title={it.title}
                      aria-pressed={it.selected}
                      className={`absolute rounded-md border px-1.5 py-0.5 text-[11px] leading-tight text-left overflow-hidden hover:ring-1 hover:ring-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${it.className} ${it.selected ? "ring-2 ring-blue-500 z-10" : ""}`}
                      style={{
                        top: top(it.start) + 1,
                        height: h,
                        left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / it.lanes}% - 4px)`,
                      }}
                    >
                      {it.render(h)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
