/** 78.6 → "78,6" */
export function formatKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

const MAX_KM = 2000;

/**
 * Leest een door de gebruiker ingevulde afstand: "78,6", "78.6" of "78".
 * Geeft null bij lege, ongeldige, nul/negatieve of onrealistisch grote waarden.
 */
export function parseKm(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const km = Math.round(parseFloat(s) * 10) / 10;
  return km > 0 && km <= MAX_KM ? km : null;
}
