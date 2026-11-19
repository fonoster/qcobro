import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@qcobro/sdk";
import { listPortfoliosSchema, getPortfolioSchema, listAccountsSchema } from "@qcobro/sdk";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema,
  listExitsInputSchema,
  classifyExitsInputSchema,
  recoverySummaryInputSchema,
  recoveryBreakdownInputSchema,
  recoveryListInputSchema
} from "@qcobro/common";
import { createPortfoliosList } from "./portfoliosList.js";
import { createPortfoliosGet } from "./portfoliosGet.js";
import { createPortfoliosCreate } from "./portfoliosCreate.js";
import { createPortfoliosUpdate } from "./portfoliosUpdate.js";
import { createPortfoliosDelete } from "./portfoliosDelete.js";
import { createPortfoliosListAccounts } from "./portfoliosListAccounts.js";
import { createPortfoliosSyncAccounts } from "./portfoliosSyncAccounts.js";
import { createPortfoliosListExits } from "./portfoliosListExits.js";
import { createPortfoliosClassifyExits } from "./portfoliosClassifyExits.js";
import { createRecoverySummary } from "./recoverySummary.js";
import { createRecoveryBreakdown } from "./recoveryBreakdown.js";
import { createRecoveryList } from "./recoveryList.js";

/** Registers the portfolios and recovery tool surface with the MCP server. */
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
    "Synchronizes a batch of account rows into a portfolio (APPEND_ONLY, UPDATE_EXISTING, or REPLACE mode). Pass exits to record accounts that left, with a reason; CAUGHT_UP and PAID_OFF exits also need missedInstallments and termsAmount.",
    syncAccountsInputSchema.shape,
    createPortfoliosSyncAccounts(client)
  );

  server.tool(
    "portfolios_list_exits",
    "Lists the accounts that left a portfolio and have not come back, optionally filtered by reason.",
    listExitsInputSchema.shape,
    createPortfoliosListExits(client)
  );

  server.tool(
    "portfolios_classify_exits",
    "Assigns a reason to exits recorded as UNKNOWN. CAUGHT_UP or PAID_OFF require missedInstallments and termsAmount and record a recovery of their product.",
    classifyExitsInputSchema.shape,
    createPortfoliosClassifyExits(client)
  );

  server.tool(
    "recovery_summary",
    "Gets the amount recovered in a period (from/to, YYYY-MM-DD, inclusive), optionally for one portfolio.",
    recoverySummaryInputSchema.shape,
    createRecoverySummary(client)
  );

  server.tool(
    "recovery_breakdown",
    "Breaks down the amount recovered in a period by CAMPAIGN, CHANNEL, OUTCOME or DAYS_SINCE_TOUCH. CAMPAIGN amounts are not additive.",
    recoveryBreakdownInputSchema.shape,
    createRecoveryBreakdown(client)
  );

  server.tool(
    "recovery_list",
    "Lists the recoveries detected in a period.",
    recoveryListInputSchema.shape,
    createRecoveryList(client)
  );
}
