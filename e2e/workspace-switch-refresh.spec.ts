import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

/**
 * Workspace switch refresh (bug report: "when I switch workspaces, with the workspace
 * switch, it doesn't update the current screen").
 *
 * Root cause: the active workspace is threaded into every tRPC request as a header
 * (`x-workspace`, read fresh from localStorage — see mods/webapp/src/lib/trpc.ts), never as
 * part of a React Query query key. `setWorkspace` (mods/webapp/src/lib/auth.tsx) updated
 * localStorage/context state but never invalidated the query cache, so an already-mounted
 * screen (e.g. Home) kept rendering whichever workspace's data it had already fetched.
 * Switching via the sidebar WorkspaceSwitcher never navigates, so nothing else was left to
 * trigger a refetch — exactly the "current screen doesn't update" symptom reported.
 *
 * This test reproduces it end-to-end: create two workspaces (one with a portfolio, one
 * empty), then flip between them with the WorkspaceSwitcher *without navigating away from
 * Home* and assert the dashboard reflects each workspace's own data immediately.
 *
 * Assumes the dev stack is running (see playwright.config.ts).
 */
test.describe("workspace switch — screen refresh", () => {
  test("switching workspaces via the sidebar switcher refreshes the current screen", async ({
    page
  }) => {
    const owner = newOwner("ws-switch");
    const stamp = Date.now();
    const wsAName = `Espacio A ${stamp}`;
    const wsBName = `Espacio B ${stamp}`;
    const portfolioName = `Cartera ${stamp}`;

    // --- Workspace A: sign up, create it, and give it one portfolio -------------------
    await signUpAndEnter(page, owner, wsAName);

    await page.getByRole("link", { name: "Carteras" }).click();
    await page.getByRole("button", { name: /Nueva cartera/ }).click();
    await page.getByLabel("Nombre de la cartera").fill(portfolioName);
    await page.getByLabel("ID del cliente").fill(`cli-${stamp}`);
    await page.getByRole("button", { name: "Crear cartera" }).click();
    await expect(page.getByText(portfolioName)).toBeVisible();

    // --- Workspace B: created empty, via the account-level workspaces hub -------------
    await page.getByRole("link", { name: "Ir a la lista de espacios" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    await page.getByRole("button", { name: "Nuevo espacio" }).click();
    await page.getByPlaceholder("Ej. Cartera Abril").fill(wsBName);
    await page.getByRole("button", { name: "Crear espacio" }).click();
    // Creating a workspace navigates to "/" under the new (empty) workspace.
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.getByText("Aún no hay carteras.")).toBeVisible();
    await expect(page.getByText(portfolioName)).toHaveCount(0);

    // --- The actual bug: flip back to workspace A with the sidebar switcher, staying on
    // the dashboard the whole time (no navigation) --------------------------------------
    await page.getByRole("button", { name: wsBName }).click(); // opens the switcher
    await page.getByRole("button", { name: wsAName }).click(); // picks workspace A
    await expect(page).toHaveURL(/localhost:\d+\/$/);

    // The dashboard must now show workspace A's portfolio, not workspace B's empty state —
    // without a reload or route change.
    await expect(page.getByText(portfolioName)).toBeVisible();
    await expect(page.getByText("Aún no hay carteras.")).toHaveCount(0);

    // --- Round trip: flip forward to B again and confirm it goes empty again, proving
    // this is a real refetch and not an artifact of first-load ordering -----------------
    await page.getByRole("button", { name: wsAName }).click();
    await page.getByRole("button", { name: wsBName }).click();
    await expect(page.getByText("Aún no hay carteras.")).toBeVisible();
    await expect(page.getByText(portfolioName)).toHaveCount(0);
  });
});
