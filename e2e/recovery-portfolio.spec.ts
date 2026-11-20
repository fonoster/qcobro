import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

// The shared fixture has no missed_installments column, so it drives the missing-column warning.
const CSV_WITHOUT_MISSED = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "accounts.csv"
);
const API = "http://localhost:3000";

/** One overdue account at RD$ 2,500 per installment with `missed` installments overdue. */
function accountsFile(missed: number) {
  return {
    name: `cartera-${missed}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(
      "loan_id,full_name,phone_number,outstanding_balance,days_past_due,terms_amount,missed_installments\n" +
        `FT-REC-1,Ana E2E,+17853178070,10000,40,2500,${missed}\n`
    )
  };
}

/**
 * Portfolio recovery golden path (#210): the import modal defaults to "Agregar y actualizar"
 * and warns when a mode or a file can't detect payments; a second import with fewer missed
 * installments shows "Pagos detectados" with the partial recovery. (The per-cartera
 * Recuperación section is no longer rendered: #250.) Assumes the dev stack is running.
 */
test.describe("portfolio recovery", () => {
  test("an import that lowers missed_installments shows up as a partial recovery", async ({
    page
  }) => {
    const owner = newOwner("recovery");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    await page.getByRole("link", { name: "Carteras" }).click();
    await page
      .getByRole("button", { name: /Nueva cartera/ })
      .first()
      .click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await page.getByText(portfolioName).click();
    await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
    const portfolioId = page.url().split("/portfolios/")[1];

    // --- Import modal: default mode, the APPEND_ONLY warning, the missing column ---------
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    // The import modal has no dialog role, so its controls are found on the page.
    const dialog = page;
    const appendOnlyWarning = dialog.getByText(
      "Este modo no actualiza cuentas existentes: no se detectarán pagos."
    );
    await expect(dialog.getByRole("radio", { name: /Agregar y actualizar/ })).toBeChecked();
    await expect(appendOnlyWarning).toHaveCount(0);
    await dialog.getByRole("radio", { name: /Solo agregar nuevas/ }).check();
    await expect(appendOnlyWarning).toBeVisible();
    await dialog.getByRole("radio", { name: /Agregar y actualizar/ }).check();
    await expect(appendOnlyWarning).toHaveCount(0);

    const missingColumn = dialog.getByText(
      "Falta la columna missed_installments: no se detectarán pagos parciales en este archivo."
    );
    await page.locator('input[type="file"]').setInputFiles(CSV_WITHOUT_MISSED);
    await expect(missingColumn).toBeVisible();

    // --- First sync: 3 installments overdue. Nothing to detect yet. --------------------
    await page.locator('input[type="file"]').setInputFiles(accountsFile(3));
    await expect(missingColumn).toHaveCount(0);
    await dialog.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await expect(dialog.getByText("Importación completada")).toBeVisible();
    await expect(dialog.getByText("Pagos detectados", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();

    // --- A gestión between the two syncs ------------------------------------------------
    const auth = await page.evaluate(() => ({
      token: localStorage.getItem("accessToken"),
      workspace: localStorage.getItem("workspace")
    }));
    const headers = { Authorization: `Bearer ${auth.token}`, "x-workspace": auth.workspace ?? "" };
    const input = encodeURIComponent(JSON.stringify({ 0: { portfolioId, limit: 50, offset: 0 } }));
    const listRes = await page.request.get(`/trpc/portfolios.listAccounts?batch=1&input=${input}`, {
      headers
    });
    const listData = (await listRes.json())[0].result.data;
    const accountId = (listData.json ?? listData).items[0].id as string;
    const res = await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: accountId,
        agentType: "VOICE_AI",
        contactedAt: new Date().toISOString(),
        delivery: "DELIVERED",
        path: "ENGAGED",
        outcome: "CALLBACK_REQUESTED",
        channelData: { to: "+17853178070", providerRef: `call-${stamp}` }
      }
    });
    expect(res.ok()).toBeTruthy();

    // --- Second sync: 1 installment overdue, so 2 × 2,500 were paid -------------------
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    await page.locator('input[type="file"]').setInputFiles(accountsFile(1));
    await dialog.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await expect(dialog.getByText("Pagos detectados", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/5,000.* · 1 cuenta$/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();

    // --- The console never mentions exits ----------------------------------------------
    await expect(page.getByText(/salida/i)).toHaveCount(0);
  });
});
