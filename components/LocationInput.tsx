"use client";

import { useState, useEffect, useRef } from "react";
import { searchLocations } from "@/lib/nominatim";
import { loadSettings, SETTINGS_EVENT } from "@/lib/storage";
import type { Location } from "@/lib/types";

type Props = {
  label: string;
  value: Location | null;
  onChange: (loc: Location | null) => void;
  disabled?: boolean;
  homeAddress: Location | null;
  /** Zonder deze prop wordt de 'opslaan als thuisadres'-knop niet getoond. */
  onSaveHome?: (loc: Location) => void;
};

export default function LocationInput({ label, value, onChange, disabled, homeAddress, onSaveHome }: Props) {
  const [query, setQuery] = useState(value?.shortName ?? "");
  const [results, setResults] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [office, setOffice] = useState<Location | null>(null);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const sync = () => {
      const s = loadSettings();
      setOffice(s.office);
      setCompanyName(s.companyName);
    };
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (value) setQuery(value.shortName);
    else setQuery("");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const locs = await searchLocations(val);
        setResults(locs);
        setOpen(locs.length > 0);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(loc: Location) {
    setQuery(loc.shortName);
    onChange(loc);
    setOpen(false);
    setResults([]);
  }

  function handleSaveHome() {
    if (value && onSaveHome) {
      onSaveHome(value);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  }

  function getSubtitle(loc: Location): string {
    const parts = loc.displayName.split(",").map((p) => p.trim());
    const shortParts = loc.shortName.split(",").map((p) => p.trim());
    const extra = parts.filter(
      (p) => !shortParts.some((s) => s.toLowerCase() === p.toLowerCase())
    );
    return extra.slice(0, 2).join(", ");
  }

  const isHome = !!value && value.shortName === homeAddress?.shortName;
  const isOffice = !!value && value.shortName === office?.shortName;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1 gap-1 flex-wrap">
        <label className="block text-sm font-medium text-gray-700 flex-shrink-0">{label}</label>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Thuis knopje — zichtbaar zodra thuisadres opgeslagen is */}
          {homeAddress && (
            <button
              type="button"
              onClick={() => handleSelect(homeAddress)}
              className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                isHome
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-blue-700 hover:bg-blue-50"
              }`}
              title={`Thuis: ${homeAddress.shortName}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Thuis
            </button>
          )}

          {/* Kantoor knopje — zichtbaar zodra kantoor is ingesteld */}
          {office && (
            <button
              type="button"
              onClick={() => handleSelect(office)}
              className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                isOffice
                  ? "bg-orange-100 text-orange-700"
                  : "text-gray-500 hover:text-orange-700 hover:bg-orange-50"
              }`}
              title={`${companyName ? companyName + ": " : "Kantoor: "}${office.shortName}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Kantoor
            </button>
          )}

        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled}
          placeholder="Bijv. Keizersgracht 1, Amsterdam"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed pr-14"
        />
        {/* Sla op als thuis — icoon in het veld, links van checkmark */}
        {onSaveHome && <button
          type="button"
          onClick={handleSaveHome}
          disabled={!value || isHome || isOffice}
          title="Sla op als thuisadres"
          className={`absolute right-8 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
            savedFeedback
              ? "text-green-500"
              : value && !isHome && !isOffice
              ? "text-gray-300 hover:text-gray-500"
              : "invisible"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {value && !loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((loc, i) => {
            const sub = getSubtitle(loc);
            return (
              <li
                key={i}
                onMouseDown={() => handleSelect(loc)}
                className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0"
              >
                <div className="text-sm font-medium text-gray-900">{loc.shortName}</div>
                {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
