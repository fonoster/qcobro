import type { Client } from "@qcobro/sdk";
import type { UpdatePortfolioInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Updates a portfolio. Set `archived: true` to archive it, `false` to restore it. */
export function createPortfoliosUpdate(client: Client) {
  return (params: UpdatePortfolioInput) => runTool(() => client.portfolios.update(params));
}
