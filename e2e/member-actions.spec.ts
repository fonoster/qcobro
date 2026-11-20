import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openNav, inviteMember, waitForMail } from "./helpers.js";

test.describe("member actions", () => {
  test("pending member can be resent and cancelled from the row menu", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner();
    const memberEmail = `member+${unique}@example.com`;

    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);
    await openNav(page, "Equipo");
    await inviteMember(page, "QA Teammate", memberEmail);

    // First invite email lands.
    await waitForMail(memberEmail, 1);

    // The pending member is the only row with an actions menu.
    await expect(page.getByText("Invitación pendiente")).toBeVisible();

    // Resend → a second invitation email is delivered.
    await page.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("button", { name: "Reenviar invitación" }).click();
    await waitForMail(memberEmail, 2);

    // Cancel → confirm dialog → the row disappears.
    await page.getByRole("button", { name: "Acciones" }).click();
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
    await openNav(page, "Equipo");

    // The owner row is always present and active.
    await expect(page.locator("main table").getByText("Activo")).toBeVisible();
    await expect(page.locator("main table").getByText("Propietario")).toBeVisible();
  });

  test("the owner's row shows their real name, not their email", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner();
    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);
    await openNav(page, "Equipo");

    // Identity's ID token never carries a name claim, so the owner row must be
    // sourced from the workspace's own owner record, not the viewer's decoded token.
    // Scoped to <main> (excludes the sidebar): the sidebar user menu independently
    // shows the correct name too (via profile.get), which would otherwise
    // false-positive a page-wide text match regardless of whether the row itself
    // is fixed.
    await expect(page.locator("main").getByText(owner.name)).toBeVisible();
  });
});
