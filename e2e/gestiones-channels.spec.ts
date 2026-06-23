import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Gestiones golden path for the one-way channels: create a portfolio, import one
 * account, seed SMS / Pre-grabada / Email gestiones via the (dev-open) contact-log
 * REST endpoint, then verify the refined Gestiones list and the channel-aware detail
 * slide-over panel for each (sent content shown; no audio/transcript). Live dispatch
 * is intentionally not exercised. Assumes the dev stack is running.
 */
test.describe("gestiones — one-way channels", () => {
  test("list + channel-aware detail panel for SMS, Pre-grabada, Email", async ({ page }) => {
    const owner = newOwner("gestiones-ch");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    const smsBody = "Hola María, su saldo pendiente es de $4,800. Pague en qcobro.mx/pagar.";
    const script = "Estimado cliente, le recordamos que su cuenta tiene un saldo pendiente.";
    const emailBody = "Estimada María, le recordamos su saldo pendiente. Atentamente, QCobro.";

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

    // --- Resolve the account id, seed three gestiones via the API ------------
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

    const seeds = [
      {
        agentType: "SMS",
        aiSummary: "Recordatorio de pago enviado al cliente con enlace de pago en línea.",
        channelData: { to: "+525500000000", messageBody: smsBody }
      },
      {
        agentType: "VOICE_PRERECORDED",
        durationSeconds: 38,
        channelData: { to: "+525500000001", messageBody: script }
      },
      {
        agentType: "EMAIL",
        channelData: {
          to: "maria@example.com",
          subject: "Recordatorio de pago",
          messageBody: emailBody
        }
      }
    ];
    for (const s of seeds) {
      const res = await page.request.post(`${API}/api/contact-logs`, {
        data: {
          portfolioAccountId: accountId,
          agentType: s.agentType,
          contactedAt: new Date().toISOString(),
          outcome: "OTHER",
          notes: "Contacto manual",
          ...(s.aiSummary ? { aiSummary: s.aiSummary } : {}),
          ...(s.durationSeconds ? { durationSeconds: s.durationSeconds } : {}),
          channelData: s.channelData
        }
      });
      expect(res.ok()).toBeTruthy();
    }

    // --- Gestiones list: refined columns + a row per channel -----------------
    await page.getByRole("link", { name: "Gestiones" }).click();
    await expect(page.getByRole("columnheader", { name: "Canal" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Resumen IA" })).toBeVisible();

    const openPanel = async (channelLabel: string) => {
      await page.locator("tr", { hasText: channelLabel }).first().click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Transcripción")).toHaveCount(0);
      return panel;
    };
    const closePanel = async () => {
      await page.getByRole("button", { name: "Volver a gestiones" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    };

    // SMS — sent message bubble + real AI summary
    let panel = await openPanel("SMS");
    await expect(panel.getByText("Mensaje enviado")).toBeVisible();
    await expect(panel.getByText(smsBody)).toBeVisible();
    await closePanel();

    // Pre-grabada — played message + script + generic insight
    panel = await openPanel("Voz pregrabada");
    await expect(panel.getByText("Mensaje reproducido")).toBeVisible();
    await expect(panel.getByText(script)).toBeVisible();
    await expect(panel.getByText(/reproducido al cliente/i)).toBeVisible();
    await closePanel();

    // Email — communication card + body + generic insight
    panel = await openPanel("Correo");
    await expect(panel.getByText("Comunicación Email")).toBeVisible();
    await expect(panel.getByText(emailBody)).toBeVisible();
    await expect(panel.getByText(/correo de recordatorio/i)).toBeVisible();
  });
});
