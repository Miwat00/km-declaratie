import { todayLocal } from "./date";

/** Alle localStorage-sleutels van de app. */
export const BACKUP_KEYS = [
  "kilometer_trips",
  "kilometer_rate",
  "kilometer_home_address",
  "kilometer_client_directory",
  "kilometer_settings",
  "kilometer_calendar_url",
] as const;

const APP_ID = "kilometer-declaraties";
const FORMAT_VERSION = 1;

export type Backup = {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  data: Partial<Record<(typeof BACKUP_KEYS)[number], string>>;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createBackup(storage: StorageLike): Backup {
  const data: Backup["data"] = {};
  for (const key of BACKUP_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { app: APP_ID, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Controleert een backupbestand. Gooit een Error met een leesbare melding als het niet klopt. */
export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Dit is geen geldig backupbestand (geen JSON).");
  }
  const b = parsed as Partial<Backup>;
  if (!b || b.app !== APP_ID || typeof b.data !== "object" || b.data === null) {
    throw new Error("Dit bestand is geen backup van Kilometer Declaraties.");
  }
  if (typeof b.version !== "number" || b.version > FORMAT_VERSION) {
    throw new Error("Deze backup is gemaakt met een nieuwere versie van de app.");
  }
  for (const [key, value] of Object.entries(b.data)) {
    if (!(BACKUP_KEYS as readonly string[]).includes(key) || typeof value !== "string") {
      throw new Error(`Onbekend of ongeldig onderdeel in backup: ${key}`);
    }
  }
  const trips = b.data.kilometer_trips;
  if (trips !== undefined) {
    try {
      if (!Array.isArray(JSON.parse(trips))) throw new Error();
    } catch {
      throw new Error("De ritten in deze backup zijn beschadigd.");
    }
  }
  return b as Backup;
}

/** Vervangt alle app-data door de inhoud van de backup. */
export function restoreBackup(storage: StorageLike, backup: Backup): void {
  for (const key of BACKUP_KEYS) {
    const value = backup.data[key];
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, value);
  }
}

export function tripCountOf(backup: Backup): number {
  try {
    return JSON.parse(backup.data.kilometer_trips ?? "[]").length;
  } catch {
    return 0;
  }
}

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(createBackup(localStorage), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kilometer-backup-${todayLocal()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
