import { describe, expect, it } from "vitest";
import { createBackup, parseBackup, restoreBackup, tripCountOf } from "@/lib/backup";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("backup", () => {
  it("maakt een backup en zet die volledig terug", () => {
    const source = memoryStorage({
      kilometer_trips: JSON.stringify([{ id: "1" }, { id: "2" }]),
      kilometer_rate: "0.25",
      other_app_key: "niet meenemen",
    });
    const text = JSON.stringify(createBackup(source));
    const backup = parseBackup(text);
    expect(tripCountOf(backup)).toBe(2);
    expect(backup.data).not.toHaveProperty("other_app_key");

    const target = memoryStorage({ kilometer_settings: "{\"userName\":\"Oud\"}", kilometer_rate: "0.19" });
    restoreBackup(target, backup);
    expect(target.data.get("kilometer_rate")).toBe("0.25");
    expect(target.data.has("kilometer_settings")).toBe(false); // zat niet in de backup → weg
    expect(JSON.parse(target.data.get("kilometer_trips")!)).toHaveLength(2);
  });

  it("weigert ongeldige bestanden met een duidelijke melding", () => {
    expect(() => parseBackup("geen json")).toThrow(/geen JSON/);
    expect(() => parseBackup(JSON.stringify({ foo: 1 }))).toThrow(/geen backup/);
    expect(() => parseBackup(JSON.stringify({ app: "kilometer-declaraties", version: 99, data: {} }))).toThrow(/nieuwere versie/);
    expect(() =>
      parseBackup(JSON.stringify({ app: "kilometer-declaraties", version: 1, data: { kilometer_trips: "{kapot" } }))
    ).toThrow(/beschadigd/);
    expect(() =>
      parseBackup(JSON.stringify({ app: "kilometer-declaraties", version: 1, data: { evil: "x" } }))
    ).toThrow(/Onbekend/);
  });
});
