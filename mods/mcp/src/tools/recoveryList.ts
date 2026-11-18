import type { Client } from "@qcobro/sdk";
import type { RecoveryListInput } from "@qcobro/common";
import { runTool } from "./toolResult.js";

/** Lists a page of the recoveries detected in a period, with the total count. */
export function createRecoveryList(client: Client) {
  return (params: RecoveryListInput) => runTool(() => client.recovery.list(params));
}
