import { test, expect, ADDRESSES, shortName } from "./fixtures";

test("eerste bezoek: twee manieren om te beginnen, instellingen met alleen het toetsenbord", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hoe wil je beginnen?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Haal je ritten uit je agenda/ })).toHaveAttribute("href", "/agenda");

  await page.getByRole("button", { name: "Instellingen" }).click();
  const dialog = page.getByRole("dialog", { name: "Instellingen" });
  await expect(dialog.getByLabel("Je naam")).toBeFocused();
  await page.keyboard.type("Sam Tester");

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

  await dialog.getByLabel("Tarief per km").fill("0,25");
  await dialog.getByRole("button", { name: "Opslaan" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("kilometer_rate"))).toBe("0.25");

  // Het formulier kent nu naam, thuis en kantoor
  await page.getByRole("button", { name: /^Voeg een rit toe/ }).click();
  const form = page.getByRole("form", { name: "Rit toevoegen" });
  await expect(form.getByLabel("Naam")).toHaveValue("Sam Tester");
  await expect(form.getByRole("combobox", { name: "Van" })).toHaveValue(shortName(ADDRESSES.home));
  await expect(form.getByRole("button", { name: "Kantoor" })).toHaveCount(2);
});

test("instellingen sluiten met Escape geeft de focus terug", async ({ page }) => {
  await page.goto("/");
  const gear = page.getByRole("button", { name: "Instellingen" });
  await gear.click();
  const dialog = page.getByRole("dialog", { name: "Instellingen" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
});

test("alle gegevens wissen", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("kilometer_trips", "[]");
    localStorage.setItem("kilometer_calendar_url", "https://outlook.office365.com/x.ics");
  });
  await page.getByRole("button", { name: "Instellingen" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Alle gegevens wissen…" }).click();
  await expect(page.getByRole("heading", { name: "Hoe wil je beginnen?" })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("kilometer_")))).toEqual([]);
});
