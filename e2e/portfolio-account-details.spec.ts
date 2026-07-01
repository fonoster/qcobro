import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");

/**
 * Portfolio account detail golden path: import an account, open its "Ver detalle"
 * dialog, confirm the basic fields render and "Ver metadata" is collapsed by default,
 * then expand it and confirm it reveals record fields not shown in the basic summary.
 * Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("portfolio account details", () => {
  test("Ver detalle dialog shows basics + collapsed Ver metadata with the rest of the record", async ({
    page
  }) => {
    const owner = newOwner("account-details");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    await page.getByText(portfolioName).click();
    await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    await page.locator('input[type="file"]').setInputFiles(CSV);
    await page.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText("María E2E")).toBeVisible();

    const accountRow = page.locator("tr", { hasText: "María E2E" });
    await accountRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Ver detalle" }).click();

    await expect(page.getByRole("heading", { name: "María E2E" })).toBeVisible();

    // Basic fields are visible in the dialog (last match — the table row has the same
    // balance/phone as subtext); "Ver metadata" is present but collapsed.
    await expect(page.getByText(/^4800/).last()).toBeVisible();
    await expect(page.getByText("+17853178070").last()).toBeVisible();
    const viewMore = page.getByRole("button", { name: "Ver metadata" });
    await expect(viewMore).toBeVisible();
    await expect(page.getByText(/"principalAmount"/)).not.toBeVisible();

    // Expanding reveals record fields not in the basic summary.
    await viewMore.click();
    await expect(page.getByText(/"missedInstallments"/)).toBeVisible();
  });
});
