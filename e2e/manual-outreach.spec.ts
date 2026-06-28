import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");

/**
 * Manual outreach golden path: create an SMS agent, import an account, then open the
 * customer row's ⋯ "Contactar manualmente" modal and verify it requires an agent (no
 * campaign) and shows the channel + a rendered preview. Stops short of sending (live
 * dispatch is covered by unit tests + manual smoke tests). Assumes the dev stack is
 * running (see playwright.config.ts).
 */
test.describe("manual outreach", () => {
  test("⋯ Contactar manualmente — agent required, channel + preview shown", async ({ page }) => {
    const owner = newOwner("manual-outreach");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    const agentName = `Recordatorio ${stamp}`;
    const body = "Hola {{firstName}}, su saldo es {{outstandingBalance}}.";

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    // --- Portfolio -----------------------------------------------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    // --- SMS agent (fast; no Fonoster sync) ----------------------------------
    await page.getByRole("link", { name: "Agentes IA" }).click();
    await page.getByRole("button", { name: /Nuevo agente/ }).click();
    await page.getByLabel("Nombre del agente").fill(agentName);
    await page.getByLabel("Tipo de canal").selectOption({ label: "SMS" });
    await page.getByLabel("Cuerpo del mensaje").fill(body);
    await page.getByLabel(/ID de remitente/).fill("MIKRO");
    await page.getByRole("button", { name: "Crear agente" }).click();
    await expect(page.getByText(agentName)).toBeVisible();

    // --- Import one account into the portfolio -------------------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByText(portfolioName).click();
    await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    await page.locator('input[type="file"]').setInputFiles(CSV);
    await page.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText("María E2E")).toBeVisible();

    // --- ⋯ → Contactar manualmente (agent-based, no campaign) ----------------
    const accountRow = page.locator("tr", { hasText: "María E2E" });
    await accountRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Contactar manualmente" }).click();

    // An agent is required (no campaign); selecting it shows the channel + preview.
    await page.getByLabel("Agente").selectOption({ label: agentName });
    await expect(page.getByText(/Se enviará por SMS/)).toBeVisible();
    await expect(page.getByText("Hola María, su saldo es 4800.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Contactar", exact: true })).toBeVisible();
  });
});
