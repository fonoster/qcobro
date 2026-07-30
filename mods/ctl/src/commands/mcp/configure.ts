import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import { getActiveWorkspace, getConfig } from "../../config/index.js";
import { CONFIG_FILE, DEFAULT_ENDPOINT } from "../../constants.js";
import { claudeDesktopConfigPath } from "../../mcpConfigure/paths.js";
import { buildQCobroEntry, writeClaudeConfig } from "../../mcpConfigure/writeClaudeConfig.js";

/**
 * Configures an MCP client to use `@qcobro/mcp`. Supersedes `@qcobro/mcp`'s
 * removed `config` subcommand — see `mods/mcp/src/config/` (deleted) and this
 * package's `src/mcpConfigure/` (the ported, unchanged logic).
 */
export default class Configure extends BaseCommand<typeof Configure> {
  static override readonly description = "configure an MCP client to use @qcobro/mcp";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --client claude",
    "<%= config.bin %> <%= command.id %> --access-key-id <id> --access-key-secret <secret> --workspace <workspaceAccessKeyId>"
  ];
  static override readonly flags = {
    client: Flags.string({
      char: "c",
      description: "MCP client to configure",
      default: "claude",
      options: ["claude"]
    }),
    url: Flags.string({ description: "QCobro API base URL", default: DEFAULT_ENDPOINT }),
    "access-key-id": Flags.string({
      description: "workspace API key id (overrides active workspace)"
    }),
    "access-key-secret": Flags.string({
      description: "workspace API key secret (overrides active workspace)"
    }),
    workspace: Flags.string({
      description: "workspace to act in, its accessKeyId (overrides active workspace)"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Configure);

    const credentials = this.resolveCredentials(flags);

    const configPath = claudeDesktopConfigPath(process.platform, process.env);
    const entry = buildQCobroEntry({
      endpoint: credentials.endpoint,
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      workspace: credentials.workspace
    });
    const warning = writeClaudeConfig(configPath, entry);

    if (warning) this.warn(warning);
    this.log(`Configured ${flags.client} to use the QCobro MCP server (${configPath}).`);
    this.log("Restart the client for the change to take effect.");
  }

  private resolveCredentials(flags: {
    url: string;
    "access-key-id"?: string;
    "access-key-secret"?: string;
    workspace?: string;
  }): { endpoint: string; accessKeyId: string; accessKeySecret: string; workspace: string } {
    if (flags["access-key-id"] && flags["access-key-secret"] && flags.workspace) {
      return {
        endpoint: flags.url,
        accessKeyId: flags["access-key-id"],
        accessKeySecret: flags["access-key-secret"],
        workspace: flags.workspace
      };
    }

    const activeWorkspace = getActiveWorkspace(getConfig(CONFIG_FILE));
    if (!activeWorkspace) {
      this.error(
        "No active workspace and no --access-key-id/--access-key-secret/--workspace flags given. " +
          "Run `qcobro workspaces:login` first, or pass all three flags.",
        { exit: 1 }
      );
    }

    return {
      endpoint: activeWorkspace.endpoint,
      accessKeyId: activeWorkspace.accessKeyId,
      accessKeySecret: activeWorkspace.accessKeySecret,
      workspace: activeWorkspace.workspaceAccessKeyId
    };
  }
}
