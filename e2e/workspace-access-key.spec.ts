import { test, expect } from "@playwright/test";
import { newOwner, signUpAndEnter } from "./helpers.js";

test.describe("workspace accessKeyId visibility", () => {
  test("the workspace card shows a copyable accessKeyId", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const unique = Date.now();
    await signUpAndEnter(page, newOwner(), `QA AccessKey ${unique}`);

    // --- Workspace picker card: visible, copyable, copy must NOT select the workspace ---
    await page.goto("/workspaces");
    const cardCopy = page.getByRole("button", { name: "Copiar ID del espacio" }).first();
    await expect(cardCopy).toBeVisible();
    const cardValue = ((await cardCopy.textContent()) ?? "").trim();
    expect(cardValue).toMatch(/^WO/);
    await cardCopy.click();
    await expect(page).toHaveURL(/\/workspaces/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cardValue);
  });
});
