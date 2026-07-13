import type { Client, GetPortfolioInput } from "@qcobro/sdk";
import { runTool } from "./toolResult.js";

/** Gets a single portfolio by id within the active workspace. */
export function createPortfoliosGet(client: Client) {
  return (params: GetPortfolioInput) => runTool(() => client.portfolios.get(params));
}
