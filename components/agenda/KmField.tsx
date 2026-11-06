"use client";

import { useState } from "react";
import { formatKm, parseKm } from "@/lib/format";

// Afstand-invoer die de gebruiker vrij laat typen ("12," is tijdelijk ongeldig) en meeloopt
// met een nieuw berekende afstand als een locatie verandert.
export default function KmField({ id, value, onChange }: { id: string; value: number; onChange: (km: number) => void }) {
  const [text, setText] = useState(value > 0 ? formatKm(value) : "");
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseKm(text) !== value) setText(value > 0 ? formatKm(value) : "");
  }
  const invalid = text.trim() !== "" && parseKm(text) === null;
  return (
    <div className="relative w-28">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const km = parseKm(e.target.value);
          if (km !== null) onChange(km);
        }}
        placeholder="0,0"
        className={`w-full rounded-lg border px-3 py-2 pr-9 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${invalid ? "border-red-400" : "border-gray-300"}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">km</span>
    </div>
  );
}
