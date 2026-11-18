import {
  recoverySummaryInputSchema,
  withErrorHandlingAndValidation,
  type RecoveryReadClient,
  type RecoverySummary,
  type RecoverySummaryInput,
  type WorkspaceSettingsClient
} from "@qcobro/common";
import { createGetWorkspaceSettings } from "../workspaceSettings/getWorkspaceSettings.js";
import { periodRange, recoveryWhere } from "./period.js";

/**
 * Recuperado for a period: the recoveries detected in it, split by whether the account had a
 * gestión between syncs, plus how many exits are still waiting for a reason.
 */
export function createRecoverySummary(
  client: RecoveryReadClient & WorkspaceSettingsClient,
  workspaceRef: string
) {
  const getSettings = createGetWorkspaceSettings(client);

  const fn = async (input: RecoverySummaryInput): Promise<RecoverySummary> => {
    const settings = await getSettings(workspaceRef);
    const range = periodRange(input.from, input.to, settings.timezone);
    const [rows, pendingExits] = await Promise.all([
      client.recovery.findMany({
        where: recoveryWhere(workspaceRef, range, input.portfolioId),
        select: { amount: true, hasGestion: true }
      }),
      client.accountExit.count({
        where: {
          reason: "UNKNOWN",
          reenteredAt: null,
          ...(input.portfolioId ? { portfolioId: input.portfolioId } : {}),
          portfolioAccount: { portfolio: { workspaceRef } }
        }
      })
    ]);

    const result: RecoverySummary = {
      recovered: 0,
      count: 0,
      withoutGestion: 0,
      withoutGestionCount: 0,
      pendingExits,
      currency: settings.currency
    };
    for (const row of rows as { amount: number; hasGestion: boolean }[]) {
      if (row.hasGestion) {
        result.recovered += row.amount;
        result.count++;
      } else {
        result.withoutGestion += row.amount;
        result.withoutGestionCount++;
      }
    }
    return result;
  };

  return withErrorHandlingAndValidation(fn, recoverySummaryInputSchema);
}
