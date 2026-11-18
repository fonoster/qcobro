import type { Client } from "@qcobro/sdk";
import type { RecoveryBreakdownInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Breaks down the amount recovered in a period by one dimension. */
export function createRecoveryBreakdown(client: Client) {
  return (params: RecoveryBreakdownInput) => runTool(() => client.recovery.breakdown(params));
}
