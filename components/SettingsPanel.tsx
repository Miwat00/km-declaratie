"use client";

import { useRef, useState } from "react";
import LocationInput from "./LocationInput";
import { useFocusTrap } from "./useFocusTrap";
import { loadHomeAddress, loadRate, loadSettings, saveHomeAddress, saveRate, saveSettings, wipeAllData } from "@/lib/storage";
import { downloadBackup, parseBackup, restoreBackup, tripCountOf } from "@/lib/backup";
import type { Location } from "@/lib/types";

type Props = {
  onClose: () => void;
  /** Na opslaan, zodat de pagina tarief en namen opnieuw inleest */
  onSaved?: () => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const smallBtn = "px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

/** Render alleen wanneer geopend (client-side), dan leest de state direct uit localStorage. */
export default function SettingsPanel({ onClose, onSaved }: Props) {
  const [initial] = useState(loadSettings);
  const [userName, setUserName] = useState(initial.userName);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [adminEmail, setAdminEmail] = useState(initial.adminEmail);
  const [office, setOffice] = useState<Location | null>(initial.office);
  const [home, setHome] = useState<Location | null>(loadHomeAddress);
  const [rateInput, setRateInput] = useState(() => loadRate().toFixed(2).replace(".", ","));
  const [rateError, setRateError] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { ref: trapRef, onKeyDown: trapKeyDown } = useFocusTrap<HTMLFormElement>(onClose);

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

  function handleWipe() {
    const ok = confirm(
      "Alle ritten, instellingen en de opgeslagen agenda-link uit deze browser wissen?\n\nDit kan niet ongedaan worden gemaakt. Download eerst een backup als je twijfelt."
    );
    if (!ok) return;
    wipeAllData();
    window.location.href = "/";
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const rate = parseFloat(rateInput.replace(",", "."));
    if (!(rate > 0 && rate <= 5)) {
      setRateError("Vul een tarief in, bijv. 0,23");
      return;
    }
    saveRate(rate);
    saveSettings({ userName: userName.trim(), companyName: companyName.trim(), office, adminEmail: adminEmail.trim() });
    saveHomeAddress(home);
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <form
        ref={trapRef}
        onKeyDown={trapKeyDown}
        onSubmit={handleSave}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-base font-semibold text-gray-900">Instellingen</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1" aria-label="Sluiten">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Section title="Jij">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-name" className="block text-sm text-gray-700 mb-1">Je naam</label>
              <input id="settings-name" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Voornaam Achternaam" autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="settings-company" className="block text-sm text-gray-700 mb-1">Werkgever <span className="text-gray-500">(optioneel)</span></label>
              <input id="settings-company" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Bedrijfsnaam" className={inputClass} />
            </div>
          </div>
        </Section>

        <Section title="Adressen">
          <LocationInput label="Thuisadres" value={home} onChange={setHome} homeAddress={null} />
          <LocationInput label="Kantooradres" value={office} onChange={setOffice} homeAddress={home} />
          <p className="text-xs text-gray-600 -mt-1">Afspraken met &ldquo;kantoor&rdquo; of &ldquo;office&rdquo; in de titel krijgen automatisch dit adres.</p>
        </Section>

        <Section title="Declareren">
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
            <div>
              <label htmlFor="settings-rate" className="block text-sm text-gray-700 mb-1">Tarief per km</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500" aria-hidden="true">€</span>
                <input
                  id="settings-rate"
                  inputMode="decimal"
                  value={rateInput}
                  onChange={(e) => { setRateInput(e.target.value); setRateError(null); }}
                  aria-describedby="settings-rate-hint"
                  aria-invalid={!!rateError}
                  className={`${inputClass} pl-7`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="settings-email" className="block text-sm text-gray-700 mb-1">Declaraties sturen naar <span className="text-gray-500">(optioneel)</span></label>
              <input id="settings-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="administratie@bedrijf.nl" className={inputClass} />
            </div>
          </div>
          <p id="settings-rate-hint" className={`text-xs ${rateError ? "text-red-700" : "text-gray-600"}`}>
            {rateError ?? "Een nieuw tarief geldt voor ritten die je daarna toevoegt."}
          </p>
        </Section>

        <Section title="Je gegevens">
          <p className="text-xs text-gray-600">
            Alles staat alleen in deze browser. Download af en toe een backup, of zet je ritten zo over naar een ander apparaat.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={downloadBackup} className={smallBtn}>Backup downloaden</button>
            <button type="button" onClick={() => fileRef.current?.click()} className={smallBtn}>Backup terugzetten…</button>
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
            <button type="button" onClick={handleWipe} className="px-3 py-1.5 rounded-lg text-sm text-red-700 hover:bg-red-50">
              Alle gegevens wissen…
            </button>
          </div>
          {backupError && <p className="text-sm text-red-700">{backupError}</p>}
        </Section>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
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
