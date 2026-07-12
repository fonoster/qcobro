/**
 * Dev tool: mint a workspace API key for the seeded demo workspace, printing the
 * accessKeyId/accessKeySecret pair (shown ONCE — Identity never returns the secret
 * again). Use it to drive server-to-server surfaces locally: the SDK, or
 * `npx -p @qcobro/common engine-eval` against this deployment.
 *
 *   npm run apikey:create --workspace=mods/apiserver
 *
 * Env overrides: SEED_EMAIL / SEED_PASSWORD (demo login), SEED_WORKSPACE (name).
 */
import { createIdentityClient } from "@fonoster/identity-client";
import { config } from "../src/config.js";

const EMAIL = process.env.SEED_EMAIL ?? "demo@qcobro.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "password123";
const WORKSPACE_NAME = process.env.SEED_WORKSPACE ?? "Mikro Créditos";

async function main(): Promise<void> {
  const identity = createIdentityClient(config.identity.endpoint);

  const { accessToken } = await identity.exchangeCredentials({
    username: EMAIL,
    password: PASSWORD
  });

  const workspace = (await identity.listWorkspaces(accessToken)).items.find(
    (w) => w.name === WORKSPACE_NAME
  );
  if (!workspace) {
    throw new Error(`Workspace "${WORKSPACE_NAME}" not found — run \`npm run db:seed\` first`);
  }

  const key = await identity.createApiKey(
    { role: "WORKSPACE_ADMIN" },
    workspace.accessKeyId,
    accessToken
  );

  console.log(`\nAPI key for "${WORKSPACE_NAME}" (workspaceRef ${workspace.accessKeyId})`);
  console.log(`  accessKeyId:     ${key.accessKeyId}`);
  console.log(`  accessKeySecret: ${key.accessKeySecret}`);
  console.log("\nThe secret is shown only once — store it now. Try it with:");
  console.log(
    `  npx -p @qcobro/common engine-eval --url http://localhost:${config.apiserver.port} \\`
  );
  console.log(`    --access-key-id ${key.accessKeyId} --access-key-secret <secret>\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
