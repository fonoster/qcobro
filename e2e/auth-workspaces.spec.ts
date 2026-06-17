import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu, inviteMember, waitForMail } from "./helpers.js";

test.describe("auth & workspaces", () => {
  test("sign up, create + rename workspace (via menu), invite a member (via menu)", async ({
    page
  }) => {
    const unique = Date.now();
    const owner = newOwner();
    const memberEmail = `member+${unique}@example.com`;

    // 1. Sign up, skip verification, and create the first workspace -> dashboard.
    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);

    // 2. Rename the workspace via the user menu -> Configuración del espacio.
    const renamed = `QA Renamed ${unique}`;
    await openUserMenu(page, "Configuración del espacio");
    await expect(page).toHaveURL(/\/settings/);
    await page.getByPlaceholder("Nombre del espacio").fill(renamed);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    // New name is reflected in the workspace switcher.
    await expect(page.getByRole("button", { name: new RegExp(renamed) })).toBeVisible();

    // 3. Reach Members via the user menu and invite a member (name required by Identity).
    await openUserMenu(page, "Miembros");
    await expect(page.getByRole("heading", { name: "Miembros" })).toBeVisible();
    await inviteMember(page, "QA Teammate", memberEmail);

    // 4. The invite email reaches Mailpit.
    const msg = await waitForMail(memberEmail);
    expect(msg.Subject.toLowerCase()).toContain("workspace");
  });

  test("unauthenticated /members redirects to login", async ({ page }) => {
    await page.goto("/members");
    await expect(page).toHaveURL(/\/login/);
  });
});
