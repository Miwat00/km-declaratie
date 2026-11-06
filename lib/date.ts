/** YYYY-MM-DD in de lokale tijdzone (toISOString() geeft UTC en kan een dag verschuiven). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return toLocalISODate(new Date());
}

/** YYYY-MM-DD → DD-MM-YYYY */
export function formatDateNL(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}
