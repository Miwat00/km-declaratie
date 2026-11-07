"use client";

import { useEffect, useState } from "react";
import { getRouteWithGeometry } from "@/lib/osrm";
import { formatKm, parseKm } from "@/lib/format";
import type { Location, RouteData } from "@/lib/types";

/**
 * Afstand tussen twee adressen: automatisch via de route, met de mogelijkheid hem zelf in te vullen.
 * Bij een ander van/naar-paar gaat hij terug naar de berekende route.
 */
export function useRouteDistance(from: Location | null, to: Location | null, initialKm?: number) {
  const pairKey = from && to ? `${from.lat},${from.lon}>${to.lat},${to.lon}` : null;
  const [route, setRoute] = useState<{ key: string; data?: RouteData; error?: string } | null>(null);
  const [manual, setManual] = useState(initialKm !== undefined);
  const [input, setInput] = useState(initialKm !== undefined ? formatKm(initialKm) : "");
  const [prevPair, setPrevPair] = useState(pairKey);
  if (pairKey !== prevPair) {
    setPrevPair(pairKey);
    setManual(false);
  }

  useEffect(() => {
    if (!pairKey || !from || !to) return;
    let cancelled = false;
    getRouteWithGeometry(from, to)
      .then((data) => !cancelled && setRoute({ key: pairKey, data }))
      .catch((err) => !cancelled && setRoute({ key: pairKey, error: err instanceof Error ? err.message : "Route ophalen mislukt" }));
    return () => { cancelled = true; };
    // pairKey bevat from en to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  const current = route && route.key === pairKey ? route : null;
  const routeData = current?.data ?? null;
  const routeKm = routeData?.distanceKm ?? null;
  const km = manual ? parseKm(input) : routeKm;
  return {
    km,
    routeKm,
    routeData,
    manual,
    loading: !!pairKey && !current,
    error: current?.error ?? null,
    display: manual ? input : routeKm !== null ? formatKm(routeKm) : "",
    invalid: manual && input.trim() !== "" && km === null,
    setInput: (v: string) => { setInput(v); setManual(true); },
    useRoute: () => setManual(false),
  };
}

export type RouteDistance = ReturnType<typeof useRouteDistance>;

/** Afstandsveld met uitleg: berekend, aangepast, of zelf invullen bij een storing. */
export function KmRow({ id, label, d }: { id: string; label: string; d: RouteDistance }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label htmlFor={id} className="text-sm font-medium text-gray-800">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={d.display}
          onChange={(e) => d.setInput(e.target.value)}
          placeholder={d.loading ? "…" : "0,0"}
          aria-describedby={`${id}-hint`}
          aria-invalid={d.invalid}
          className={`w-24 rounded-lg border px-3 py-1.5 pr-9 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${d.invalid ? "border-red-400" : "border-gray-300"}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">km</span>
      </div>
      <p id={`${id}-hint`} className={`text-xs ${d.invalid || (d.error && !d.manual) ? "text-orange-700" : "text-gray-600"}`} aria-live="polite">
        {d.loading && !d.manual ? "Route berekenen…"
          : d.invalid ? "Vul een afstand in, bijv. 12,5"
          : d.error && !d.manual ? "Route niet gevonden. Vul de afstand zelf in."
          : d.manual && d.routeKm !== null && d.km !== d.routeKm ? (
            <>
              Zelf aangepast (route: {formatKm(d.routeKm)} km).{" "}
              <button type="button" onClick={d.useRoute} className="text-blue-700 hover:underline">Route gebruiken</button>
            </>
          )
          : d.routeKm !== null && !d.manual ? "Berekend via OpenStreetMap. Je kunt het aanpassen."
          : null}
      </p>
    </div>
  );
}
