import { test, expect } from "@playwright/test";
import { newOwner, signUp, skipVerification, signUpAndEnter, openUserMenu } from "./helpers.js";

test.describe("workspaces-hub account menu", () => {
  test("owner logs out from the hub account menu", async ({ page }) => {
    const unique = Date.now();
    const owner = newOwner("acct");
    await signUpAndEnter(page, owner, `QA Acct ${unique}`);

    // Go to the workspaces hub and log out from the avatar menu.
    await page.goto("/workspaces");
    await expect(page).toHaveURL(/\/workspaces/);

    await openUserMenu(page, "Cerrar sesión");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a user with no workspace can open Profile from the account menu", async ({ page }) => {
    const owner = newOwner("nows");
    await signUp(page, owner);
    // Skipping verification lands on the workspaces hub with no workspace yet.
    await skipVerification(page);

    await openUserMenu(page, "Mi perfil");
    await expect(page).toHaveURL(/\/profile/);
    // Profile is reachable without an active workspace: the page renders.
    await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  });
});
