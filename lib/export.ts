import type { Trip } from "./types";
import { formatDateNL, todayLocal } from "./date";

const nl = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

/** Tarief van een rit; oudere ritten (vóór v2.1) hebben geen opgeslagen tarief. */
export function tripRate(t: Trip): number {
  if (typeof t.rate === "number") return t.rate;
  return t.distanceKm > 0 ? Math.round((t.amount / t.distanceKm) * 100) / 100 : 0;
}

export function totals(trips: Trip[]): { km: number; amount: number } {
  return {
    km: trips.reduce((s, t) => s + t.distanceKm, 0),
    amount: trips.reduce((s, t) => s + t.amount, 0),
  };
}

/** CSV met ; als scheidingsteken en komma-decimalen, zodat Excel (NL) het direct goed opent. */
export function buildCsv(trips: Trip[]): string {
  const header = [
    "Datum", "Naam", "Doel van de rit", "Klant / project", "Doorbelasten",
    "Startpunt", "Eindpunt", "Kilometer", "Tarief (€/km)", "Bedrag (€)",
  ];
  const rows = [...trips]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      formatDateNL(t.date), t.name, t.purpose, t.client, t.billable ? "Ja" : "Nee",
      t.locationA.shortName, t.locationB.shortName,
      nl(t.distanceKm, 1), nl(tripRate(t), 2), nl(t.amount, 2),
    ]);
  const sum = totals(trips);
  rows.push(["Totaal", "", "", "", "", "", "", nl(sum.km, 1), "", nl(sum.amount, 2)]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

function csvBlob(trips: Trip[]): Blob {
  return new Blob(["﻿" + buildCsv(trips)], { type: "text/csv;charset=utf-8;" });
}

function csvFileName(): string {
  return `kilometer-declaratie-${todayLocal()}.csv`;
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToCsv(trips: Trip[]): void {
  download(csvBlob(trips), csvFileName());
}

export function buildEmail(trips: Trip[]): { subject: string; body: string } {
  const dates = trips.map((t) => t.date).sort();
  const vanDatum = formatDateNL(dates[0]);
  const totDatum = formatDateNL(dates[dates.length - 1]);
  const periodeLabel = vanDatum === totDatum ? vanDatum : `${vanDatum} t/m ${totDatum}`;

  const namen = [...new Set(trips.map((t) => t.name))];
  const namenLabel = namen.join(", ");
  const sum = totals(trips);

  const subject = `Kilometerdeclaratie ${namenLabel} — ${periodeLabel}`;
  const body = `Beste,

Hierbij mijn kilometerdeclaratie voor de periode ${periodeLabel}.

Naam:              ${namenLabel}
Periode:           ${periodeLabel}
Aantal ritten:     ${trips.length}
Totaal kilometers: ${nl(sum.km, 1)} km
Totaal bedrag:     € ${nl(sum.amount, 2)}

Met vriendelijke groet,
${namen[0]}`;
  return { subject, body };
}

/** Mailt de declaratie: op mobiel als bijlage via het deelmenu, anders CSV downloaden en je mailprogramma openen. */
export async function emailDeclaratie(trips: Trip[], to = ""): Promise<void> {
  const { subject, body } = buildEmail(trips);
  const blob = csvBlob(trips);
  const fileName = csvFileName();

  // Optie A: Web Share API (mobiel — deelt de CSV als echte bijlage)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: "text/csv" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subject, text: body });
        return;
      } catch {
        // Geannuleerd of mislukt — val terug op optie B
      }
    }
  }

  // Optie B: CSV downloaden + mailto openen met samenvatting
  download(blob, fileName);
  setTimeout(() => {
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, 500);
}
