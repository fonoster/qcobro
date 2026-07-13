import type { Client, ListPortfoliosInput } from "@qcobro/sdk";
import { runTool } from "./toolResult.js";

/** Lists the active workspace's portfolios. */
export function createPortfoliosList(client: Client) {
  return (params: ListPortfoliosInput) => runTool(() => client.portfolios.list(params));
}
