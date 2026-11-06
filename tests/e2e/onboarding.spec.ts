import { test, expect, ADDRESSES, shortName } from "./fixtures";

test("eerste bezoek: instellingen invullen, alleen met het toetsenbord", async ({ page }) => {
  await page.goto("/");

  const dialog = page.getByRole("dialog", { name: "Instellingen" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Je naam")).toBeFocused();

  await page.keyboard.type("Sam Tester");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Voorbeeld BV");

  // Thuisadres kiezen met pijltje + Enter
  const home = dialog.getByRole("combobox", { name: "Thuisadres" });
  await home.focus();
  await page.keyboard.type("Dam 1, Amsterdam");
  await expect(dialog.getByRole("option", { name: new RegExp(shortName(ADDRESSES.home)) })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(home).toHaveValue(shortName(ADDRESSES.home));
  await expect(dialog).toBeVisible(); // Enter in de lijst verstuurt het formulier niet

  // Escape in een open lijst sluit alleen de lijst
  const office = dialog.getByRole("combobox", { name: "Kantooradres" });
  await office.focus();
  await page.keyboard.type("Coolsingel 40, Rotterdam");
  await expect(office).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(office).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(office).toHaveValue(shortName(ADDRESSES.office));

  await dialog.getByRole("button", { name: "Opslaan" }).click();
  await expect(dialog).toBeHidden();

  // Naam staat klaar en de snelknoppen voor thuis en kantoor verschijnen
  const form = page.locator("#trip-form");
  await expect(form.getByLabel("Je naam")).toHaveValue("Sam Tester");
  await expect(form.getByRole("button", { name: "Thuis" })).toHaveCount(2);
  await expect(form.getByRole("button", { name: "Kantoor" })).toHaveCount(2);
});

test("instellingen sluiten met Escape geeft de focus terug", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Instellingen" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const gear = page.getByRole("button", { name: "Instellingen" });
  await gear.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();
});
