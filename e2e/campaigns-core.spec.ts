import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

/**
 * Campaigns-core happy path: create an agent template, create a campaign (which
 * starts ACTIVE) referencing it over a portfolio, choosing specific days of the
 * week, pause the campaign, and inspect its detail page. Assumes the dev stack
 * is running (see playwright.config.ts).
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

    // --- 11.2 Create a campaign (starts ACTIVE), running Mon + Fri only -------
    await page.getByRole("link", { name: "Campañas" }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await page.getByRole("button", { name: /Nueva campaña/ }).click();
    await page.getByLabel("Nombre de la campaña").fill(campaignName);
    await page.locator("label", { hasText: portfolioName }).getByRole("checkbox").check();
    await page.getByLabel("Plantilla de agente").selectOption({ label: agentName });
    await page.getByLabel("Fecha de inicio").fill("2026-07-01");
    // Days default to weekdays (Lun–Vie); deselect Mar/Mié/Jue → leaves Lun + Vie.
    for (const day of ["Mar", "Mié", "Jue"]) {
      await page.getByRole("button", { name: day, exact: true }).click();
    }
    await page.getByRole("button", { name: "Crear campaña" }).click();

    const campaignRow = page.locator("tr", { hasText: campaignName });
    await expect(campaignRow).toBeVisible();
    // New campaigns start ACTIVE, and the days render humanized.
    await expect(campaignRow.getByText("Activa")).toBeVisible();
    await expect(campaignRow.getByText("Lun, Vie")).toBeVisible();

    // --- 11.3 Pause the campaign, verify the status badge changes -------------
    await campaignRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(campaignRow.getByText("Pausada")).toBeVisible();

    // --- 11.4 Edit the campaign — rename it and add Saturday ----------------
    await campaignRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Editar" }).click();
    const editedName = `${campaignName} (editada)`;
    await page.getByLabel("Nombre de la campaña").fill(editedName);
    // Toggle Saturday on (currently Mon + Fri selected).
    await page.getByRole("button", { name: "Sáb", exact: true }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    const editedRow = page.locator("tr", { hasText: editedName });
    await expect(editedRow).toBeVisible();
    // Mon + Fri + Sat doesn't match a named set → explicit list.
    await expect(editedRow.getByText("Lun, Vie, Sáb")).toBeVisible();

    // --- 11.5 Campaign detail shows portfolio, schedule, and updated days ----
    await editedRow.getByText(editedName).click();
    await expect(page).toHaveURL(/\/campaigns\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { name: editedName })).toBeVisible();
    await expect(page.getByText(portfolioName)).toBeVisible();
    await expect(page.getByText("09:00–18:00")).toBeVisible();
    await expect(page.getByText("Lun, Vie, Sáb")).toBeVisible();
  });
});
