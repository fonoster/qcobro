import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu, inviteMember, waitForMail } from "./helpers.js";

test.describe("member actions", () => {
  test("pending member can be resent and cancelled from the row menu", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner();
    const memberEmail = `member+${unique}@example.com`;

    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);
    await openUserMenu(page, "Miembros");
    await inviteMember(page, "QA Teammate", memberEmail);

    // First invite email lands.
    await waitForMail(memberEmail, 1);

    // The pending member is the only row with an actions menu.
    await expect(page.getByText("Pendiente")).toBeVisible();

    // Resend → a second invitation email is delivered.
    await page.getByTitle("Acciones").click();
    await page.getByRole("button", { name: "Reenviar invitación" }).click();
    await waitForMail(memberEmail, 2);

    // Cancel → confirm dialog → the row disappears.
    await page.getByTitle("Acciones").click();
    await page.getByRole("button", { name: "Cancelar invitación" }).click();
    await expect(page.getByRole("heading", { name: "¿Cancelar invitación?" })).toBeVisible();
    // The dialog's destructive button (not the menu item) confirms.
    await page.getByRole("button", { name: "Cancelar invitación" }).last().click();
    await expect(page.getByText(memberEmail)).toHaveCount(0);
  });

  test("status badges read Pendiente/Activo without color labels", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner();
    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);
    await openUserMenu(page, "Miembros");

    // The owner row is always present and active.
    await expect(page.getByText("Activo")).toBeVisible();
    await expect(page.getByText("Propietario")).toBeVisible();
  });
});
