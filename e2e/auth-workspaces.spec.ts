import { test, expect } from "@playwright/test";

const MAILPIT = "http://localhost:8025";

/** Poll Mailpit's REST API until a message addressed to `to` shows up. */
async function waitForMail(to: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`);
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: { Subject: string; To?: { Address: string }[] }[];
      };
      const msg = (data.messages ?? []).find((m) => (m.To ?? []).some((t) => t.Address === to));
      if (msg) return msg;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email delivered to ${to} within ${timeoutMs}ms`);
}

test.describe("auth & workspaces", () => {
  test("sign up, create + rename workspace (via menu), invite a member (via menu)", async ({
    page
  }) => {
    const unique = Date.now();
    const ownerEmail = `owner+${unique}@qcobro.com`;
    const memberEmail = `member+${unique}@example.com`;
    const password = "test1234";

    // 1. Sign up — auto-logs in, then redirects to create-workspace (no workspace yet).
    await page.goto("/signup");
    await page.getByPlaceholder("Tu nombre").fill("QA Owner");
    await page.getByPlaceholder("tú@empresa.com").fill(ownerEmail);
    await page.getByPlaceholder("Mínimo 8 caracteres").fill(password);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/create-workspace/);

    // 2. Create the first workspace -> lands on the dashboard.
    await page.getByRole("button", { name: "Nuevo espacio" }).click();
    await page.getByPlaceholder("Ej. Cartera Abril").fill(`QA Espacio ${unique}`);
    await page.getByRole("button", { name: "Crear espacio" }).click();
    await expect(page).toHaveURL(/localhost:5173\/$/);

    // 3. Rename the workspace via the user menu -> Configuración del espacio.
    const renamed = `QA Renamed ${unique}`;
    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page.getByRole("button", { name: "Configuración del espacio" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByPlaceholder("Nombre del espacio").fill(renamed);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    // New name is reflected in the workspace switcher.
    await expect(
      page.getByRole("button", { name: new RegExp(`QA Renamed ${unique}`) })
    ).toBeVisible();

    // 4. Reach Members via the user menu and invite a member (name required by Identity).
    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page.getByRole("button", { name: "Miembros" }).click();
    await expect(page.getByRole("heading", { name: "Miembros" })).toBeVisible();
    await page.getByRole("button", { name: "Invitar miembro" }).click();
    await page.getByPlaceholder("Nombre de la persona").fill("QA Teammate");
    await page.getByPlaceholder("persona@empresa.com").fill(memberEmail);
    await page.getByRole("button", { name: "Enviar invitación" }).click();

    // 5. The pending member row appears, and 6. the invite email reaches Mailpit.
    await expect(page.getByText(memberEmail)).toBeVisible();
    const msg = await waitForMail(memberEmail);
    expect(msg.Subject.toLowerCase()).toContain("workspace");
  });

  test("unauthenticated /members redirects to login", async ({ page }) => {
    await page.goto("/members");
    await expect(page).toHaveURL(/\/login/);
  });
});
