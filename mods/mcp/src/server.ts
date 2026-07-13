import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readServerEnv } from "./env.js";
import { createClient } from "./utils/createClient.js";
import { registerTools } from "./tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Starts the MCP stdio server: authenticates, registers tools, and connects the transport. */
export async function serve(): Promise<void> {
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
  const env = readServerEnv();
  const client = await createClient(env);

  const server = new McpServer({ name: "QCobro MCP Server", version: packageJson.version });
  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
