"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import DayCard from "./DayCard";
import LocationInput from "@/components/LocationInput";
import QuestionCard from "./QuestionCard";
import Sheet from "@/components/Sheet";
import { AddStopPanel, EventPanel, LegPanel } from "./DetailPanels";
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

/** Wat je aanklikt (afspraak, rit of nieuwe tussenstop), in een paneel boven de week. */
function SelectionSheet({ imp }: { imp: AgendaImport }) {
  const { selection, planned, legs, setSelection } = imp;
  if (!selection) return null;
  const close = () => setSelection(null);
  if (selection.type === "event") {
    const item = planned.find((p) => p.event.id === selection.id);
    return item ? <Sheet title="Afspraak" onClose={close}><EventPanel key={item.event.id} imp={imp} item={item} /></Sheet> : null;
  }
  if (selection.type === "leg") {
    const leg = legs.find((l) => l.key === selection.key);
    return leg ? <Sheet title="Rit" onClose={close}><LegPanel key={leg.key} imp={imp} leg={leg} /></Sheet> : null;
  }
  return <Sheet title="Tussenstop" onClose={close}><AddStopPanel key={selection.date} imp={imp} date={selection.date} /></Sheet>;
}

function Summary({ imp }: { imp: AgendaImport }) {
  const { summary, rate, handleConfirm, confirmError, addedMessage, nextWeek, questions, dayQuestions } = imp;
  const canConfirm = summary.count > 0 && summary.missingKm === 0 && summary.loading === 0;
  const openQuestions = questions.length + dayQuestions.length;

  if (addedMessage) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-900 flex items-center gap-3 flex-wrap" role="status">
        <span className="font-medium">{addedMessage}</span>
        <Link href="/" className="underline">Naar je ritten</Link>
        <button type="button" onClick={nextWeek} className="underline">Volgende week</button>
      </div>
    );
  }
  if (summary.count === 0 && summary.loading === 0 && openQuestions === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700 flex items-center gap-3 flex-wrap">
        <span>{summary.alreadyAdded > 0 ? "Alle ritten van deze week staan al in je declaratie." : "Deze week niets te declareren."}</span>
        <button type="button" onClick={nextWeek} className="font-medium text-blue-700 hover:underline">Volgende week →</button>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="text-sm text-gray-700 flex-1 min-w-[12rem]">
        <p>
          <span className="font-semibold text-gray-900">{summary.count} {summary.count === 1 ? "rit" : "ritten"}</span> ·{" "}
          {formatKm(summary.km)} km · € {(summary.km * rate).toFixed(2).replace(".", ",")}
        </p>
        {summary.loading > 0 && <p className="text-xs text-gray-600">Afstanden berekenen…</p>}
        {summary.missingKm > 0 && (
          <p className="text-xs text-orange-700">
            {summary.missingKm} {summary.missingKm === 1 ? "rit heeft" : "ritten hebben"} nog geen afstand. Klik op &ldquo;afstand?&rdquo; om die in te vullen.
          </p>
        )}
        {openQuestions > 0 && <p className="text-xs text-gray-600">Dagen en afspraken met een open vraag tellen nog niet mee.</p>}
        {summary.alreadyAdded > 0 && (
          <p className="text-xs text-gray-600">{summary.alreadyAdded} {summary.alreadyAdded === 1 ? "rit staat" : "ritten staan"} al in je declaratie.</p>
        )}
        {confirmError && <p className="text-xs text-red-700">{confirmError}</p>}
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
      >
        Zet {summary.count} {summary.count === 1 ? "rit" : "ritten"} in je declaratie
      </button>
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
    <div className="fixed bottom-4 inset-x-0 z-[950] flex justify-center px-4 pointer-events-none" role="status">
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
    hasSavedUrl, fetchedAt, refresh, autoFetching, showWeekend, setShowWeekend, weekendInfo, resetWeek,
    previousWeek, copyPreviousWeek, dayModes, setDayMode, questions, dayQuestions,
  } = imp;
  const isDesktop = useIsDesktop();
  const today = todayLocal();
  const box = "bg-white rounded-xl border border-gray-200 shadow-sm p-4";
  const hasQuestions = questions.length + dayQuestions.length > 0;

  return (
    <div className="space-y-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="Week eerder">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="Week later">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button type="button" onClick={resetWeek} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 hover:bg-gray-50" title="Alle keuzes van deze week terug naar wat de app raadt">
            Week opnieuw
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-700 hover:text-gray-900 ml-1">Andere agenda</button>
        </div>
      </div>

      {/* Weekend: standaard uit */}
      <p className="text-xs text-gray-600">
        {showWeekend ? (
          <>Weekend zichtbaar · <button type="button" className="text-blue-700 hover:underline" onClick={() => setShowWeekend(false)}>verbergen</button></>
        ) : weekendInfo.count > 0 ? (
          <>
            Weekend: {weekendInfo.count} {weekendInfo.count === 1 ? "afspraak" : "afspraken"}
            {weekendInfo.withPlace > 0 ? `, ${weekendInfo.withPlace} met een adres` : ", niets met een adres"} ·{" "}
            <button type="button" className="text-blue-700 hover:underline" onClick={() => setShowWeekend(true)}>tonen</button>
          </>
        ) : (
          <>Geen afspraken in het weekend · <button type="button" className="text-blue-700 hover:underline" onClick={() => setShowWeekend(true)}>toch tonen</button></>
        )}
      </p>

      {!homeAddress && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2" aria-labelledby="home-prompt">
          <h2 id="home-prompt" className="text-sm font-semibold text-amber-950">Waar begint je dag?</h2>
          <p className="text-sm text-amber-900">Je ritten gaan van huis naar je afspraken en terug. Vul je thuisadres in, dan rekent de app je week uit.</p>
          <LocationInput label="Thuisadres" value={null} onChange={(loc) => loc && imp.saveHome(loc)} homeAddress={null} />
        </section>
      )}

      {previousWeek && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3 flex-wrap text-sm text-blue-950">
          <span>Zelfde als vorige week ({previousWeek.summary})?</span>
          <button type="button" onClick={copyPreviousWeek} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 font-medium">
            Overnemen
          </button>
          <span className="text-xs text-blue-900">of kies hieronder per dag</span>
        </div>
      )}

      {/* De vraag als balk boven de week */}
      {(hasQuestions || planned.length > 0) && <div className={box}><QuestionCard imp={imp} /></div>}

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
            mode={dayModes[d] ?? { place: "thuis", transport: "auto", chosen: false }}
            onMode={(patch) => setDayMode(d, patch)}
          />
        ))}
      </div>

      <Summary imp={imp} />
      <SelectionSheet imp={imp} />
      <UndoToast imp={imp} />
    </div>
  );
}
