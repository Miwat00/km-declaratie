"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import DayCard from "./DayCard";
import LocationInput from "@/components/LocationInput";
import QuestionCard from "./QuestionCard";
import { AddStopPanel, EventPanel, LegPanel } from "./DetailPanels";
import { useFocusTrap } from "@/components/useFocusTrap";
import { rangeLabel, weekLabel } from "@/lib/dayPlan";
import { todayLocal } from "@/lib/date";
import { formatKm } from "@/lib/format";
import type { AgendaImport } from "./useAgendaImport";

const DESKTOP = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true
  );
}

/** Het paneel voor wat je aanklikt (afspraak, rit of nieuwe tussenstop). */
function SelectionPanel({ imp }: { imp: AgendaImport }) {
  const { selection, planned, legs } = imp;
  if (selection?.type === "event") {
    const item = planned.find((p) => p.event.id === selection.id);
    return item ? <EventPanel key={item.event.id} imp={imp} item={item} /> : null;
  }
  if (selection?.type === "leg") {
    const leg = legs.find((l) => l.key === selection.key);
    return leg ? <LegPanel key={leg.key} imp={imp} leg={leg} /> : null;
  }
  if (selection?.type === "add") return <AddStopPanel key={selection.date} imp={imp} date={selection.date} />;
  return null;
}

/** Mobiel: paneel dat van onderen inschuift. */
function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(onClose, "container");
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Aanpassen"
        tabIndex={-1}
        className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl focus:outline-none"
      >
        <div className="flex justify-end -mt-1 -mr-1">
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800" aria-label="Sluiten">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Summary({ imp }: { imp: AgendaImport }) {
  const { summary, rate, handleConfirm, confirmError, addedMessage, nextWeek, questions } = imp;
  const canConfirm = summary.count > 0 && summary.missingKm === 0 && summary.loading === 0;
  const label = `Zet ${summary.count} ${summary.count === 1 ? "rit" : "ritten"} in je declaratie`;
  return (
    <div className="space-y-2">
      {addedMessage ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900 space-y-1" role="status">
          <p className="font-medium">{addedMessage}</p>
          <p className="flex gap-3">
            <Link href="/" className="underline">Naar je ritten</Link>
            <button type="button" onClick={nextWeek} className="underline">Volgende week</button>
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{summary.count} {summary.count === 1 ? "rit" : "ritten"}</span> ·{" "}
            {formatKm(summary.km)} km · € {(summary.km * rate).toFixed(2).replace(".", ",")}
          </p>
          {summary.loading > 0 && <p className="text-xs text-gray-600">Afstanden berekenen…</p>}
          {summary.missingKm > 0 && (
            <p className="text-xs text-orange-700">
              {summary.missingKm} {summary.missingKm === 1 ? "rit heeft" : "ritten hebben"} nog geen afstand. Klik op &ldquo;afstand?&rdquo; om die in te vullen.
            </p>
          )}
          {questions.length > 0 && summary.count > 0 && (
            <p className="text-xs text-gray-600">Afspraken met een open vraag tellen nog niet mee.</p>
          )}
          {summary.alreadyAdded > 0 && (
            <p className="text-xs text-gray-600">{summary.alreadyAdded} {summary.alreadyAdded === 1 ? "rit staat" : "ritten staan"} al in je declaratie.</p>
          )}
          {confirmError && <p className="text-xs text-red-700">{confirmError}</p>}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
          >
            {label}
          </button>
        </>
      )}
    </div>
  );
}

/** Korte melding na een actie, met ongedaan maken. */
function UndoToast({ imp }: { imp: AgendaImport }) {
  const { lastAction, setLastAction } = imp;
  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction((cur) => (cur?.id === lastAction.id ? null : cur)), 7000);
    return () => clearTimeout(t);
  }, [lastAction, setLastAction]);
  if (!lastAction) return null;
  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none" role="status">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 text-white text-sm pl-4 pr-2 py-2 shadow-lg max-w-full">
        <span className="truncate">{lastAction.message}</span>
        <button type="button" onClick={lastAction.undo} className="flex-shrink-0 rounded-full px-3 py-1 font-medium text-blue-200 hover:bg-white/10">
          Ongedaan maken
        </button>
      </div>
    </div>
  );
}

