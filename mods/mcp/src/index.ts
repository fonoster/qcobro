#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_ENDPOINT } from "./env.js";
import { serve } from "./server.js";

/**
 * `qcobro-mcp` — starts the QCobro MCP stdio server. All imports are
 * relative; this file ships inside `@qcobro/mcp`.
 *
 * MCP-client configuration (writing a client's `mcpServers` entry, e.g.
 * Claude Desktop's `claude_desktop_config.json`) lives in `@qcobro/ctl`'s
 * `mcp:configure` command, not here — see that package's `src/mcpConfigure/`
 * for the (ported, unchanged) logic this file used to run under a `config`
 * subcommand.
 */

export const USAGE = `Usage: qcobro-mcp [serve] [options]

Starts the QCobro MCP stdio server (the default with no arguments, or
explicitly via \`serve\`). Configured entirely via environment variables:
  QCOBRO_ACCESS_KEY_ID (required)
  QCOBRO_ACCESS_KEY_SECRET (required)
  QCOBRO_WORKSPACE (required)
  QCOBRO_ENDPOINT (default: ${DEFAULT_ENDPOINT})

Options:
  --help                         Show this help

To configure an MCP client (e.g. Claude Desktop) to use this server, run
\`npx @qcobro/ctl mcp:configure\` instead.

Exit codes: 0 = success, 2 = usage error.
`;

/** Raised for usage failures — mapped to exit code 2. */
export class CliError extends Error {}

/** Entry point: dispatches on the first argv token, returns a process exit code. */
export async function main(
  argv: string[],
  stdout: (s: string) => void = (s) => process.stdout.write(s),
  stderr: (s: string) => void = (s) => process.stderr.write(s)
): Promise<number> {
  const [command] = argv;

  if (command === "--help" || command === "-h") {
    stdout(USAGE);
    return 0;
  }

  try {
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
