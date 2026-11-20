import { test, expect, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * The console follows Fonoster's tokens (issue #247): its ground, text, type and primary
 * button come from designs/fonoster.lib.pen, and statuses are text or a neutral pill,
 * never a colored dot. Assumes the dev stack is running.
 */

const htmlTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function enterIn(page: Page, scheme: "light" | "dark", tag: string) {
  // A new account's appearance is "system", so the emulated OS scheme picks the theme.
  await page.emulateMedia({ colorScheme: scheme });
  await signUpAndEnter(page, newOwner(tag), `QA Estilo ${Date.now()}`);
  await expect.poll(() => htmlTheme(page)).toBe(scheme);
}

/** Small round, filled elements inside `scope`: the shape of a status dot. */
function countDots(scope: Locator) {
  return scope.evaluate((root) => {
    let dots = 0;
    for (const el of Array.from(root.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const round = parseFloat(s.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2;
      const filled =
        s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent";
      if (r.width > 0 && r.width <= 12 && r.height <= 12 && round && filled) dots++;
    }
    return dots;
  });
}

test.describe("console restyle — Fonoster tokens", () => {
  test("tokens: dark", async ({ page }) => {
    await enterIn(page, "dark", "tokens-dark");
    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", "rgb(24, 24, 24)");
    await expect(body).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(body).toHaveCSS("font-family", /^"?Poppins"?,/);
  });

  test("tokens: light", async ({ page }) => {
    await enterIn(page, "light", "tokens-light");
    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", "rgb(244, 244, 244)");
    await expect(body).toHaveCSS("color", "rgb(37, 37, 37)");
    await expect(body).toHaveCSS("font-family", /^"?Poppins"?,/);
  });

  test("primary button text", async ({ page }) => {
    await enterIn(page, "light", "primary-btn");
    await page.getByRole("link", { name: "Carteras" }).click();
    const cta = page.getByRole("button", { name: /Nueva cartera/ });
    await expect(cta).toHaveCSS("color", "rgb(1, 25, 0)");
    await expect(cta).toHaveCSS("background-color", "rgb(57, 225, 158)");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => htmlTheme(page)).toBe("dark");
    await expect(cta).toHaveCSS("color", "rgb(1, 25, 0)");
    await expect(cta).toHaveCSS("background-color", "rgb(57, 225, 158)");
  });

  test("no status dots", async ({ page }) => {
    await enterIn(page, "light", "no-dots");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;

    // A portfolio with one account and a VOICE_AI gestión that promised a payment.
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
    const res = await page.request.post(`${API}/api/contact-logs`, {
      data: {
        portfolioAccountId: accountId,
        agentType: "VOICE_AI",
        contactedAt: new Date().toISOString(),
        delivery: "DELIVERED",
        path: "ENGAGED",
        outcome: "PAYMENT_PROMISE",
        intentMetadata: { promisedAmount: 4820, promisedDate: "2026-12-01T00:00:00.000Z" },
        channelData: { to: "+525500000099", providerRef: `call-${stamp}` }
      }
    });
    expect(res.ok()).toBeTruthy();

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expect.poll(() => htmlTheme(page)).toBe(scheme);

      // Promesas de pago: the status keeps its label in a neutral pill.
      await page.getByRole("link", { name: "Promesas de pago" }).click();
      const promise = page.getByRole("row", { name: /María E2E/ });
      const status = promise.getByText("Pendiente", { exact: true });
      await expect(status).toBeVisible();
      const neutral = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.className = "bg-elevated text-fg";
        document.body.append(probe);
        const s = getComputedStyle(probe);
        const out = { bg: s.backgroundColor, fg: s.color };
        probe.remove();
        return out;
      });
      await expect(status).toHaveCSS("background-color", neutral.bg);
      await expect(status).toHaveCSS("color", neutral.fg);
      expect(await countDots(promise)).toBe(0);

      // Gestiones: delivery and result are plain text, with no dot beside them.
      await page.getByRole("link", { name: "Gestiones" }).click();
      const gestion = page.getByRole("row", { name: /María E2E/ });
      await expect(gestion).toBeVisible();
      await expect(gestion.getByText(/Promesa de pago/)).toBeVisible();
      expect(await countDots(gestion)).toBe(0);
    }
  });
});