export default function WeekStep({ imp }: { imp: AgendaImport }) {
  const {
    days, weekStart, planned, legs, manualStops, selection, setSelection, prevWeek, nextWeek, homeAddress, setStep,
    hasSavedUrl, fetchedAt, refresh, autoFetching,
  } = imp;
  const isDesktop = useIsDesktop();
  const today = todayLocal();

  const daysView = (
    <div
      className="grid gap-2"
      style={isDesktop ? { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` } : undefined}
    >
      {days.map((d) => (
        <DayCard
          key={d}
          date={d}
          planned={planned.filter((p) => p.event.date === d)}
          legs={legs.filter((l) => l.date === d)}
          manualStops={manualStops.filter((m) => m.date === d)}
          selection={selection}
          onSelect={setSelection}
        />
      ))}
    </div>
  );

  const panelBox = "bg-white rounded-xl border border-gray-200 shadow-sm p-4";

  return (
    <div className="space-y-4">
      {/* Weekkop */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          {hasSavedUrl && fetchedAt && (
            <p className="text-xs text-gray-600">
              Agenda bijgewerkt om {fetchedAt} ·{" "}
              <button type="button" onClick={refresh} disabled={autoFetching} className="text-blue-700 hover:underline disabled:text-gray-500">
                {autoFetching ? "bijwerken…" : "Vernieuwen"}
              </button>
            </p>
          )}
          <h2 className="text-lg font-semibold text-gray-900" aria-live="polite">
            {weekLabel(weekStart, today)} <span className="font-normal text-gray-600">· {rangeLabel(days[0], days[days.length - 1])}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="Week eerder">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="Week later">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-600 hover:text-gray-900 ml-1">Andere agenda</button>
        </div>
      </div>

      {!homeAddress && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2" aria-labelledby="home-prompt">
          <h2 id="home-prompt" className="text-sm font-semibold text-amber-950">Waar begint je dag?</h2>
          <p className="text-sm text-amber-900">Je ritten gaan van huis naar je afspraken en terug. Vul je thuisadres in, dan rekent de app je week uit.</p>
          <LocationInput label="Thuisadres" value={null} onChange={(loc) => loc && imp.saveHome(loc)} homeAddress={null} />
        </section>
      )}

      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
          {planned.length === 0 && manualStops.length === 0 ? (
            <p className={`${panelBox} text-sm text-gray-600 text-center py-10`}>Geen afspraken in deze week.</p>
          ) : (
            daysView
          )}
          <aside className="sticky top-4 space-y-3" aria-label="Je week afronden">
            <div className={panelBox}>
              {selection ? (
                <div className="space-y-3">
                  <button type="button" onClick={() => setSelection(null)} className="text-sm text-blue-700 hover:underline">
                    ← Terug
                  </button>
                  <SelectionPanel imp={imp} />
                </div>
              ) : (
                <QuestionCard imp={imp} />
              )}
            </div>
            <div className={panelBox}><Summary imp={imp} /></div>
          </aside>
        </div>
      ) : (
        <>
          {planned.length > 0 && <div className={panelBox}><QuestionCard imp={imp} /></div>}
          {planned.length === 0 && manualStops.length === 0 ? (
            <p className={`${panelBox} text-sm text-gray-600 text-center py-10`}>Geen afspraken in deze week.</p>
          ) : (
            daysView
          )}
          <div className={panelBox}><Summary imp={imp} /></div>
          {selection && (
            <BottomSheet onClose={() => setSelection(null)}>
              <SelectionPanel imp={imp} />
            </BottomSheet>
          )}
        </>
      )}

      <UndoToast imp={imp} />
    </div>
  );
}
