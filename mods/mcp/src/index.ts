#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { claudeDesktopConfigPath } from "./config/paths.js";
import { buildQCobroEntry, writeClaudeConfig } from "./config/writeClaudeConfig.js";
import { DEFAULT_ENDPOINT } from "./env.js";
import { serve } from "./server.js";

/**
 * `qcobro-mcp` — starts the QCobro MCP server (default) or configures an MCP
 * client to use it (`config` subcommand). All imports are relative; this file
 * ships inside `@qcobro/mcp`.
 */

export const USAGE = `Usage: qcobro-mcp [command] [options]

Commands:
  serve (default)               Start the QCobro MCP stdio server. Configured
                                 entirely via environment variables:
                                   QCOBRO_ACCESS_KEY_ID (required)
                                   QCOBRO_ACCESS_KEY_SECRET (required)
                                   QCOBRO_WORKSPACE (required)
                                   QCOBRO_ENDPOINT (default: ${DEFAULT_ENDPOINT})

  config                        Configure Claude Desktop to use this server.

Config options:
  --url <url>                   QCobro API base URL (default: ${DEFAULT_ENDPOINT})
  --access-key-id <id>          Workspace API key id
  --access-key-secret <secret>  Workspace API key secret
  --workspace <accessKeyId>     Workspace to act in (its accessKeyId)
  --help                        Show this help

Exit codes: 0 = success, 2 = usage/config error.
`;

/** Raised for usage or configuration failures — mapped to exit code 2. */
export class CliError extends Error {}

export interface ConfigOptions {
  url: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  workspace?: string;
  help: boolean;
}

const CONFIG_OPTION_SPEC = {
  url: { type: "string" },
  "access-key-id": { type: "string" },
  "access-key-secret": { type: "string" },
  workspace: { type: "string" },
  help: { type: "boolean", default: false }
} as const;

/** Parses the `config` subcommand's argv (excluding the `config` token itself). */
export function parseConfigArgs(argv: string[]): ConfigOptions {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: CONFIG_OPTION_SPEC, allowPositionals: false }));
  } catch (err) {
    throw new CliError(`Invalid arguments: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    url: values.url ?? DEFAULT_ENDPOINT,
    accessKeyId: values["access-key-id"],
    accessKeySecret: values["access-key-secret"],
    workspace: values.workspace,
    help: values.help ?? false
  };
}

/** Runs the `config` subcommand: writes/merges Claude Desktop's config file. */
export function runConfig(
  opts: ConfigOptions,
  env: Record<string, string | undefined>,
  stdout: (s: string) => void,
  platform: NodeJS.Platform = process.platform
): void {
  if (!opts.accessKeyId || !opts.accessKeySecret || !opts.workspace) {
    const missing = [
      !opts.accessKeyId && "--access-key-id",
      !opts.accessKeySecret && "--access-key-secret",
      !opts.workspace && "--workspace"
    ]
      .filter(Boolean)
      .join(", ");
    throw new CliError(`Missing required flag(s): ${missing}`);
  }

  const configPath = claudeDesktopConfigPath(platform, env);
  const entry = buildQCobroEntry({
    endpoint: opts.url,
    accessKeyId: opts.accessKeyId,
    accessKeySecret: opts.accessKeySecret,
    workspace: opts.workspace
  });
  const warning = writeClaudeConfig(configPath, entry);

  if (warning) stdout(`qcobro-mcp: ${warning}\n`);
  stdout(`Configured Claude Desktop to use QCobro MCP server (${configPath}).\n`);
  stdout("Restart Claude Desktop for the change to take effect.\n");
}

/** Entry point: dispatches on the first argv token, returns a process exit code. */
export async function main(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  stdout: (s: string) => void = (s) => process.stdout.write(s),
  stderr: (s: string) => void = (s) => process.stderr.write(s)
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === "--help" || command === "-h") {
    stdout(USAGE);
    return 0;
  }

  try {
    if (command === "config") {
      const opts = parseConfigArgs(rest);
      if (opts.help) {
        stdout(USAGE);
        return 0;
      }
      runConfig(opts, env, stdout);
      return 0;
    }

    if (command === undefined || command === "serve") {
      await serve();
      return 0;
    }

    throw new CliError(`Unknown command: ${command}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(`qcobro-mcp: ${message}\n`);
    if (err instanceof CliError) stderr(`\n${USAGE}`);
    return 2;
  }
}

// Only run when this file is the process entry point (not when imported by tests).
// Compares resolved real paths, not raw strings: npm/npx always launch bins through
// a node_modules/.bin symlink, so argv[1] is the symlink path while import.meta.url
// is already resolved to the real file — a raw-string comparison never matches there,
// silently skipping main() with no output and exit code 0.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
