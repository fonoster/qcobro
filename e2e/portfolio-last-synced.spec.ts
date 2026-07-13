import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");

/**
 * Portfolio list "last synced" golden path: a freshly created portfolio shows the
 * "Nunca sincronizada" placeholder, and syncing a CSV from the list's row action
 * replaces it with a timestamp. Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("portfolio last synced column", () => {
  test("shows never-synced placeholder, then a timestamp after a CSV sync", async ({ page }) => {
    const owner = newOwner("last-synced");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    const row = page.locator("tr", { hasText: portfolioName });
    await expect(row.getByText("Nunca sincronizada")).toBeVisible();

    await row.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Sincronizar CSV" }).click();
    await page.getByRole("button", { name: "Seleccionar archivo" }).click();
    await page.locator('input[type="file"]').setInputFiles(CSV);
    await page.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await expect(page.getByText("Importación completada")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar" }).click();

    await expect(row.getByText("Nunca sincronizada")).not.toBeVisible();
  });
});
