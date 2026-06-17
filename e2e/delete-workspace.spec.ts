import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu } from "./helpers.js";

test.describe("delete workspace", () => {
  test("owner deletes a workspace via type-to-confirm", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner("del");
    await signUpAndEnter(page, owner, `QA Del ${unique}`);

    await openUserMenu(page, "Configuración del espacio");
    await expect(page).toHaveURL(/\/settings/);

    // Owner sees the Danger Zone.
    await expect(page.getByRole("heading", { name: "Eliminar espacio" })).toBeVisible();

    // Open the delete dialog from the danger card (the first matching button).
    await page.getByRole("button", { name: "Eliminar espacio" }).first().click();

    // The destructive confirm button is disabled until ELIMINAR is typed.
    const confirm = page.getByRole("button", { name: "Eliminar espacio" }).last();
    await expect(confirm).toBeDisabled();
    await page.getByPlaceholder("ELIMINAR").fill("ELIMINAR");
    await expect(confirm).toBeEnabled();

    // Confirm → only workspace removed → routed back to workspace creation.
    await confirm.click();
    await expect(page).toHaveURL(/\/create-workspace/);
  });
});
