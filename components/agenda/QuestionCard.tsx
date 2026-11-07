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
const HOME_ICON = "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6";
const CAR_ICON = "M5 17h14M6 17l1.5-6h9L18 17M8 17v2m8-2v2M7.5 11l1-3h7l1 3";
const TRAIN_ICON = "M8 17l-2 4m10-4l2 4M7 3h10a2 2 0 012 2v8a4 4 0 01-4 4H9a4 4 0 01-4-4V5a2 2 0 012-2zm-2 8h14M9 14h.01M15 14h.01";
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
  const [remember, setRemember] = useState(false);
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

/** Per dag: "Hoe zag dinsdag eruit?" Eén antwoord regelt alle afspraken van die dag. */
function DayQuestion({ imp, date, remaining }: { imp: AgendaImport; date: string; remaining: number }) {
  const { planned, setDayMode, settings } = imp;
  const titles = planned.filter((p) => p.event.date === date).map((p) => p.event.title);
  const answers: { text: string; sub: string; icon: string; place: "thuis" | "kantoor" | "pad"; transport: "auto" | "ov" }[] = [
    { text: "Thuis gewerkt", sub: "geen ritten", icon: HOME_ICON, place: "thuis", transport: "auto" },
    ...(settings.office
      ? [
          { text: "Op kantoor, met de auto", sub: "thuis → kantoor → thuis", icon: ICONS.office, place: "kantoor" as const, transport: "auto" as const },
          { text: "Op kantoor, met het OV", sub: "geen ritten", icon: TRAIN_ICON, place: "kantoor" as const, transport: "ov" as const },
        ]
      : []),
    { text: "Op pad, met de auto", sub: "per afspraak de plek kiezen", icon: CAR_ICON, place: "pad", transport: "auto" },
  ];
  return (
    <section aria-labelledby="question-title" className="space-y-3">
      <p className="text-sm text-gray-600">
        {remaining === 1 ? "Nog 1 vraag, daarna is je week klaar" : `Nog ${remaining} vragen, daarna is je week klaar`}
      </p>
      <div>
        <h2 id="question-title" className="text-base font-semibold text-gray-900">Hoe zag {longDate(date).toLowerCase()} eruit?</h2>
        <p className="text-sm text-gray-600 truncate">In je agenda: {titles.join(", ")}</p>
      </div>
      <div className="grid gap-2">
        {answers.map((a) => (
          <button key={a.text} type="button" className={answerClass} onClick={() => setDayMode(date, { place: a.place, transport: a.transport })}>
            <Icon d={a.icon} />
            {a.text}
            <span className="ml-auto text-xs text-gray-500 text-right">{a.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function QuestionCard({ imp }: { imp: AgendaImport }) {
  const { questions, dayQuestions, summary, planned } = imp;
  const remaining = dayQuestions.length + questions.length;
  if (dayQuestions.length > 0) {
    return <DayQuestion key={dayQuestions[0]} imp={imp} date={dayQuestions[0]} remaining={remaining} />;
  }
  if (questions.length > 0) {
    // key: bij een nieuwe vraag begint het kaartje opnieuw (checkbox uit, zoekveld dicht)
    return <Question key={questions[0].event.id} imp={imp} item={questions[0]} remaining={remaining} />;
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
