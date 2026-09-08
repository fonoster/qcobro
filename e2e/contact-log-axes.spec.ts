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
 *   delivery    did it reach the device or inbox (never null)
 *   path     what path the interaction took (null when none was observed)
 *   outcome  what came of it (null in the common case)
 *
 * Covers the cases that were impossible to express before the split: a delivery that failed
 * for a stated reason, a delivered attempt that produced nothing, and a wrong-party finding
 * that is a delivery *success*. Assumes the dev stack is running.
 */
test.describe("contact log — delivery / path / outcome", () => {
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
      delivery: "FAILED",
      deliveryReason: "NO_ANSWER",
      channelData: { to: "+525500000001" }
    });
    // A delivered SMS that produced nothing — the common case, and the one that used to be
    // mislabelled as a "Resultado".
    await seed({
      agentType: "SMS",
      delivery: "DELIVERED",
      channelData: { to: "+525500000002", messageBody: "Recordatorio de pago." }
    });
    // Answered, and the person said they are not the account holder. A delivery SUCCESS
    // carrying a valuable finding — previously indistinguishable from a dead number.
    await seed({
      agentType: "VOICE_AI",
      delivery: "DELIVERED",
      path: "ENGAGED",
      outcome: "WRONG_PARTY",
      channelData: { to: "+525500000003" }
    });

    // --- The one-way channel rejects an interaction it cannot observe --------
    const rejected = await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: accountId,
        agentType: "SMS",
        contactedAt: new Date().toISOString(),
        delivery: "DELIVERED",
        outcome: "PAYMENT_PROMISE"
      }
    });
    expect(rejected.status(), "SMS has no inbound path, so outcome is not accepted").toBe(400);

    // --- List: the two axes are separate columns ----------------------------
    await page.getByRole("link", { name: "Gestiones" }).click();
    await expect(page.getByRole("columnheader", { name: "Entrega" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Resultado" })).toBeVisible();

    // Assertions are scoped to table rows throughout: the outcome filter is a <select>
    // whose <option> labels carry the same strings, so an unscoped getByText matches twice.
    const rowWith = (text: string) => page.locator("tbody tr", { hasText: text });

    // A failure carries its reason inline, after a middot.
    await expect(rowWith("Fallido · Sin respuesta")).toHaveCount(1);
    // A gestión with no outcome renders an em dash rather than an empty cell.
    await expect(page.getByText("—").first()).toBeVisible();
    await expect(rowWith("Persona equivocada")).toHaveCount(1);

    // --- Filters are independent -------------------------------------------
    const deliveryFilter = page.getByRole("combobox").first();
    await deliveryFilter.selectOption("FAILED");
    await expect(rowWith("Fallido · Sin respuesta")).toHaveCount(1);
    await expect(rowWith("Persona equivocada")).toHaveCount(0);
    await deliveryFilter.selectOption("");

    const outcomeFilter = page.getByRole("combobox").nth(1);
    await outcomeFilter.selectOption("WRONG_PARTY");
    await expect(rowWith("Persona equivocada")).toHaveCount(1);
    await expect(rowWith("Fallido · Sin respuesta")).toHaveCount(0);
    await outcomeFilter.selectOption("");

    // --- Detail: a wrong-party call is a delivery success -------------------
    await rowWith("Persona equivocada").first().click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Entrega", { exact: true })).toBeVisible();
    await expect(panel.getByText("Camino", { exact: true })).toBeVisible();
    await expect(panel.getByText("Despachado → Conversación")).toBeVisible();
    await expect(panel.getByText("Persona equivocada")).toBeVisible();
    await page.getByRole("button", { name: "Volver a gestiones" }).click();

    // --- Detail: a one-way channel shows delivery only -----------------------
    await rowWith("SMS").first().click();
    const smsPanel = page.getByRole("dialog");
    await expect(smsPanel).toBeVisible();
    // Exact: "Entrega" is a prefix of the value "Entregado", so a substring match hits both.
    await expect(smsPanel.getByText("Entrega", { exact: true })).toBeVisible();
    // No inbound path, so neither axis has anything to say.
    await expect(smsPanel.getByText("Camino", { exact: true })).toHaveCount(0);
    await expect(smsPanel.getByText("Resultado", { exact: true })).toHaveCount(0);
  });
});
