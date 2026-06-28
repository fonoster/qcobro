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
test.describe("gestiones — channels", () => {
  test("list + channel-aware detail panel for SMS, Pre-grabada, Email, Voz IA", async ({
    page
  }) => {
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

    const vozTranscript = [
      { role: "agent", text: "Buenas tardes, le llamo de QCobro respecto a su cuenta." },
      { role: "customer", text: "Sí, dígame." },
      { role: "agent", text: "¿Le gustaría regularizar su saldo el viernes?" }
    ];
    const seeds: {
      agentType: string;
      outcome?: string;
      extra?: Record<string, unknown>;
      channelData: Record<string, unknown>;
    }[] = [
      {
        agentType: "SMS",
        extra: {
          aiSummary: "Recordatorio de pago enviado al cliente con enlace de pago en línea."
        },
        channelData: { to: "+525500000000", messageBody: smsBody }
      },
      {
        agentType: "VOICE_PRERECORDED",
        extra: { durationSeconds: 38 },
        channelData: { to: "+525500000001", messageBody: script }
      },
      {
        agentType: "EMAIL",
        channelData: {
          to: "maria@example.com",
          subject: "Recordatorio de pago",
          messageBody: emailBody
        }
      },
      {
        agentType: "VOICE_AI",
        outcome: "PAYMENT_PROMISE",
        extra: {
          intentMetadata: { promisedAmount: 4820, promisedDate: "2026-06-27T00:00:00.000Z" },
          aiSummary: "El cliente reconoce la deuda y se compromete a pagar el saldo el viernes.",
          aiSentiment: "POSITIVE",
          aiDebtReason: "Falta de liquidez temporal",
          aiResult: "Promesa de pago",
          aiNextStep: "Enviar enlace de pago por SMS",
          durationSeconds: 134
        },
        channelData: {
          to: "+525500000099",
          providerRef: "call-voz-1",
          recordingUrl: "https://rec.example/voz.wav",
          transcript: vozTranscript
        }
      }
    ];
    for (const s of seeds) {
      const res = await page.request.post(`${API}/api/contact-logs`, {
        data: {
          portfolioAccountId: accountId,
          agentType: s.agentType,
          contactedAt: new Date().toISOString(),
          outcome: s.outcome ?? "OTHER",
          notes: "Contacto manual",
          ...(s.extra ?? {}),
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
      return panel;
    };
    const closePanel = async () => {
      await page.getByRole("button", { name: "Volver a gestiones" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    };

    // SMS — sent message bubble + real AI summary; no transcript
    let panel = await openPanel("SMS");
    await expect(panel.getByText("Mensaje enviado")).toBeVisible();
    await expect(panel.getByText(smsBody)).toBeVisible();
    await expect(panel.getByText("Transcripción")).toHaveCount(0);
    await closePanel();

    // Pre-grabada — played message + script + generic insight; no transcript
    panel = await openPanel("Voz pregrabada");
    await expect(panel.getByText("Mensaje reproducido")).toBeVisible();
    await expect(panel.getByText(script)).toBeVisible();
    await expect(panel.getByText(/reproducido al cliente/i)).toBeVisible();
    await expect(panel.getByText("Transcripción")).toHaveCount(0);
    await closePanel();

    // Email — communication card + body + generic insight; no transcript
    panel = await openPanel("Correo");
    await expect(panel.getByText("Conversación por correo")).toBeVisible();
    await expect(panel.getByText(emailBody)).toBeVisible();
    await expect(panel.getByText(/correo de recordatorio/i)).toBeVisible();
    await expect(panel.getByText("Transcripción")).toHaveCount(0);
    await closePanel();

    // Voz IA — audio player + transcript + full analysis + linked payment promise
    panel = await openPanel("Voz IA");
    await expect(panel.locator("audio")).toHaveCount(1);
    await expect(panel.locator("audio")).toHaveAttribute("src", /voz\.wav/);
    await expect(panel.getByText("Transcripción")).toBeVisible();
    await expect(
      panel.getByText("Buenas tardes, le llamo de QCobro respecto a su cuenta.")
    ).toBeVisible();
    await expect(panel.getByText(/reconoce la deuda/)).toBeVisible();
    await expect(panel.getByText("Positivo")).toBeVisible();
    await expect(panel.getByText("Promesa de pago").first()).toBeVisible();
    await expect(panel.getByText("Pendiente").first()).toBeVisible();
  });
});
