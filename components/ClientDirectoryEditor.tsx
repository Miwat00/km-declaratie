"use client";

import { useState } from "react";
import { searchLocations } from "@/lib/nominatim";
import type { ClientEntry, Location } from "@/lib/types";

type Props = {
  entries: ClientEntry[];
  onChange: (entries: ClientEntry[]) => void;
};

export default function ClientDirectoryEditor({ entries, onChange }: Props) {
  const [keyword, setKeyword] = useState("");
  const [client, setClient] = useState("");
  const [billable, setBillable] = useState(true);
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<Location[]>([]);
  const [locOpen, setLocOpen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(null);
  const [debounceRef, setDebounceRef] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleLocInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocQuery(val);
    setSelectedLoc(null);
    if (debounceRef) clearTimeout(debounceRef);
    if (val.trim().length < 2) { setLocResults([]); setLocOpen(false); return; }
    const t = setTimeout(async () => {
      setLocLoading(true);
      try {
        const r = await searchLocations(val);
        setLocResults(r);
        setLocOpen(r.length > 0);
      } finally { setLocLoading(false); }
    }, 400);
    setDebounceRef(t);
  }

  function handleLocSelect(loc: Location) {
    setSelectedLoc(loc);
    setLocQuery(loc.shortName);
    setLocOpen(false);
  }

  function handleAdd() {
    if (!keyword.trim() || !selectedLoc || !client.trim()) return;
    const entry: ClientEntry = {
      keyword: keyword.trim(),
      location: selectedLoc,
      client: client.trim(),
      billable,
    };
    onChange([...entries, entry]);
    setKeyword("");
    setClient("");
    setLocQuery("");
    setSelectedLoc(null);
    setBillable(true);
  }

  function handleRemove(idx: number) {
    onChange(entries.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {/* Bestaande koppelingen */}
      {entries.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{e.keyword}</span>
                <span className="text-gray-400 mx-1.5">→</span>
                <span className="text-gray-600 truncate">{e.location.shortName}</span>
                <span className="text-gray-400 mx-1.5">·</span>
                <span className="text-gray-500">{e.client}</span>
                {e.billable && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Factureerbaar</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Nieuwe koppeling toevoegen */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Koppeling toevoegen</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Zoekwoord (uit agenda-titel)</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Bijv. Klant X, Gemeente Y..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Klantnaam (voor de rit)</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Klantnaam of project"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">Locatie</label>
          <input
            type="text"
            value={locQuery}
            onChange={handleLocInput}
            onFocus={() => locResults.length > 0 && setLocOpen(true)}
            placeholder="Adres van de klant"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
          />
          {locLoading && (
            <div className="absolute right-3 top-7">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {selectedLoc && !locLoading && (
            <div className="absolute right-3 top-7 text-green-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {locOpen && locResults.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {locResults.map((loc, i) => (
                <li
                  key={i}
                  onMouseDown={() => handleLocSelect(loc)}
                  className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0"
                >
                  <div className="text-sm font-medium text-gray-900">{loc.shortName}</div>
                  <div className="text-xs text-gray-400 truncate">{loc.displayName.split(",").slice(1, 3).join(",")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Standaard factureerbaar</span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!keyword.trim() || !selectedLoc || !client.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
