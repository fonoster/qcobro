import type { Client } from "@qcobro/sdk";
import type { ClassifyExitsInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Assigns a reason to exits recorded as UNKNOWN. */
export function createPortfoliosClassifyExits(client: Client) {
  return (params: ClassifyExitsInput) => runTool(() => client.portfolios.classifyExits(params));
}
