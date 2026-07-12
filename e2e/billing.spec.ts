import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter, openUserMenu } from "./helpers.js";

/**
 * Billing console golden path: Facturación is reachable from the user menu and
 * renders the state matching the deployment — the disabled note when the
 * deployment has no billing, or the not-enrolled card with the owner-only
 * "Elegir un plan" entry point when billing is enabled. Exhausted/paused
 * states and ledger math are covered by the engine integration tests and the
 * billing evaluation (they need seeded ledgers); the banners' visual variants
 * live in Storybook.
 */
test.describe("billing console", () => {
  test("Facturación renders from the user menu with an owner entry point", async ({ page }) => {
    const owner = newOwner("billing");
    const stamp = Date.now();
    await signUpAndEnter(page, owner, `WS ${stamp}`);

    await openUserMenu(page, "Facturación");
    await expect(page).toHaveURL(/\/billing$/);
    await expect(page.getByRole("heading", { name: "Facturación" })).toBeVisible();

    // One of the two zero-state cards must render (deployment-dependent).
    const disabled = page.getByText("La facturación no está habilitada", { exact: false });
    const notEnrolled = page.getByText("aún no tiene un plan", { exact: false });
    await expect(disabled.or(notEnrolled)).toBeVisible();

    // When billing is enabled, the workspace owner sees the plan entry point
    // (owner-only per the billing-console spec) and the plan modal opens with
    // the catalog in upgrade-path order.
    if (await notEnrolled.isVisible()) {
      const choose = page.getByRole("button", { name: "Elegir un plan" });
      await expect(choose).toBeVisible();
      await choose.click();
      await expect(page.getByText("Gestionar plan")).toBeVisible();
    }
  });
});
