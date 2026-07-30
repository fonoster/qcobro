import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves Claude Desktop's config file path for the given platform.
 *
 * Ported from `mods/mcp/src/config/paths.ts` (behavior unchanged) as part of
 * consolidating MCP-client configuration into `@qcobro/ctl`'s `mcp:configure`
 * command.
 */
export function claudeDesktopConfigPath(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>
): string {
  if (platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }
  if (platform === "win32") {
    const appData = env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  throw new Error(`Unsupported platform for Claude Desktop config: ${platform}`);
}
