import { Client } from "@qcobro/sdk";
import type { ServerEnv } from "../env.js";

/** Constructs a `@qcobro/sdk` `Client`, authenticates with the workspace API key, and selects the workspace. */
export async function createClient(env: ServerEnv): Promise<Client> {
  const client = new Client({ endpoint: env.endpoint });
  await client.loginWithApiKey({
    accessKeyId: env.accessKeyId,
    accessKeySecret: env.accessKeySecret
  });
  client.useWorkspace(env.workspace);
  return client;
}
