import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Golden path for the pre-recorded DTMF menu (issue #88): configure a template with both
 * digits through the console, confirm client-side validation rejects a half-configured
 * digit, confirm the config round-trips through Editar, then verify the gestión-side
 * effect — a DTMF press is the one way `VOICE_PRERECORDED` can produce `camino`/`resultado`
 * at all, so the detail panel and list have to render them exactly like every other
 * channel once non-null, and the API has to keep rejecting every value except the two
 * this menu can actually produce. Live dispatch is not exercised (see prerecorded-audio's
 * unit tests for the VoiceServer branch logic). Assumes the dev stack is running.
 */
test.describe("pre-recorded DTMF menu", () => {
  test("configure both digits, validation, persistence, and the resultado/camino it produces", async ({
    page
  }) => {
    const owner = newOwner("prerecorded-dtmf");
    const stamp = Date.now();
    const portfolioName = `Cartera ${stamp}`;
    const agentName = `Sofia ${stamp}`;
    const script =
      "Estimado cliente, su saldo pendiente es de $4,800. Marque las opciones a continuación.";

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

    // --- Create a VOICE_PRERECORDED template with a half-configured menu -----
    await page.getByRole("link", { name: "Agentes IA" }).click();
    await page.getByRole("button", { name: /Nuevo agente/ }).click();
    await page.getByLabel("Nombre del agente").fill(agentName);
    await page.getByLabel("Tipo de canal").selectOption({ label: "Voz pregrabada" });
    await page.getByLabel("Idioma").selectOption("es");
    await page.getByLabel("Voz").selectOption({ label: "Sofía (es, femenina)" });
    await page.getByLabel("Guion").fill(script);

    // A digit with no message is rejected client-side before it ever reaches the API.
    await page.getByLabel("Dígito para repetir").fill("1");
    await page.getByRole("button", { name: "Crear agente" }).click();
    await expect(
      page.getByText("Se requiere un mensaje cuando este dígito está definido.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear agente" })).toBeVisible(); // dialog still open

    // --- Fill in the full menu and create for real ---------------------------
    await page
      .getByLabel("Mensaje de repetición")
      .fill("Presione 1 para escuchar el mensaje de nuevo.");
    await page.getByLabel("Máximo de repeticiones").fill("2");
    await page.getByLabel("Dígito para darse de baja").fill("9");
    await page.getByLabel("Mensaje de baja").fill("Presione 9 si no desea recibir más llamadas.");
    await page.getByRole("button", { name: "Crear agente" }).click();
    await expect(page.getByText(agentName)).toBeVisible();

    // --- Editar round-trips the saved menu ------------------------------------
    const templateRow = page.getByRole("row", { name: new RegExp(agentName) });
    await templateRow.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Dígito para repetir")).toHaveValue("1");
    await expect(page.getByLabel("Dígito para darse de baja")).toHaveValue("9");
    await expect(page.getByLabel("Máximo de repeticiones")).toHaveValue("2");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();

    // --- Resolve the account id, seed two pre-recorded gestiones -------------
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

    const seed = async (body: Record<string, unknown>) =>
      page.request.post(`${API}/api/contact-logs`, {
        data: {
          portfolioAccountId: accountId,
          agentType: "VOICE_PRERECORDED",
          contactedAt: new Date().toISOString(),
          ...body
        }
      });

    // No menu configured / caller pressed nothing: the pre-existing baseline behavior.
    const baseline = await seed({
      entrega: "DELIVERED",
      channelData: { to: "+525500000010" }
    });
    expect(baseline.ok(), JSON.stringify(await baseline.json())).toBeTruthy();

    // Caller pressed the opt-out digit: entrega DELIVERED, camino ENGAGED, resultado OPT_OUT —
    // pre-recorded's first-ever inbound signal.
    const optOut = await seed({
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: "OPT_OUT",
      channelData: { to: "+525500000011" }
    });
    expect(optOut.ok(), JSON.stringify(await optOut.json())).toBeTruthy();

    // The carve-out is value-scoped, not a blanket "this channel can engage": every other
    // camino/resultado value stays rejected for VOICE_PRERECORDED.
    const disallowed = await seed({ entrega: "DELIVERED", camino: "ABANDONED" });
    expect(disallowed.status(), "ABANDONED is unreachable on this channel").toBe(400);

    // --- List: the opt-out row shows Baja, the baseline row shows an em dash -
    await page.getByRole("link", { name: "Gestiones" }).click();
    const prerecordedRows = page.locator("tbody tr", { hasText: "Voz pregrabada" });
    const optOutRow = prerecordedRows.filter({ hasText: "Baja" });
    const baselineRow = prerecordedRows.filter({ hasNotText: "Baja" });
    await expect(optOutRow).toHaveCount(1);
    await expect(baselineRow).toHaveCount(1);

    // --- Detail: baseline shows neither Camino nor Resultado (unchanged) -----
    await baselineRow.first().click();
    let panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Conectada").first()).toBeVisible();
    await expect(panel.getByText("Camino", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("Resultado", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Volver a gestiones" }).click();

    // --- Detail: the opt-out press shows both Camino and Resultado -----------
    await optOutRow.first().click();
    panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Camino", { exact: true })).toBeVisible();
    await expect(panel.getByText("Despachado → Conversación")).toBeVisible();
    await expect(panel.getByText("Resultado", { exact: true })).toBeVisible();
    await expect(panel.getByText("Baja").first()).toBeVisible();
  });
});
