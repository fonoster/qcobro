import type { Client } from "@qcobro/sdk";
import type { ListExitsInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Lists the accounts that left a portfolio and have not come back. */
export function createPortfoliosListExits(client: Client) {
  return (params: ListExitsInput) => runTool(() => client.portfolios.listExits(params));
}
