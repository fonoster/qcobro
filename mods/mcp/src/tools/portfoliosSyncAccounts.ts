import type { Client } from "@qcobro/sdk";
import type { SyncAccountsInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/**
 * Synchronizes a batch of account rows into a portfolio. `mode` controls the
 * merge strategy: `APPEND_ONLY` adds new rows, `UPDATE_EXISTING` updates rows
 * that already exist, `REPLACE` replaces the set.
 */
export function createPortfoliosSyncAccounts(client: Client) {
  return (params: SyncAccountsInput) => runTool(() => client.portfolios.syncAccounts(params));
}
