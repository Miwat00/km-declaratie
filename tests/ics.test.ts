import { describe, expect, it } from "vitest";
import { expandRRule, parseDateTime, parseIcs } from "@/lib/ics";

const cal = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const ev = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("parseDateTime", () => {
  it("rekent UTC om naar lokale tijd (wintertijd)", () => {
    expect(parseDateTime("20250310T090000Z")).toEqual({ date: "2025-03-10", time: "10:00" });
  });
  it("rekent UTC om naar lokale tijd (zomertijd)", () => {
    expect(parseDateTime("20250610T090000Z")).toEqual({ date: "2025-06-10", time: "11:00" });
  });
  it("schuift naar de volgende dag als UTC net voor middernacht valt", () => {
    expect(parseDateTime("20250610T223000Z")).toEqual({ date: "2025-06-11", time: "00:30" });
  });
  it("laat zwevende/TZID-tijden ongemoeid", () => {
    expect(parseDateTime("20250310T090000")).toEqual({ date: "2025-03-10", time: "09:00" });
  });
  it("herkent hele-dag-datums", () => {
    expect(parseDateTime("20250310")).toEqual({ date: "2025-03-10" });
  });
});

describe("expandRRule", () => {
  it("wekelijks op meerdere dagen met COUNT", () => {
    expect(expandRRule("2025-03-03", "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4")).toEqual([
      "2025-03-03", "2025-03-05", "2025-03-10", "2025-03-12",
    ]);
  });
  it("om de week tot UNTIL", () => {
    expect(expandRRule("2025-03-04", "FREQ=WEEKLY;INTERVAL=2;UNTIL=20250401T215959Z")).toEqual([
      "2025-03-04", "2025-03-18", "2025-04-01",
    ]);
  });
  it("dagelijks over de zomertijdwissel heen", () => {
    expect(expandRRule("2025-03-30", "FREQ=DAILY;COUNT=3")).toEqual(["2025-03-30", "2025-03-31", "2025-04-01"]);
  });
  it("maandelijks op dezelfde dag", () => {
    expect(expandRRule("2025-01-15", "FREQ=MONTHLY;COUNT=3")).toEqual(["2025-01-15", "2025-02-15", "2025-03-15"]);
  });
  it("niet-ondersteunde frequentie geeft alleen de startdatum", () => {
    expect(expandRRule("2025-01-15", "FREQ=YEARLY;COUNT=3")).toEqual(["2025-01-15"]);
  });
});

describe("parseIcs", () => {
  it("leest titel, tijden, locatie met escapes en gevouwen regels", () => {
    const events = parseIcs(cal(ev(
      "UID:1",
      "SUMMARY:Overleg klant\\, fase 2",
      "DTSTART;TZID=W. Europe Standard Time:20250310T090000",
      "DTEND;TZID=W. Europe Standard Time:20250310T100000",
      "LOCATION:Coolsingel 40\\, ",
      " Rotterdam",
    )));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Overleg klant, fase 2",
      date: "2025-03-10",
      startTime: "09:00",
      endTime: "10:00",
      location: "Coolsingel 40, Rotterdam",
    });
  });

  it("negeert VALARM-velden binnen een event", () => {
    const events = parseIcs(cal(ev(
      "UID:1", "SUMMARY:Bezoek", "DTSTART:20250310T090000",
      "BEGIN:VALARM", "DESCRIPTION:Herinnering", "TRIGGER:-PT15M", "END:VALARM",
    )));
    expect(events.map((e) => e.title)).toEqual(["Bezoek"]);
  });

  it("vouwt terugkerende afspraken uit, met EXDATE en een verplaatst exemplaar", () => {
    const events = parseIcs(cal(
      ev("UID:reeks", "SUMMARY:Weekstart", "DTSTART:20250303T090000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4", "EXDATE:20250310T090000"),
      ev("UID:reeks", "RECURRENCE-ID:20250317T090000", "SUMMARY:Weekstart (verplaatst)",
        "DTSTART:20250318T140000"),
    ));
    expect(events.map((e) => `${e.date} ${e.startTime} ${e.title}`)).toEqual([
      "2025-03-03 09:00 Weekstart",
      "2025-03-18 14:00 Weekstart (verplaatst)",
      "2025-03-24 09:00 Weekstart",
    ]);
  });

  it("rekent een UTC-reeks per exemplaar om (zomertijd → wintertijd)", () => {
    const events = parseIcs(cal(
      ev("UID:r", "SUMMARY:Kantoordag", "DTSTART:20251020T080000Z", "RRULE:FREQ=WEEKLY;COUNT=2"),
    ));
    expect(events.map((e) => `${e.date} ${e.startTime}`)).toEqual([
      "2025-10-20 10:00", // CEST
      "2025-10-27 09:00", // CET
    ]);
  });

  it("slaat geannuleerde afspraken over", () => {
    const events = parseIcs(cal(
      ev("UID:1", "SUMMARY:Gaat niet door", "DTSTART:20250310T090000", "STATUS:CANCELLED"),
      ev("UID:2", "SUMMARY:Gaat wel door", "DTSTART:20250310T110000"),
    ));
    expect(events.map((e) => e.title)).toEqual(["Gaat wel door"]);
  });
});
