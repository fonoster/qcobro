import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

/**
 * Console-refinements golden path: create a VOICE_AI agent WITHOUT a first message
 * (now optional), run a campaign over a portfolio, then archive it from the list row
 * menu and restore it — restoring returns the campaign to PAUSED. Assumes the dev
 * stack is running (see playwright.config.ts).
 */
test.describe("console refinements", () => {
  test("optional first message → archive → restore campaign", async ({ page }) => {
    const owner = newOwner("refine");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    const agentName = `Agente ${stamp}`;
    const campaignName = `Campaña ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    // A portfolio to target.
    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    // VOICE_AI agent with NO first message — the field is now optional.
    await page.getByRole("link", { name: "Agentes IA" }).click();
    await page.getByRole("button", { name: /Nuevo agente/ }).click();
    await page.getByLabel("Nombre del agente").fill(agentName);
    await page.getByLabel("Idioma").selectOption("es");
    await page.getByLabel("Voz").selectOption({ label: "Sofía (es, femenina)" });
    // Deliberately leave "Primer mensaje" empty.
    await page.getByLabel("Prompt del sistema").fill("Sé cordial y claro.");
    await page.getByRole("button", { name: "Crear agente" }).click();
    await expect(page.getByText(agentName)).toBeVisible({ timeout: 25000 });

    // A campaign (starts ACTIVE) over the portfolio.
    await page.getByRole("link", { name: "Campañas" }).click();
    await page.getByRole("button", { name: /Nueva campaña/ }).click();
    await page.getByLabel("Nombre de la campaña").fill(campaignName);
    await page.locator("label", { hasText: portfolioName }).getByRole("checkbox").check();
    await page.getByLabel("Plantilla de agente").selectOption({ label: agentName });
    await page.getByLabel("Fecha de inicio").fill("2026-07-01");
    await page.getByRole("button", { name: "Crear campaña" }).click();

    const row = page.locator("tr", { hasText: campaignName });
    await expect(row).toBeVisible();
    await expect(row.getByText("Activa")).toBeVisible();

    // Archive from the row-actions menu — the campaign leaves the default view.
    await row.getByRole("button").last().click();
    await page.getByRole("button", { name: "Archivar" }).click();
    await expect(page.locator("tr", { hasText: campaignName })).toHaveCount(0);

    // Filtering by "Archivadas" reveals it with the Archivada badge.
    await page.getByRole("combobox").selectOption({ label: "Archivadas" });
    const archivedRow = page.locator("tr", { hasText: campaignName });
    await expect(archivedRow.getByText("Archivada")).toBeVisible();

    // Restore — the campaign returns to PAUSED (never auto-resumes dispatch).
    await archivedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Restaurar" }).click();
    await page.getByRole("combobox").selectOption({ label: "Todas (no archivadas)" });
    const restoredRow = page.locator("tr", { hasText: campaignName });
    await expect(restoredRow.getByText("Pausada")).toBeVisible();
  });
});
