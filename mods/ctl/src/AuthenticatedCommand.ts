import { Command } from "@oclif/core";
import { Client } from "@qcobro/sdk";
import { BaseCommand } from "./BaseCommand.js";
import { getActiveWorkspace, getConfig } from "./config/index.js";
import { CONFIG_FILE } from "./constants.js";

/**
 * Base class for commands that need an authenticated `@qcobro/sdk` `Client`.
 * Constructs the client from the active workspace's stored credentials, the
 * same way `@qcobro/mcp`'s `createClient` util does (`loginWithApiKey` then
 * `useWorkspace`) — see `mods/mcp/src/utils/createClient.ts`.
 */
export abstract class AuthenticatedCommand<T extends typeof Command> extends BaseCommand<T> {
  protected async createSdkClient(): Promise<Client> {
    const workspaces = getConfig(CONFIG_FILE);
    const activeWorkspace = getActiveWorkspace(workspaces);

    if (!activeWorkspace) {
      this.error("No active workspace found. Run `qcobro workspaces:login` first.", { exit: 1 });
    }

    try {
      const client = new Client({ endpoint: activeWorkspace.endpoint });

      await client.loginWithApiKey({
        accessKeyId: activeWorkspace.accessKeyId,
        accessKeySecret: activeWorkspace.accessKeySecret
      });
      client.useWorkspace(activeWorkspace.workspaceAccessKeyId);

      return client;
    } catch {
      return this.error(
        "Failed to initialize the SDK client. Try `qcobro workspaces:login` again.",
        { exit: 1 }
      );
    }
  }
}
