import { test, expect, type Page } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

const API = "http://localhost:3000";

/** The session's tRPC headers, read from the console's own storage. */
async function authHeaders(page: Page): Promise<Record<string, string>> {
  const auth = await page.evaluate(() => ({
    token: localStorage.getItem("accessToken"),
    workspace: localStorage.getItem("workspace")
  }));
  return { Authorization: `Bearer ${auth.token}`, "x-workspace": auth.workspace ?? "" };
}

/** Calls a tRPC mutation the way the console's batch link does, and returns its data. */
async function mutate(page: Page, path: string, input: unknown): Promise<unknown> {
  const res = await page.request.post(`/trpc/${path}?batch=1`, {
    headers: await authHeaders(page),
    data: { 0: input }
  });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  const data = (await res.json())[0].result.data;
  return data.json ?? data;
}

/** Creates a portfolio from the Carteras page and returns its id. */
async function createPortfolio(page: Page, name: string, clientId: string): Promise<string> {
  await page.getByRole("link", { name: "Carteras" }).click();
  await page
    .getByRole("button", { name: /Nueva cartera/ })
    .first()
    .click();
  await page.getByLabel("Nombre de la cartera").fill(name);
  await page.getByLabel("ID del cliente").fill(clientId);
  await page.getByRole("button", { name: "Crear cartera" }).click();
  await page.getByText(name).click();
  await expect(page).toHaveURL(/\/portfolios\/[a-f0-9-]+$/);
  return page.url().split("/portfolios/")[1];
}

function row(externalId: string, fullName: string, missedInstallments: number, terms: number) {
  return {
    externalId,
    fullName,
    phone: "+525500000099",
    outstandingBalance: missedInstallments * terms,
    termsAmount: terms,
    missedInstallments
  };
}

