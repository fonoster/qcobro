import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@qcobro/sdk";
import { listPortfoliosSchema, getPortfolioSchema, listAccountsSchema } from "@qcobro/sdk";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema
} from "@qcobro/common";
import { createPortfoliosList } from "./portfoliosList.js";
import { createPortfoliosGet } from "./portfoliosGet.js";
import { createPortfoliosCreate } from "./portfoliosCreate.js";
import { createPortfoliosUpdate } from "./portfoliosUpdate.js";
import { createPortfoliosDelete } from "./portfoliosDelete.js";
import { createPortfoliosListAccounts } from "./portfoliosListAccounts.js";
import { createPortfoliosSyncAccounts } from "./portfoliosSyncAccounts.js";

/** Registers the portfolios tool surface with the MCP server. */
export function registerTools(server: McpServer, client: Client): void {
  server.tool(
    "portfolios_list",
    "Lists the active workspace's portfolios. Pass includeArchived to include archived ones.",
    listPortfoliosSchema.unwrap().shape,
    createPortfoliosList(client)
  );

  server.tool(
    "portfolios_get",
    "Gets a single portfolio by id within the active workspace.",
    getPortfolioSchema.shape,
    createPortfoliosGet(client)
  );

  server.tool(
    "portfolios_create",
    "Creates a portfolio in the active workspace.",
    createPortfolioSchema.shape,
    createPortfoliosCreate(client)
  );

  server.tool(
    "portfolios_update",
    "Updates a portfolio. Set archived: true to archive it, false to restore it.",
    updatePortfolioSchema.shape,
    createPortfoliosUpdate(client)
  );

  server.tool(
    "portfolios_delete",
    "Deletes a portfolio in the active workspace.",
    deletePortfolioSchema.shape,
    createPortfoliosDelete(client)
  );

  server.tool(
    "portfolios_list_accounts",
    "Lists a page of a portfolio's accounts, with the total count.",
    listAccountsSchema.shape,
    createPortfoliosListAccounts(client)
  );

  server.tool(
    "portfolios_sync_accounts",
    "Synchronizes a batch of account rows into a portfolio (APPEND_ONLY, UPDATE_EXISTING, or REPLACE mode).",
    syncAccountsInputSchema.shape,
    createPortfoliosSyncAccounts(client)
  );
}
