"use client";

import { useEffect, useRef, useState } from "react";
import LocationInput from "./LocationInput";
import { loadHomeAddress, loadSettings, saveHomeAddress, saveSettings } from "@/lib/storage";
import { downloadBackup, parseBackup, restoreBackup, tripCountOf } from "@/lib/backup";
import type { Location } from "@/lib/types";

type Props = {
  onClose: () => void;
};

/** Render alleen wanneer geopend (client-side), dan leest de state direct uit localStorage. */
export default function SettingsPanel({ onClose }: Props) {
  const [initial] = useState(loadSettings);
  const [userName, setUserName] = useState(initial.userName);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [office, setOffice] = useState<Location | null>(initial.office);
  const [home, setHome] = useState<Location | null>(loadHomeAddress);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleRestore(file: File) {
    setBackupError(null);
    try {
      const backup = parseBackup(await file.text());
      const n = tripCountOf(backup);
      const ok = confirm(
        `Backup van ${backup.exportedAt.slice(0, 10)} met ${n} ${n === 1 ? "rit" : "ritten"} terugzetten?\n\n` +
          "Al je huidige ritten en instellingen worden hierdoor vervangen."
      );
      if (!ok) return;
      restoreBackup(localStorage, backup);
      window.location.reload();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Terugzetten mislukt");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings({ userName: userName.trim(), companyName: companyName.trim(), office });
    saveHomeAddress(home);
    onClose();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <form
        onSubmit={handleSave}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-base font-semibold text-gray-900">Instellingen</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Sluiten">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Je naam</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Voornaam Achternaam" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Werkgever <span className="text-gray-400 font-normal">(optioneel)</span></label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Bedrijfsnaam" className={inputClass} />
          </div>
        </div>

        <LocationInput label="Thuisadres" value={home} onChange={setHome} homeAddress={null} />
        <LocationInput label="Kantooradres" value={office} onChange={setOffice} homeAddress={home} />
        <p className="text-xs text-gray-400 -mt-2">
          Afspraken met &quot;kantoor&quot; of &quot;office&quot; in de titel worden bij agenda-import aan dit adres gekoppeld.
        </p>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-700">Backup</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            Je gegevens staan alleen in deze browser. Download af en toe een backup, of zet je ritten zo over naar een ander apparaat.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={downloadBackup} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Backup downloaden
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Backup terugzetten…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRestore(f);
              }}
            />
          </div>
          {backupError && <p className="text-sm text-red-600 mt-2">{backupError}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Annuleren
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  );
}
