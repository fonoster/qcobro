import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

/**
 * Campaigns-core happy path: create an agent template, create a DRAFT campaign
 * referencing it (over a portfolio), activate the campaign, and inspect its
 * detail page. Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("campaigns core", () => {
  test("agent template → campaign → activate → detail", async ({ page }) => {
    const owner = newOwner("campaigns");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    const agentName = `Agente Voz ${stamp}`;
    const campaignName = `Campaña ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    // --- A portfolio to target -------------------------------------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await expect(page).toHaveURL(/\/portfolios$/);
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    // --- 11.1 Create a VOICE_AI agent template --------------------------------
    await page.getByRole("link", { name: "Agentes IA" }).click();
    await expect(page).toHaveURL(/\/agent-templates$/);
    await page.getByRole("button", { name: /Nuevo agente/ }).click();
    await page.getByLabel("Nombre del agente").fill(agentName);
    // VOICE_AI is the default type.
    await page.getByLabel("Voz").fill("voice-es-1");
    await page.getByLabel("Prompt del sistema").fill("Sé cordial y claro.");
    await page.getByLabel("Primer mensaje").fill("Hola, le llamo de QCobro.");
    await page.getByLabel("Idioma").fill("es");
    await page.getByRole("button", { name: "Crear agente" }).click();
    await expect(page.getByText(agentName)).toBeVisible();

    // --- 11.2 Create a DRAFT campaign referencing the template ----------------
    await page.getByRole("link", { name: "Campañas" }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await page.getByRole("button", { name: /Nueva campaña/ }).click();
    await page.getByLabel("Nombre de la campaña").fill(campaignName);
    await page.locator("label", { hasText: portfolioName }).getByRole("checkbox").check();
    await page.getByLabel("Plantilla de agente").selectOption({ label: agentName });
    await page.getByLabel("Fecha de inicio").fill("2026-07-01");
    await page.getByRole("button", { name: "Crear campaña" }).click();

    const campaignRow = page.locator("tr", { hasText: campaignName });
    await expect(campaignRow).toBeVisible();
    await expect(campaignRow.getByText("Borrador")).toBeVisible();

    // --- 11.3 Activate the campaign, verify the status badge changes ----------
    await campaignRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(campaignRow.getByText("Activa")).toBeVisible();

    // --- 11.4 Campaign detail shows portfolio + schedule ----------------------
    await campaignRow.getByText(campaignName).click();
    await expect(page).toHaveURL(/\/campaigns\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();
    await expect(page.getByText(portfolioName)).toBeVisible();
    await expect(page.getByText("09:00–18:00")).toBeVisible();
  });
});
