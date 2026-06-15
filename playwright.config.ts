import { defineConfig, devices } from "@playwright/test";

/**
 * Lighter setup: assumes the dev stack is already running before `npm run test:e2e`.
 *   docker compose up -d            # postgres x2 + mailpit
 *   npm start --workspace=mods/identity-service
 *   npm run start:dev --workspace=mods/apiserver
 *   npm run start:webapp
 *
 * Webapp on :5173 (proxies /trpc -> apiserver :3000), Mailpit on :8025.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
