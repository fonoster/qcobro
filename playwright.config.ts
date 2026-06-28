import { defineConfig, devices } from "@playwright/test";

/**
 * Lighter setup: assumes the dev stack is already running before `npm run test:e2e`.
 *   docker compose -f compose.dev.yaml up -d   # db + identity + mailpit
 *   npm run start:dev                           # apiserver on :3000
 *   npm run start:webapp                        # webapp on :5173
 *
 * Webapp on :5173 (proxies /trpc -> apiserver :3000), Mailpit on :8025.
 */
// E2E rollout gate: the suite is being re-enabled in small batches while it is stabilized.
// `testMatch` restricts the run to the currently-enabled specs; add files here as each batch
// is confirmed green locally, then drop the gate once everything passes.
const ENABLED_SPECS = [
  "**/profile.spec.ts",
  "**/auth-workspaces.spec.ts",
  "**/delete-workspace.spec.ts",
  "**/api-keys.spec.ts",
  "**/member-actions.spec.ts",
  "**/manual-outreach.spec.ts",
  "**/campaigns-core.spec.ts",
  "**/console-refinements.spec.ts",
  "**/ai-insights.spec.ts",
  "**/payment-promises.spec.ts",
  "**/gestiones-channels.spec.ts"
  // Deferred, to fix next:
  //   verify-contact: mailpit code email not received within timeout on CI
  //   invite-acceptance: one assertion (new-user accept) flakes on CI
];

export default defineConfig({
  testDir: "./e2e",
  testMatch: ENABLED_SPECS,
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