/**
 * Recuperado on Inicio and Carteras reads the recoveries the sync detects, for a period in the
 * workspace's timezone. Seeds two syncs through the API: the first loads the accounts, the
 * second reports them as CAUGHT_UP exits. A gestión between the two syncs makes a recovery count
 * as "con gestión". Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("Recuperado by period", () => {
  test("shows the empty state, then this month's recoveries with and without gestión", async ({
    page
  }) => {
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    await signUpAndEnter(page, newOwner("recuperado"), `WS ${stamp}`);

    // --- Empty: no recoveries in the period ----------------------------------
    const card = page.getByRole("group", { name: "Recuperado" });
    const filter = page.getByRole("radiogroup", { name: "Período" });
    await expect(filter.getByRole("radio", { name: "Este mes" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    // The per-card period selects are gone: the page filter drives the KPIs.
    await expect(card.getByRole("combobox")).toHaveCount(0);
    await expect(card.getByText("—", { exact: true })).toBeVisible();
    await expect(card.getByText("Sin pagos detectados en el período")).toBeVisible();
    await expect(card.getByText("acumulado")).toHaveCount(0);

    // --- Seed: load two accounts, a gestión on one, then both exit CAUGHT_UP ------
    const portfolioId = await createPortfolio(page, portfolioName, `cli-${stamp}`);
    await mutate(page, "portfolios.syncAccounts", {
      portfolioId,
      mode: "UPDATE_EXISTING",
      rows: [row("REC-1", "Ana Gestión", 3, 2000), row("REC-2", "Luis Sin Gestión", 2, 1500)]
    });
    const accounts = (
      await (
        await page.request.get(
          `/trpc/portfolios.listAccounts?batch=1&input=${encodeURIComponent(
            JSON.stringify({ 0: { portfolioId, limit: 50, offset: 0 } })
          )}`,
          { headers: await authHeaders(page) }
        )
      ).json()
    )[0].result.data;
    const items = (accounts.json ?? accounts).items as { id: string; externalId: string }[];
    const withGestion = items.find((a) => a.externalId === "REC-1")!.id;

    const log = await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: withGestion,
        agentType: "VOICE_AI",
        contactedAt: new Date().toISOString(),
        delivery: "DELIVERED",
        path: "ENGAGED",
        channelData: { to: "+525500000099", providerRef: `call-${stamp}` }
      }
    });
    expect(log.ok(), await log.text()).toBeTruthy();

    await mutate(page, "portfolios.syncAccounts", {
      portfolioId,
      mode: "UPDATE_EXISTING",
      rows: [],
      exits: [
        { externalId: "REC-1", reason: "CAUGHT_UP", missedInstallments: 3, termsAmount: 2000 },
        { externalId: "REC-2", reason: "CAUGHT_UP", missedInstallments: 2, termsAmount: 1500 }
      ]
    });

    // --- Inicio: this month's figure, and the line for payments without gestión
    await page.getByRole("link", { name: "Panel" }).click();
    await expect(card.getByText(/6,000/)).toBeVisible();
    await expect(card.getByText("1 cuentas con gestión")).toBeVisible();
    await expect(card.getByText(/Pagos sin gestión reciente: .*3,000 · 1 cuentas/)).toBeVisible();

    const progress = page.getByRole("region", { name: "Progreso por cartera" });
    await expect(progress.getByText("este mes", { exact: true })).toBeVisible();
    await expect(progress.getByText(/% · .*6,000/)).toBeVisible();

    // --- Hoy and 7 d: today's recoveries are in both windows -----------------
    for (const option of ["Hoy", "7 d"]) {
      await filter.getByRole("radio", { name: option }).click();
      await expect(card.getByText(/6,000/)).toBeVisible();
      await expect(card.getByText("1 cuentas con gestión")).toBeVisible();
      await expect(progress.getByText(/% · .*6,000/)).toBeVisible();
    }
    await expect(page.getByRole("group", { name: "Contacto · 7 d" })).toBeVisible();

    // --- Personalizado, last month: nothing was recovered then ---------------
    // Days 1–20 of last month: always before today, whatever the workspace's timezone.
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const ym = lastMonth.toISOString().slice(0, 7);
    await filter.getByRole("radio", { name: "Personalizado" }).click();
    await page.getByLabel("Desde").fill(`${ym}-01`);
    await page.getByLabel("Hasta").fill(`${ym}-20`);
    await expect(card.getByText("—", { exact: true })).toBeVisible();
    await expect(card.getByText("Sin pagos detectados en el período")).toBeVisible();
    await expect(card.getByText(/Pagos sin gestión reciente/)).toHaveCount(0);
    await expect(progress.getByText(/^1 .* – 20 /)).toBeVisible();
    await expect(progress.getByText(/% · .*6,000/)).toHaveCount(0);

    // --- Carteras: the current month's figure per portfolio ------------------
    await page.getByRole("link", { name: "Carteras" }).click();
    await expect(page.getByRole("columnheader", { name: "Recuperado · mes" })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(portfolioName) })).toContainText("6,000");
  });

  test("shows RD$ 0 with gestión when every recovery came without gestión", async ({ page }) => {
    const stamp = Date.now();
    await signUpAndEnter(page, newOwner("recuperado-sin"), `WS ${stamp}`);
    const portfolioId = await createPortfolio(page, `Cartera ${stamp}`, `cli-${stamp}`);

    await mutate(page, "portfolios.syncAccounts", {
      portfolioId,
      mode: "UPDATE_EXISTING",
      rows: [row("REC-3", "Rosa Sin Gestión", 2, 1250)]
    });
    await mutate(page, "portfolios.syncAccounts", {
      portfolioId,
      mode: "UPDATE_EXISTING",
      rows: [],
      exits: [
        { externalId: "REC-3", reason: "CAUGHT_UP", missedInstallments: 2, termsAmount: 1250 }
      ]
    });

    await page.getByRole("link", { name: "Panel" }).click();
    const card = page.getByRole("group", { name: "Recuperado" });
    await expect(card.getByText(/^\D*0$/)).toBeVisible();
    await expect(card.getByText("0 cuentas con gestión")).toBeVisible();
    await expect(card.getByText(/Pagos sin gestión reciente: .*2,500 · 1 cuentas/)).toBeVisible();
  });
});
