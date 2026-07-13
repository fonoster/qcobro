import type { Client, ListAccountsInput } from "@qcobro/sdk";
import { runTool } from "./toolResult.js";

/** Lists a page of a portfolio's accounts, with the total count. */
export function createPortfoliosListAccounts(client: Client) {
  return (params: ListAccountsInput) => runTool(() => client.portfolios.listAccounts(params));
}
