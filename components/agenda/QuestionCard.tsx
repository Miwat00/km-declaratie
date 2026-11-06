"use client";

import { useState } from "react";
import LocationInput from "@/components/LocationInput";
import { eventSpan, fromMin, type PlannedEvent } from "@/lib/dayPlan";
import type { AgendaImport } from "./useAgendaImport";

const WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function longDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS[dow][0].toUpperCase()}${WEEKDAYS[dow].slice(1)} ${d} ${MONTHS[m - 1]}`;
}

const answerClass =
  "flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}
const ICONS = {
  recent: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  office: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  none: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
};

/** Eén vraag tegelijk: "Waar was deze afspraak?", met de waarschijnlijkste antwoorden als knoppen. */
function Question({ imp, item, remaining }: { imp: AgendaImport; item: PlannedEvent; remaining: number }) {
  const { answerQuestion, frequentLocations, settings, homeAddress } = imp;
  const { event } = item;
  const [remember, setRemember] = useState(true);
  const [searching, setSearching] = useState(false);
  const span = eventSpan(event);

  return (
    <section aria-labelledby="question-title" className="space-y-3">
      <p className="text-sm text-gray-600">
        {remaining === 1 ? "Nog 1 vraag, daarna is je week klaar" : `Nog ${remaining} vragen, daarna is je week klaar`}
      </p>
      <div>
        <h2 id="question-title" className="text-base font-semibold text-gray-900">
          Waar was &ldquo;{event.title}&rdquo;?
        </h2>
        <p className="text-sm text-gray-600">
          {longDate(event.date)} · {fromMin(span.start)}–{fromMin(span.end)}
          {event.location && <> · in je agenda: {event.location}</>}
        </p>
      </div>

      <div className="grid gap-2">
        {frequentLocations.slice(0, 2).map((l) => (
          <button key={l.shortName} type="button" className={answerClass} onClick={() => answerQuestion(event, { kind: "location", location: l }, remember)}>
            <Icon d={ICONS.recent} />
            <span className="truncate">{l.shortName}</span>
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">vaker gebruikt</span>
          </button>
        ))}
        {settings.office && (
          <button type="button" className={answerClass} onClick={() => answerQuestion(event, { kind: "location", location: settings.office! }, remember)}>
            <Icon d={ICONS.office} />
            Kantoor
            <span className="ml-auto text-xs text-gray-500 truncate">{settings.office.shortName}</span>
          </button>
        )}
        <button type="button" className={answerClass} onClick={() => answerQuestion(event, { kind: "skip" }, remember)}>
          <Icon d={ICONS.none} />
          Geen rit
          <span className="ml-auto text-xs text-gray-500">thuis, online of afgezegd</span>
        </button>
        {!searching ? (
          <button type="button" className={answerClass} onClick={() => setSearching(true)}>
            <Icon d={ICONS.search} />
            Ander adres…
          </button>
        ) : (
          <div className="rounded-lg border border-blue-300 bg-white p-3">
            <LocationInput
              label="Ander adres"
              value={null}
              onChange={(loc) => loc && answerQuestion(event, { kind: "location", location: loc }, remember)}
              homeAddress={homeAddress}
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
        Voortaan automatisch voor &ldquo;{event.title}&rdquo;
      </label>
    </section>
  );
}

export default function QuestionCard({ imp }: { imp: AgendaImport }) {
  const { questions, summary, planned } = imp;
  if (questions.length > 0) {
    // key: bij een nieuwe vraag begint het kaartje opnieuw (checkbox aan, zoekveld dicht)
    return <Question key={questions[0].event.id} imp={imp} item={questions[0]} remaining={questions.length} />;
  }
  if (planned.length === 0) return null;
  return (
    <section className="space-y-1" aria-live="polite">
      <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {summary.count > 0 ? "Je week is klaar" : "Niets te declareren deze week"}
      </h2>
      <p className="text-sm text-gray-600">Klik op een afspraak of rit als je iets wilt aanpassen.</p>
    </section>
  );
}
