"use client";

import { useState } from "react";
import { formatKm } from "@/lib/format";
import { journeyLabel, journeys, samePlace, weekStartOf, type Journey } from "@/lib/month";
import type { Location, Trip } from "@/lib/types";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]} ${d}`;
};
const weekLabel = (monday: string) => {
  const [, m, d] = monday.split("-").map(Number);
  return `Week van ${d} ${MONTHS[m - 1]}`;
};

type Props = {
  trips: Trip[];
  home: Location | null;
  office: Location | null;
  showNames: boolean;
  onAdd: () => void;
  onEdit: (trip: Trip) => void;
  onDelete: (journeyTrips: Trip[], one?: Trip) => void;
};

/** De ritten van de maand per week, met heen en terug samen op één regel. */
export default function TripList({ trips, home, office, showNames, onAdd, onEdit, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const place = (l: Location) =>
    home && samePlace(l, home) ? "Thuis" : office && samePlace(l, office) ? "Kantoor" : l.shortName.split(",")[0];

  const list = [...journeys(trips)].reverse(); // nieuwste eerst
  const weeks = new Map<string, Journey[]>();
  for (const j of list) {
    const w = weekStartOf(j.date);
    weeks.set(w, [...(weeks.get(w) ?? []), j]);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" aria-labelledby="trips-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="trips-title" className="text-base font-semibold text-gray-900">Ritten</h2>
        <button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Rit
        </button>
      </div>

      {list.length === 0 && <p className="mt-6 mb-2 text-sm text-gray-600 text-center">Nog geen ritten deze maand.</p>}

      {[...weeks.entries()].map(([monday, js]) => (
        <div key={monday} className="mt-4">
          <h3 className="text-xs font-medium text-gray-600">{weekLabel(monday)}</h3>
          <ul className="mt-1 divide-y divide-gray-100">
            {js.map((j) => {
              const expanded = openId === j.id;
              const sub = [showNames ? j.name : null, j.purposes.join(", "), j.clients.join(", ")].filter(Boolean).join(" · ");
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : j.id)}
                    aria-expanded={expanded}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 rounded-lg px-1"
                  >
                    <span className="w-10 flex-shrink-0 text-xs text-gray-600">{dayLabel(j.date)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-900 truncate">{journeyLabel(j, place)}</span>
                      <span className="block text-xs text-gray-600 truncate">{sub}</span>
                    </span>
                    <span className="flex-shrink-0 text-sm text-gray-900 tabular-nums">
                      {formatKm(j.km)} km
                      {j.declared && (
                        <svg className="w-4 h-4 inline ml-1 -mt-0.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label="gedeclareerd">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mb-2 ml-11 rounded-lg bg-gray-50 p-2 space-y-1">
                      {j.trips.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-gray-800">
                          <span className="flex-1 min-w-0 truncate">
                            {place(t.locationA)} → {place(t.locationB)} · {formatKm(t.distanceKm)} km
                          </span>
                          <button type="button" onClick={() => onEdit(t)} className="px-2 py-1 rounded text-blue-700 hover:bg-blue-50">
                            Bewerken<span className="sr-only"> rit {place(t.locationA)} naar {place(t.locationB)}</span>
                          </button>
                          {j.trips.length > 1 && (
                            <button type="button" onClick={() => onDelete(j.trips, t)} className="px-2 py-1 rounded text-red-700 hover:bg-red-50">
                              Verwijderen<span className="sr-only"> rit {place(t.locationA)} naar {place(t.locationB)}</span>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => { onDelete(j.trips); setOpenId(null); }} className="text-xs px-2 py-1 rounded text-red-700 hover:bg-red-50">
                        {j.trips.length > 1 ? "Hele reis verwijderen" : "Verwijderen"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
