import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu } from "./helpers.js";

test.describe("API keys", () => {
  test("owner can create, regenerate, and delete a key", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner();

    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);
    await openUserMenu(page, "Claves de API");

    // Page + empty state.
    await expect(page.getByRole("heading", { name: "Claves de API" })).toBeVisible();
    await expect(page.getByText("Aún no tienes claves de API.")).toBeVisible();

    // Create a key with the default role and no expiry.
    await page.getByRole("button", { name: "Nueva clave" }).click();
    await expect(page.getByRole("heading", { name: "Crear clave de API" })).toBeVisible();
    await page.getByRole("button", { name: "Crear clave" }).click();

    // Secret is shown exactly once.
    await expect(page.getByRole("heading", { name: "Copia tu secreto de API" })).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();

    // The new key now appears as a row (access key ids are prefixed by Identity).
    const keyCode = page.locator("table code").first();
    await expect(keyCode).toBeVisible();
    const accessKeyId = (await keyCode.textContent())?.trim() ?? "";
    expect(accessKeyId.length).toBeGreaterThan(0);

    // Regenerate → warning confirm → secret shown again.
    await page.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Regenerar" }).click();
    await expect(page.getByRole("heading", { name: "¿Regenerar esta clave?" })).toBeVisible();
    await page.getByRole("button", { name: "Regenerar" }).last().click();
    await expect(page.getByRole("heading", { name: "Copia tu secreto de API" })).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();

    // Delete → type-to-confirm → row disappears.
    await page.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: "¿Eliminar esta clave de API?" })).toBeVisible();
    await page.getByPlaceholder("CONFIRMAR").fill("CONFIRMAR");
    await page.getByRole("button", { name: "Eliminar" }).last().click();
    await expect(page.getByText("Aún no tienes claves de API.")).toBeVisible();
  });
});
