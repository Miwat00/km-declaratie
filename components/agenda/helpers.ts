import { toLocalISODate } from "@/lib/date";
import type { GeneratedTrip } from "@/lib/tripGenerator";

export function getWeekRange(offset = 0): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayDiff + offset * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    from: toLocalISODate(monday),
    to: toLocalISODate(friday),
  };
}

export function groupByDate(trips: GeneratedTrip[]): Map<string, GeneratedTrip[]> {
  const map = new Map<string, GeneratedTrip[]>();
  for (const t of trips) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return map;
}
