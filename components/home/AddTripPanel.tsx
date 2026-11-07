"use client";

import { useState } from "react";
import TripForm from "@/components/TripForm";
import { formatKm } from "@/lib/format";
import { samePlace, type FrequentRoute } from "@/lib/month";
import { todayLocal } from "@/lib/date";
import type { Location, Trip } from "@/lib/types";

type Props = {
  rate: number;
  userName: string;
  routes: FrequentRoute[];
  home: Location | null;
  office: Location | null;
  onAdd: (trips: Trip[]) => void;
};

/** "+ Rit": eerst je vaak gereden routes (één tik), anders het formulier. */
export default function AddTripPanel({ rate, userName, routes, home, office, onAdd }: Props) {
  const [date, setDate] = useState(todayLocal);
  const [name, setName] = useState(userName);
  const [showForm, setShowForm] = useState(routes.length === 0);
  const place = (l: Location) =>
    home && samePlace(l, home) ? "Thuis" : office && samePlace(l, office) ? "Kantoor" : l.shortName.split(",")[0];

  function addRoute(r: FrequentRoute) {
    if (!name.trim()) return;
    const make = (from: Location, to: Location, km: number): Trip => ({
      id: crypto.randomUUID(), date, name: name.trim(), purpose: r.purpose, client: r.client, billable: r.billable,
      locationA: from, locationB: to, distanceKm: km, rate, amount: Math.round(km * rate * 100) / 100,
    });
    onAdd([make(r.from, r.to, r.kmThere), make(r.to, r.from, r.kmBack)]);
  }

  if (showForm) return <TripForm rate={rate} onAdd={onAdd} initialDate={date} initialName={name} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
        <div>
          <label htmlFor="quick-name" className="block text-sm font-medium text-gray-800 mb-1">Naam</label>
          <input
            id="quick-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jouw naam"
            autoComplete="name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="quick-date" className="block text-sm font-medium text-gray-800 mb-1">Datum</label>
          <input
            id="quick-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <h3 className="text-sm text-gray-700 mb-2">Vaak gereden · heen en terug</h3>
        <div className="grid gap-2">
          {routes.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => addRoute(r)}
              disabled={!name.trim()}
              className="flex items-center gap-3 w-full text-left rounded-lg border border-gray-300 bg-white px-3 py-2.5 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-60 disabled:hover:bg-white"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-900 truncate">{place(r.from)} ⇄ {place(r.to)}</span>
                <span className="block text-xs text-gray-600 truncate">{r.purpose}{r.client ? ` · ${r.client}` : ""}</span>
              </span>
              <span className="text-sm text-gray-900 tabular-nums flex-shrink-0">{formatKm(r.kmThere + r.kmBack)} km</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">{name.trim() ? "Eén tik en de rit staat erin." : "Vul eerst je naam in."}</p>
      </div>
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full rounded-lg border border-dashed border-gray-400 px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
      >
        Andere rit…
      </button>
    </div>
  );
}
