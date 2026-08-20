import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Golden path for the three contact-log axes: a gestión records up to three independent
 * things, and the console has to keep them apart.
 *
 *   entrega    did it reach the device or inbox (never null)
 *   camino     what path the interaction took (null when none was observed)
 *   resultado  what came of it (null in the common case)
 *
 * Covers the cases that were impossible to express before the split: a delivery that failed
 * for a stated reason, a delivered attempt that produced nothing, and a wrong-party finding
 * that is a delivery *success*. Assumes the dev stack is running.
 */
test.describe("contact log — entrega / camino / resultado", () => {
  test("detail panel shows the three axes, and the list filters them independently", async ({
    page
  }) => {
    const owner = newOwner("axes");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    await signUpAndEnter(page, owner, `WS ${stamp}`);

    // --- Portfolio + import one account --------------------------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await page.getByText(portfolioName).click();
    await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
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

    const seed = async (body: Record<string, unknown>) => {
      const res = await page.request.post(`${API}/api/contact-logs`, {
        data: {
          portfolioAccountId: accountId,
          contactedAt: new Date().toISOString(),
          ...body
        }
      });
      expect(res.ok(), JSON.stringify(await res.json())).toBeTruthy();
    };

    // A call that rang out: a failure that says why.
    await seed({
      agentType: "VOICE_AI",
      entrega: "FAILED",
      deliveryReason: "NO_ANSWER",
      channelData: { to: "+525500000001" }
    });
    // A delivered SMS that produced nothing — the common case, and the one that used to be
    // mislabelled as a "Resultado".
    await seed({
      agentType: "SMS",
      entrega: "DELIVERED",
      channelData: { to: "+525500000002", messageBody: "Recordatorio de pago." }
    });
    // Answered, and the person said they are not the account holder. A delivery SUCCESS
    // carrying a valuable finding — previously indistinguishable from a dead number.
    await seed({
      agentType: "VOICE_AI",
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: "WRONG_PARTY",
      channelData: { to: "+525500000003" }
    });

    // --- The one-way channel rejects an interaction it cannot observe --------
    const rejected = await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: accountId,
        agentType: "SMS",
        contactedAt: new Date().toISOString(),
        entrega: "DELIVERED",
        resultado: "PAYMENT_PROMISE"
      }
    });
    expect(rejected.status(), "SMS has no inbound path, so resultado is not accepted").toBe(400);

    // --- List: the two axes are separate columns ----------------------------
    await page.getByRole("link", { name: "Gestiones" }).click();
    await expect(page.getByRole("columnheader", { name: "Entrega" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Resultado" })).toBeVisible();

    // A failure carries its reason inline, after a middot.
    await expect(page.getByText("Fallido · Sin respuesta")).toBeVisible();
    // A gestión with no outcome renders an em dash rather than an empty cell.
    await expect(page.getByText("—").first()).toBeVisible();
    await expect(page.getByText("Persona equivocada")).toBeVisible();

    // --- Filters are independent -------------------------------------------
    const entregaFilter = page.getByRole("combobox").first();
    await entregaFilter.selectOption("FAILED");
    await expect(page.getByText("Fallido · Sin respuesta")).toBeVisible();
    await expect(page.getByText("Persona equivocada")).toHaveCount(0);
    await entregaFilter.selectOption("");

    const resultadoFilter = page.getByRole("combobox").nth(1);
    await resultadoFilter.selectOption("WRONG_PARTY");
    await expect(page.getByText("Persona equivocada")).toBeVisible();
    await expect(page.getByText("Fallido · Sin respuesta")).toHaveCount(0);
    await resultadoFilter.selectOption("");

    // --- Detail: a wrong-party call is a delivery success -------------------
    await page.locator("tr", { hasText: "Persona equivocada" }).first().click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Entrega")).toBeVisible();
    await expect(panel.getByText("Camino")).toBeVisible();
    await expect(panel.getByText("Despachado → Conversación")).toBeVisible();
    await expect(panel.getByText("Persona equivocada")).toBeVisible();
    await page.getByRole("button", { name: "Volver a gestiones" }).click();

    // --- Detail: a one-way channel shows entrega only -----------------------
    await page.locator("tr", { hasText: "SMS" }).first().click();
    const smsPanel = page.getByRole("dialog");
    await expect(smsPanel).toBeVisible();
    await expect(smsPanel.getByText("Entrega")).toBeVisible();
    // No inbound path, so neither axis has anything to say.
    await expect(smsPanel.getByText("Camino")).toHaveCount(0);
    await expect(smsPanel.getByText("Resultado")).toHaveCount(0);
  });
});
