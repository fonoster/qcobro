import { test, expect } from "@playwright/test";
import { newOwner, signUp, waitForMail, messageBody, extractCode } from "./helpers.js";

test.describe("contact verification", () => {
  test("sign-up routes to verification and emails a code", async ({ page }) => {
    const owner = newOwner("verify");
    await signUp(page, owner);
    await expect(
      page.getByRole("heading", { name: "Verifica tu correo electrónico" })
    ).toBeVisible();
    await waitForMail(owner.email, 1);
  });

  test("resend sends another code", async ({ page }) => {
    const owner = newOwner("verify");
    await signUp(page, owner);
    await waitForMail(owner.email, 1);

    await page.getByRole("button", { name: "Reenviar código" }).click();
    await expect(page.getByText("Código enviado.")).toBeVisible();
    await waitForMail(owner.email, 2);
  });

  test("verification can be skipped", async ({ page }) => {
    const owner = newOwner("verify");
    await signUp(page, owner);
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(page).toHaveURL(/\/create-workspace/);
  });

  test("entering the emailed code verifies and proceeds", async ({ page }) => {
    const owner = newOwner("verify");
    await signUp(page, owner);

    const msg = await waitForMail(owner.email, 1);
    const code = extractCode(await messageBody(msg.ID));
    expect(code, "verification email should contain a 6-digit code").not.toBeNull();

    await page.getByPlaceholder("••••••").fill(code!);
    await page.getByRole("button", { name: "Verificar" }).click();
    // No workspace yet → verified user is routed to workspace creation.
    await expect(page).toHaveURL(/\/create-workspace/);
  });
});
