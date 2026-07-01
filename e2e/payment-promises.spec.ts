import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Payment Promises worklist golden path: create a portfolio, import one account, seed a
 * VOICE_AI gestión with a PAYMENT_PROMISE outcome (which creates a PaymentPromise), then
 * open the "Promesas de pago" worklist, verify the promise row + KPIs render, and resolve
 * it via the row menu (mark as paid). Assumes the dev stack is running.
 */
test.describe("payment promises — worklist", () => {
  test("seeded promise appears on the worklist and can be marked paid", async ({ page }) => {
    const owner = newOwner("promesas");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    // --- Portfolio + import one account --------------------------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    await page.getByText(portfolioName).click();
    await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
    const portfolioId = page.url().split("/portfolios/")[1];
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    await page.locator('input[type="file"]').setInputFiles(CSV);
    await page.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText("María E2E")).toBeVisible();

    // --- Resolve the account id, seed a PAYMENT_PROMISE gestión via the API --
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
        outcome: "PAYMENT_PROMISE",
        intentMetadata: { promisedAmount: 4820, promisedDate: "2026-12-01T00:00:00.000Z" },
        channelData: { to: "+525500000099", providerRef: `call-${stamp}` }
      }
    });
    expect(res.ok()).toBeTruthy();

    // --- Worklist: row + KPIs render -----------------------------------------
    await page.getByRole("link", { name: "Promesas de pago" }).click();
    await expect(page.getByRole("heading", { name: "Promesas de pago" })).toBeVisible();
    await expect(page.getByText("Pendientes")).toBeVisible();
    const row = page.getByRole("row", { name: /María E2E/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pendiente")).toBeVisible();

    // --- Resolve it via the row menu: mark as paid ---------------------------
    await row.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Marcar pagada" }).click();

    // The promise transitions to MET (shown as "Cumplida").
    await expect(page.getByRole("row", { name: /María E2E/ }).getByText("Cumplida")).toBeVisible();
  });
});
