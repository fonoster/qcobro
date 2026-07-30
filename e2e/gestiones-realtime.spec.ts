import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Realtime streaming golden path (issue #60): the Gestiones list and an open Gestión
 * detail view update live, without a manual refresh.
 *
 * - List: a gestión seeded via the external contact-log ingress (a second "channel" the
 *   operator's own page did not trigger) appears in an already-open Gestiones list.
 * - Detail: with that gestión's detail panel open, a second, independent page (same
 *   browser context — a stand-in for a second operator) resolves the linked payment
 *   promise through the normal UI; the first page's open panel reflects the change without
 *   the operator reloading or re-navigating.
 *
 * Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("gestiones — realtime streaming", () => {
  test("new gestión streams into an open list; detail updates in place from a second page", async ({
    page,
    context
  }) => {
    const owner = newOwner("gestiones-rt");
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

    // --- Open the Gestiones list FIRST (empty) so its realtime subscription is live
    // before anything is seeded — a page reload would defeat the point of this test. ------
    await page.getByRole("link", { name: "Gestiones" }).click();
    await expect(page.getByRole("heading", { name: "Gestiones" })).toBeVisible();
    await expect(page.getByText("María E2E")).toHaveCount(0);

    // --- Seed a VOICE_AI gestión with a PAYMENT_PROMISE outcome via the external
    // contact-log ingress — a channel the open page never touches, mirroring how the
    // campaigns engine or a webhook writes a gestión while an operator is watching. --------
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

    // --- List: the new gestión appears without a reload or navigation -------------------
    await expect(page.getByText("María E2E")).toBeVisible();

    // --- Open its detail panel; the linked payment promise starts PENDING ---------------
    await page.locator("tr", { hasText: "María E2E" }).first().click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Pendiente", { exact: true })).toBeVisible();

    // --- A second page (same authenticated session — a stand-in for a second operator)
    // resolves the promise through the normal worklist UI, never touching the first
    // page's own state. ------------------------------------------------------------------
    const page2 = await context.newPage();
    await page2.goto("/");
    await page2.getByRole("link", { name: "Promesas de pago" }).click();
    const row = page2.getByRole("row", { name: /María E2E/ });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Acciones" }).click();
    await page2.getByRole("button", { name: "Marcar pagada" }).click();
    await expect(row.getByText("Cumplida")).toBeVisible();

    // --- The first page's still-open detail panel reflects the change in place ----------
    await expect(panel.getByText("Cumplida", { exact: true })).toBeVisible();
    await expect(panel.getByText("Pendiente", { exact: true })).toHaveCount(0);

    await page2.close();
  });
});
