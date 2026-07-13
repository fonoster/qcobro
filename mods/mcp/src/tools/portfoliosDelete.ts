import type { Client } from "@qcobro/sdk";
import type { DeletePortfolioInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Deletes a portfolio in the active workspace. */
export function createPortfoliosDelete(client: Client) {
  return (params: DeletePortfolioInput) => runTool(() => client.portfolios.delete(params));
}
