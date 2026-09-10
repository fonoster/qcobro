import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu } from "./helpers.js";

const htmlTheme = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test.describe("profile", () => {
  test("appearance preference: apply, persist, follow the OS, and survive a cache clear", async ({
    page
  }) => {
    const owner = newOwner("appearance");
    await signUpAndEnter(page, owner, `QA Tema ${Date.now()}`);

    await openUserMenu(page, "Mi perfil");
    await expect(page).toHaveURL(/\/profile/);

    const select = page.getByLabel("Apariencia");
    await expect(select).toHaveValue("system");

    // Pin dark: <html data-theme> flips and the page ground goes dark, no reload.
    await select.selectOption("dark");
    await expect.poll(() => htmlTheme(page)).toBe("dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(20, 20, 23)");

    // Persisted: a reload comes back dark.
    await page.reload();
    await expect.poll(() => htmlTheme(page)).toBe("dark");

    // "System" follows the emulated OS setting, live.
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByLabel("Apariencia").selectOption("system");
    await expect.poll(() => htmlTheme(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => htmlTheme(page)).toBe("dark");

    // Back to a hard pin, then prove the *server* is the source of truth: wipe the
    // localStorage cache (as a fresh device would have) and reload — the profile query
    // reconciles the theme back.
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByLabel("Apariencia").selectOption("dark");
    await expect.poll(() => htmlTheme(page)).toBe("dark");
    await page.evaluate(() => localStorage.removeItem("qcobro.theme"));
    await page.reload();
    await expect.poll(() => htmlTheme(page)).toBe("dark");
    await expect(page.getByLabel("Apariencia")).toHaveValue("dark");
  });

  test("open profile, edit name, and delete the account via type-to-confirm", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner("profile");
    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);

    // Reach the profile page from the user menu.
    await openUserMenu(page, "Mi perfil");
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();

    // Email is shown read-only.
    await expect(page.getByLabel("Correo")).toHaveValue(owner.email);

    // Edit the name and save.
    await page.getByLabel("Nombre").fill("QA Renamed Person");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();

    // Delete the account: type-to-confirm gate, then session ends at login.
    await page.getByRole("button", { name: "Eliminar cuenta" }).first().click();
    const confirm = page.getByRole("button", { name: "Eliminar cuenta" }).last();
    await expect(confirm).toBeDisabled();
    await page.getByPlaceholder("ELIMINAR").fill("ELIMINAR");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
