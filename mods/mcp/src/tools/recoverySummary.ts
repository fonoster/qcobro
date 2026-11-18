import type { Client } from "@qcobro/sdk";
import type { RecoverySummaryInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Gets the amount recovered in a period, optionally for one portfolio. */
export function createRecoverySummary(client: Client) {
  return (params: RecoverySummaryInput) => runTool(() => client.recovery.summary(params));
}
