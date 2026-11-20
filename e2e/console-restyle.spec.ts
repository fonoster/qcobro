import { test, expect, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  newOwner,
  signUp,
  skipVerification,
  signUpAndEnter,
  inviteMember,
  waitForMail,
  MAILPIT
} from "./helpers.js";

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

/**
 * The sidebar is the grouped Fonoster shell (issue #248): workspace pages leave the user
 * menu and join the navigation under "Espacio de trabajo".
 */
const TOP = ["Panel", "Carteras", "Campañas", "Agentes IA"];
const FOLLOW_UP = ["Gestiones", "Promesas de pago"];
const WORKSPACE = ["Integraciones", "Equipo", "Claves de API", "Facturación", "Configuración"];
const ROUTES: Record<string, RegExp> = {
  Panel: /localhost:\d+\/$/,
  Carteras: /\/portfolios$/,
  Campañas: /\/campaigns$/,
  "Agentes IA": /\/agent-templates$/,
  Gestiones: /\/gestiones$/,
  "Promesas de pago": /\/payment-promises$/,
  Integraciones: /\/integrations$/,
  Equipo: /\/members$/,
  "Claves de API": /\/api-keys$/,
  Facturación: /\/billing$/,
  Configuración: /\/settings$/
};

/** The links inside `scope`, by visible name, in order (auto-waits for the list). */
const links = (scope: Locator) => scope.getByRole("link");

async function inviteLink(email: string): Promise<string> {
  const msg = await waitForMail(email);
  const res = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`);
  const { Text } = (await res.json()) as { Text: string };
  const match = Text.match(/https?:\/\/\S+\/accept-invite\?token=[\w.-]+/);
  if (!match) throw new Error(`No invitation link in the email to ${email}`);
  return new URL(match[0]).pathname + new URL(match[0]).search;
}

test.describe("console restyle — grouped sidebar", () => {
  test("sidebar: groups and items", async ({ page }) => {
    await signUpAndEnter(page, newOwner("sidebar"), `QA Menú ${Date.now()}`);
    const nav = page.getByRole("navigation");

    await expect(links(nav)).toHaveText([...TOP, ...FOLLOW_UP, ...WORKSPACE]);
    await expect(links(nav.getByRole("group", { name: "Seguimiento" }))).toHaveText(FOLLOW_UP);
    await expect(links(nav.getByRole("group", { name: "Espacio de trabajo" }))).toHaveText(
      WORKSPACE
    );

    for (const name of [...TOP, ...FOLLOW_UP, ...WORKSPACE]) {
      const link = nav.getByRole("link", { name, exact: true });
      await link.click();
      await expect(page).toHaveURL(ROUTES[name]);
      await expect(link).toHaveAttribute("aria-current", "page");
    }

    // The footer menu holds only the profile, the language and logging out.
    await page.getByRole("button", { name: "Menú de usuario" }).click();
    const menu = page.getByRole("dialog", { name: "Menú de usuario" });
    await expect(menu.getByRole("button")).toHaveText(["Mi perfil", "Cerrar sesión"]);
    await menu.getByRole("combobox", { name: "Idioma" }).selectOption("en");
    await expect(menu).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(nav.getByRole("group", { name: "Workspace" })).toBeVisible();

    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("dialog", { name: "User menu" }).getByRole("combobox").selectOption("es");
    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page
      .getByRole("dialog", { name: "Menú de usuario" })
      .getByRole("button", { name: "Cerrar sesión" })
      .click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sidebar: member", async ({ browser, page }) => {
    const unique = Date.now();
    const member = newOwner("sidebar-member");
    const memberPage = await (await browser.newContext()).newPage();
    await signUp(memberPage, member);
    await skipVerification(memberPage);

    const wsName = `QA Miembro ${unique}`;
    await signUpAndEnter(page, newOwner("sidebar-owner"), wsName);
    await page.getByRole("navigation").getByRole("link", { name: "Equipo" }).click();
    await inviteMember(page, member.name, member.email);

    await memberPage.goto(await inviteLink(member.email));
    await memberPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(memberPage).not.toHaveURL(/accept-invite/);
    // The access token lists the new membership only after signing in again.
    await memberPage.evaluate(() => localStorage.clear());
    await memberPage.goto("/login");
    await memberPage.getByPlaceholder("tú@empresa.com").fill(member.email);
    await memberPage.getByPlaceholder("••••••••").fill(member.password);
    await memberPage.locator('form button[type="submit"]').click();
    await expect(memberPage).toHaveURL(/\/workspaces$/);
    await memberPage.getByText(wsName).click();
    await expect(memberPage).toHaveURL(/localhost:\d+\/$/);

    const nav = memberPage.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Equipo" })).toBeVisible();
    await expect(links(nav.getByRole("group", { name: "Espacio de trabajo" }))).toHaveText([
      "Equipo",
      "Facturación",
      "Configuración"
    ]);
    await expect(memberPage.getByRole("button", { name: "Menú de usuario" })).toContainText(
      "Miembro"
    );
  });

  test("sidebar: collapsed", async ({ page }) => {
    await signUpAndEnter(page, newOwner("sidebar-rail"), `QA Riel ${Date.now()}`);
    await page.getByRole("button", { name: "Contraer menú" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expandir menú" })).toBeVisible();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("group", { name: "Seguimiento" })).toBeVisible();
    await expect(nav.getByText("Espacio de trabajo", { exact: true })).toBeHidden();

    await nav.getByRole("link", { name: "Equipo" }).click();
    await expect(page).toHaveURL(/\/members$/);
    await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
  });
});
