import type { Client } from "@qcobro/sdk";
import type { CreatePortfolioInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Creates a portfolio in the active workspace. */
export function createPortfoliosCreate(client: Client) {
  return (params: CreatePortfolioInput) => runTool(() => client.portfolios.create(params));
}
