import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newOwner, signUpAndEnter } from "./helpers.js";

const CSV = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "accounts.csv");
const API = "http://localhost:3000";

/**
 * Delivery signals on the threaded channels (`message-delivery-signals`, closing #103).
 *
 * Before this change, EMAIL and WHATSAPP left `entrega: DISPATCHED` unless the customer
 * replied — no provider delivery signal was ingested on either — so a delivered-but-unanswered
 * message was indistinguishable from one that never arrived, and the `Leído` stage in the
 * `Camino` progression was unreachable UI: `contactAxes.ts` rendered it from
 * `channelData.openedAt`, a field nothing ever wrote.
 *
 * This asserts the console end state the real Resend/Meta webhooks now produce. It seeds
 * through the contact-log ingress rather than driving the providers, so it covers the render
 * path; the provider mapping itself is covered by the `record*DeliveryStatus` unit tests.
 * Assumes the dev stack is running.
 */
test.describe("message delivery — entrega and the Leído stage", () => {
  test("a delivered, opened and answered email renders the full progression", async ({ page }) => {
    const owner = newOwner("delivery");
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

    // The list is ordered `contactedAt: desc`, so the seeds carry explicit, spaced timestamps
    // rather than three `new Date()` calls a few milliseconds apart. Row order is asserted
    // below and must not depend on how fast the seeding requests happen to run.
    const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    // The end state of a full email round trip: Resend confirmed delivery, the open pixel
    // fired, and the customer replied with a commitment. Each stage came from a different
    // signal. The resultado is what makes this row identifiable in the list — the table
    // renders debtor, channel, entrega, resultado and date, and no subject.
    await seed({
      agentType: "EMAIL",
      contactedAt: at(3),
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: "PAYMENT_PROMISE",
      intentMetadata: { promisedAmount: 500, promisedDate: at(-72) },
      channelData: {
        to: "maria@example.com",
        subject: "Recordatorio de pago",
        messageBody: "Estimada María, su saldo está pendiente.",
        deliveryStatus: "email.opened",
        openedAt: at(2.5)
      }
    });

    // Delivered but never opened — the case that used to be stuck at Despachado. It must read
    // as delivered and must NOT claim a read.
    await seed({
      agentType: "EMAIL",
      contactedAt: at(2),
      entrega: "DELIVERED",
      channelData: {
        to: "maria@example.com",
        subject: "Segundo aviso",
        messageBody: "Estimada María, seguimos sin recibir su pago.",
        deliveryStatus: "email.delivered"
      }
    });

    // A hard bounce: a delivery failure that says why, so the address can be acted on.
    await seed({
      agentType: "EMAIL",
      contactedAt: at(1),
      entrega: "FAILED",
      deliveryReason: "INVALID_DESTINATION",
      channelData: { to: "typo@exmaple.com", deliveryStatus: "email.bounced" }
    });

    // --- List: delivery is visible without a reply --------------------------
    await page.getByRole("link", { name: "Gestiones" }).click();
    const rowWith = (text: string) => page.locator("tbody tr", { hasText: text });

    await expect(rowWith("Entregado")).toHaveCount(2);
    await expect(rowWith("Fallido · Destino inválido")).toHaveCount(1);
    // Nothing is left at Despachado — that was the bug.
    await expect(rowWith("Despachado")).toHaveCount(0);

    const entregaFilter = page.getByRole("combobox").first();
    await entregaFilter.selectOption("DELIVERED");
    await expect(rowWith("Entregado")).toHaveCount(2);
    await entregaFilter.selectOption("");

    // The list renders debtor, channel, entrega, resultado and date — no subject — so the two
    // delivered emails are told apart by their resultado, the only column that differs.
    const answered = rowWith("Promesa de pago");
    const unopened = page
      .locator("tbody tr", { hasText: "Entregado" })
      .filter({ hasNotText: "Promesa de pago" });
    await expect(answered).toHaveCount(1);
    await expect(unopened).toHaveCount(1);

    // --- Detail: the read receipt earns its own stage -----------------------
    await answered.click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Camino", { exact: true })).toBeVisible();
    // `Leído` sits between dispatch and the reply, and on a threaded channel ENGAGED reads
    // as "Respondió" rather than "Conversación".
    await expect(panel.getByText("Despachado → Leído → Respondió")).toBeVisible();
    await panel.getByRole("button", { name: "Volver a gestiones" }).click();

    // --- Delivered-but-unopened claims delivery and nothing more ------------
    await unopened.click();
    const second = page.getByRole("dialog");
    await expect(second).toBeVisible();
    await expect(second.getByText("Entregado")).toBeVisible();
    // No interaction was observed, so there is no Camino field at all — not an empty one.
    await expect(second.getByText("Camino", { exact: true })).toHaveCount(0);
    await expect(second.getByText("Leído")).toHaveCount(0);
  });
});
