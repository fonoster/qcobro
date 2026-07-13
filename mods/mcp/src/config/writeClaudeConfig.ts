import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface McpServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ClaudeDesktopConfig {
  mcpServers: Record<string, McpServerEntry>;
  [key: string]: unknown;
}

/** Builds the `qcobro` MCP server entry from resolved credentials. */
export function buildQCobroEntry(config: {
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  workspace: string;
}): McpServerEntry {
  return {
    command: "npx",
    args: ["-y", "@qcobro/mcp@latest"],
    env: {
      QCOBRO_ENDPOINT: config.endpoint,
      QCOBRO_ACCESS_KEY_ID: config.accessKeyId,
      QCOBRO_ACCESS_KEY_SECRET: config.accessKeySecret,
      QCOBRO_WORKSPACE: config.workspace
    }
  };
}

/**
 * Merges a `qcobro` entry into an existing (possibly absent or unparseable)
 * Claude Desktop config, preserving any other `mcpServers` entries already
 * present. Pure — does no I/O.
 */
export function mergeClaudeConfig(
  existingRaw: string | undefined,
  entry: McpServerEntry
): { config: ClaudeDesktopConfig; warning?: string } {
  let config: ClaudeDesktopConfig = { mcpServers: {} };
  let warning: string | undefined;

  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as ClaudeDesktopConfig;
      config = { ...parsed, mcpServers: { ...(parsed.mcpServers ?? {}) } };
    } catch {
      warning = "Could not parse existing Claude Desktop config; starting from a new one.";
    }
  }

  config.mcpServers.qcobro = entry;
  return { config, warning };
}

/** Reads (if present), merges, and writes the `qcobro` entry into `configPath`. Returns any warning raised. */
export function writeClaudeConfig(configPath: string, entry: McpServerEntry): string | undefined {
  const existingRaw = existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined;
  const { config, warning } = mergeClaudeConfig(existingRaw, entry);

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  return warning;
}
