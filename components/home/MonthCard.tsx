"use client";

import { useState } from "react";
import { formatDateNL } from "@/lib/date";
import { formatKm } from "@/lib/format";
import { monthTitle, type MonthSummary } from "@/lib/month";

type Props = {
  month: string;
  summary: MonthSummary;
  onPrev: () => void;
  onNext: () => void;
  adminEmail: string;
  /** Versturen of downloaden; daarna zet de pagina de maand op gedeclareerd */
  onDeclare: (how: "mail" | "pdf" | "csv", to: string) => void;
};

const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

function statusText(s: MonthSummary["status"]) {
  switch (s.kind) {
    case "leeg": return "nog geen ritten";
    case "open": return "nog niet gedeclareerd";
    case "deels": return `${s.open} ${s.open === 1 ? "rit" : "ritten"} nog niet gedeclareerd`;
    case "gedeclareerd": return `gedeclareerd op ${formatDateNL(s.on)}`;
  }
}

/** De maand in één oogopslag, met één knop om te declareren. */
export default function MonthCard({ month, summary, onPrev, onNext, adminEmail, onDeclare }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(adminEmail);
  const done = summary.status.kind === "gedeclareerd";
  const choose = (how: "mail" | "pdf" | "csv") => {
    onDeclare(how, to.trim());
    setOpen(false);
  };
  const option = "flex flex-col items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 hover:bg-blue-50 hover:border-blue-300";

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" aria-label={`Declaratie ${monthTitle(month)}`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onPrev} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Vorige maand">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-base font-semibold text-gray-900" aria-live="polite">{monthTitle(month)}</h2>
        <button type="button" onClick={onNext} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Volgende maand">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <p className={`mt-3 text-center text-3xl font-semibold ${done ? "text-gray-500" : "text-gray-900"}`}>{euro(summary.amount)}</p>
      <p className="mt-1 text-center text-sm text-gray-600">
        {formatKm(summary.km)} km · {summary.count} {summary.count === 1 ? "rit" : "ritten"} ·{" "}
        <span className={done ? "text-green-800" : summary.status.kind === "leeg" ? "" : "text-gray-900"}>{statusText(summary.status)}</span>
      </p>

      {summary.count > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${done ? "border border-gray-300 text-gray-800 hover:bg-gray-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          {done ? "Opnieuw versturen" : "Declareren"}
        </button>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="declare-to" className="block text-sm text-gray-800 mb-1">Versturen naar</label>
            <input
              id="declare-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="administratie@bedrijf.nl"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={option} onClick={() => choose("mail")}>
              <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Mailen
            </button>
            <button type="button" className={option} onClick={() => choose("pdf")}>
              <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              PDF
            </button>
            <button type="button" className={option} onClick={() => choose("csv")}>
              <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Mailen opent je mailprogramma met een samenvatting en downloadt de CSV, zodat je die kunt bijvoegen (op je telefoon gaat hij
            direct als bijlage mee). Daarna staat {monthTitle(month).split(" ")[0].toLowerCase()} op gedeclareerd; dat kun je ongedaan maken.
          </p>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-700 hover:underline">Annuleren</button>
        </div>
      )}
    </section>
  );
}
