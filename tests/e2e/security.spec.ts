import { test, expect, seed, DEFAULT_SEED } from "./fixtures";

test("beveiligingsheaders worden meegestuurd", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});

test("de app werkt binnen de Content Security Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });

  await seed(page, DEFAULT_SEED);
  const form = page.locator("#trip-form");
  await form.getByRole("button", { name: "Thuis" }).first().click();
  await form.getByRole("button", { name: "Kantoor" }).nth(1).click();
  await expect(form.getByLabel("Afstand")).not.toHaveValue("");
  await page.goto("/agenda");
  await expect(page.getByRole("heading", { name: "Ritten uit je agenda" })).toBeVisible();

  expect(violations).toEqual([]);
});
