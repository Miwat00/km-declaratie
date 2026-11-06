import { describe, expect, it } from "vitest";
import { formatKm, parseKm } from "@/lib/format";

describe("parseKm", () => {
  it.each([
    ["78,6", 78.6],
    ["78.6", 78.6],
    [" 12 ", 12],
    ["12,34", 12.3],
    ["1 200", 1200],
  ])("%s → %s", (input, expected) => {
    expect(parseKm(input)).toBe(expected);
  });

  it.each(["", "0", "0,0", "-5", "abc", "12,", "12km", "5000"])("weigert %j", (input) => {
    expect(parseKm(input)).toBeNull();
  });
});

describe("formatKm", () => {
  it("gebruikt een komma en één decimaal", () => {
    expect(formatKm(78.64)).toBe("78,6");
    expect(formatKm(12)).toBe("12,0");
  });
});
