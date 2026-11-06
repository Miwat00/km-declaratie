"use client";

import { useState, useEffect, useRef, useId } from "react";
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
  const [noResults, setNoResults] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchIdRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const uid = useId();
  const inputId = `${uid}-input`;
  const listboxId = `${uid}-listbox`;
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
    setNoResults(false);
    onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const searchId = ++searchIdRef.current;
      setLoading(true);
      try {
        const locs = await searchLocations(val);
        // Een trager, ouder zoekresultaat mag een nieuwer niet overschrijven
        if (searchId !== searchIdRef.current) return;
        setResults(locs);
        setNoResults(locs.length === 0);
        setActiveIndex(-1);
        setOpen(locs.length > 0);
      } finally {
        if (searchId === searchIdRef.current) setLoading(false);
      }
    }, 400);
  }

  function handleSelect(loc: Location) {
    searchIdRef.current++; // lopende zoekopdracht negeren
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(loc.shortName);
    onChange(loc);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    switch (e.key) {
      case "ArrowDown":
        if (count === 0) return;
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        if (count === 0) return;
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case "Enter":
        if (open && count > 0) {
          e.preventDefault(); // niet het formulier versturen
          handleSelect(results[activeIndex >= 0 ? activeIndex : 0]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // sluit alleen de lijst, niet een omliggend venster
          setOpen(false);
          setActiveIndex(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
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
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 flex-shrink-0">{label}</label>
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
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
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
          aria-label="Sla op als thuisadres"
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

      {noResults && !value && (
        <p className="mt-1 text-xs text-orange-700" role="status">
          Geen adres gevonden. Probeer straat, huisnummer en plaats, of alleen een plaats- of gebouwnaam.
        </p>
      )}

      <span className="sr-only" aria-live="polite">
        {open && results.length > 0
          ? `${results.length} ${results.length === 1 ? "adres" : "adressen"} gevonden, kies met pijltjestoetsen`
          : ""}
      </span>

      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`Suggesties voor ${label}`}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.map((loc, i) => {
            const sub = getSubtitle(loc);
            const active = i === activeIndex;
            return (
              <li
                key={i}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={active}
                ref={(el) => {
                  if (active && el) el.scrollIntoView({ block: "nearest" });
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // focus in het invoerveld houden
                  handleSelect(loc);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-0 ${active ? "bg-blue-50" : ""}`}
              >
                <div className="text-sm font-medium text-gray-900">{loc.shortName}</div>
                {sub && <div className="text-xs text-gray-500 truncate">{sub}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
