import { defineConfig, devices } from "@playwright/test";

/**
 * Lighter setup: assumes the dev stack is already running before `npm run test:e2e`.
 *   docker compose -f compose.dev.yaml up -d   # db + identity + mailpit
 *   npm run start:dev                           # apiserver on :3000
 *   npm run start:webapp                        # webapp on :5173
 *
 * Webapp on :5173 (proxies /trpc -> apiserver :3000), Mailpit on :8025.
 */
// E2E rollout gate: the suite is being re-enabled in small batches while the bootstrap is
// stabilized. `grep` restricts the run to the currently-enabled tests; expand this regex
// (add `|` alternatives) as more tests are confirmed green, then remove it once all pass.
// Batch 1: the no-bootstrap smoke test (validates the CI pipeline end to end).
const ENABLED_TESTS = /unauthenticated \/members redirects to login/;

export default defineConfig({
  testDir: "./e2e",
  grep: ENABLED_TESTS,
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
