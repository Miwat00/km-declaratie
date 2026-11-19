import { describe, expect, it } from "vitest";
import { buildShortName } from "@/lib/nominatim";

const result = (address: Record<string, string>, display_name = "x") => ({ display_name, address });

describe("buildShortName", () => {
  it("geeft het volledige adres zoals een kaartenapp: straat nummer, postcode plaats", () => {
    expect(buildShortName(result({ road: "Tuinstraat", house_number: "3", postcode: "2514BX", city: "Den Haag" }))).toBe(
      "Tuinstraat 3, 2514 BX Den Haag"
    );
  });
  it("laat een postcode met spatie zoals hij is", () => {
    expect(buildShortName(result({ road: "Coolsingel", house_number: "40", postcode: "3011 AD", city: "Rotterdam" }))).toBe(
      "Coolsingel 40, 3011 AD Rotterdam"
    );
  });
  it("werkt ook zonder huisnummer of postcode", () => {
    expect(buildShortName(result({ road: "Dam", town: "Amsterdam" }))).toBe("Dam, Amsterdam");
  });
  it("valt terug op het eerste deel van de naam als er geen straat is", () => {
    expect(buildShortName(result({ postcode: "3521 AL", city: "Utrecht" }, "Jaarbeurs, Utrecht, Nederland"))).toBe(
      "Jaarbeurs, 3521 AL Utrecht"
    );
  });
});
