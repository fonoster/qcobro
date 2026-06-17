import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu } from "./helpers.js";

test.describe("profile", () => {
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
