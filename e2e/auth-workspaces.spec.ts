import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openNav, inviteMember, waitForMail } from "./helpers.js";

test.describe("auth & workspaces", () => {
  test("sign up, create + rename workspace (via sidebar), invite a member (via sidebar)", async ({
    page
  }) => {
    const unique = Date.now();
    const owner = newOwner();
    const memberEmail = `member+${unique}@example.com`;

    // 1. Sign up, skip verification, and create the first workspace -> dashboard.
    await signUpAndEnter(page, owner, `QA Espacio ${unique}`);

    // 2. Rename the workspace via the sidebar -> Configuración.
    const renamed = `QA Renamed ${unique}`;
    await openNav(page, "Configuración");
    await expect(page).toHaveURL(/\/settings/);
    await page.getByPlaceholder("Nombre del espacio").fill(renamed);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    // New name is reflected in the workspace switcher.
    await expect(page.getByRole("button", { name: new RegExp(renamed) })).toBeVisible();

    // 3. Reach Equipo via the sidebar and invite a member (name required by Identity).
    await openNav(page, "Equipo");
    await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
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
