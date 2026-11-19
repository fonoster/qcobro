import { defineConfig, devices } from "@playwright/test";

/**
 * Runs inside the dev container (README `## Local development`), against a stack already
 * running there. `bash .devcontainer/ci-e2e.sh` starts it and runs this suite, as CI does:
 *   npm run start:dev      # apiserver on :3000
 *   npm run start:webapp   # webapp on :5173
 *
 * Webapp on :5173 (proxies /trpc -> apiserver :3000), Mailpit on mailpit:8025.
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
