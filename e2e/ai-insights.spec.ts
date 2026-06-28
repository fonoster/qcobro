import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * AI-insight on-open path: seed a Voz IA gestión that has a transcript but NO analysis,
 * open it, and assert the detail renders the transcript and an "Análisis IA" section in a
 * valid state — analysis, "generando…", or "pendiente" depending on whether the deployment
 * has `ai.enabled`. The generation/caching/gating logic itself is covered by unit tests.
 * Assumes the dev stack is running.
 */
test.describe("ai-insights", () => {
  test("Voz IA gestión without analysis renders the on-open analysis section", async ({ page }) => {
    const owner = newOwner("ai-insights");
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
    const portfolioId = page.url().split("/portfolios/")[1];
    await page.getByRole("button", { name: "Importar cuentas" }).click();
    await page.locator('input[type="file"]').setInputFiles(CSV);
    await page.getByRole("button", { name: "Importar 1 cuentas" }).click();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText("María E2E")).toBeVisible();

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

    // Voz IA gestión WITH a transcript but NO aiSummary → eligible for on-open analysis.
    await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: accountId,
        agentType: "VOICE_AI",
        contactedAt: new Date().toISOString(),
        outcome: "OTHER",
        notes: "Seed",
        channelData: {
          providerRef: `voz-${stamp}`,
          recordingUrl: "https://rec.example/x.wav",
          transcript: [
            { role: "agent", text: "Buenas tardes, le llamo de QCobro." },
            { role: "customer", text: "Sí, dígame." }
          ]
        }
      }
    });

    await page.getByRole("link", { name: "Gestiones" }).click();
    // The gestión was seeded out-of-band (API); reload so the list query fetches it
    // (the in-memory cache has staleTime 30s and wouldn't know about the out-of-band write).
    await page.reload();
    await page.locator("tr", { hasText: "Voz IA" }).first().click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Transcripción")).toBeVisible();

    // The analysis section shows a valid state regardless of whether ai is enabled.
    await expect(
      panel.getByText(/Análisis IA pendiente|Generando análisis IA|reconoce|cliente/i).first()
    ).toBeVisible();
  });
});
