import {
  recoveryBreakdownInputSchema,
  withErrorHandlingAndValidation,
  type RecoveryBreakdown,
  type RecoveryBreakdownInput,
  type RecoveryBreakdownRow,
  type RecoveryContext,
  type RecoveryReadClient,
  type WorkspaceSettingsClient
} from "@qcobro/common";
import { createGetWorkspaceSettings } from "../workspaceSettings/getWorkspaceSettings.js";
import { periodRange, recoveryWhere } from "./period.js";

interface BreakdownSource {
  amount: number;
  lastTouchAgentType: string | null;
  lastTouchOutcome: string | null;
  daysSinceLastTouch: number | null;
  context: RecoveryContext;
}

function daysBucket(days: number | null): string {
  const d = days ?? 0;
  if (d <= 1) return "0-1";
  if (d <= 3) return "2-3";
  if (d <= 7) return "4-7";
  return "8+";
}

/** The rows a recovery contributes to, by dimension: one each, or one per campaign. */
function keysOf(
  by: RecoveryBreakdownInput["by"],
  r: BreakdownSource
): { key: string; name: string | null }[] {
  switch (by) {
    case "CAMPAIGN":
      return r.context.activeCampaigns.map((c) => ({ key: c.id, name: c.name }));
    case "CHANNEL":
      return [{ key: r.lastTouchAgentType ?? "NONE", name: null }];
    case "OUTCOME":
      return [{ key: r.lastTouchOutcome ?? r.context.lastTouch?.path ?? "NONE", name: null }];
    case "DAYS_SINCE_TOUCH":
      return [{ key: daysBucket(r.daysSinceLastTouch), name: null }];
  }
}

/**
 * Recuperado for a period broken down by campaign, channel, outcome or days since the last
 * gestión. Same base as `recovered`: only recoveries with a gestión between syncs. CAMPAIGN is
 * not additive, since a recovery counts in full for every campaign active on the account.
 */
export function createRecoveryBreakdown(
  client: RecoveryReadClient & WorkspaceSettingsClient,
  workspaceRef: string
) {
  const getSettings = createGetWorkspaceSettings(client);

  const fn = async (input: RecoveryBreakdownInput): Promise<RecoveryBreakdown> => {
    const settings = await getSettings(workspaceRef);
    const range = periodRange(input.from, input.to, settings.timezone);
    const rows = (await client.recovery.findMany({
      where: { ...recoveryWhere(workspaceRef, range, input.portfolioId), hasGestion: true },
      select: {
        amount: true,
        lastTouchAgentType: true,
        lastTouchOutcome: true,
        daysSinceLastTouch: true,
        context: true
      }
    })) as unknown as BreakdownSource[];

    const totals = new Map<string, RecoveryBreakdownRow>();
    for (const r of rows) {
      for (const { key, name } of keysOf(input.by, r)) {
        const row = totals.get(key) ?? { key, name, amount: 0, count: 0 };
        row.amount += r.amount;
        row.count++;
        totals.set(key, row);
      }
    }
    return {
      additive: input.by !== "CAMPAIGN",
      rows: [...totals.values()].sort((a, b) => b.amount - a.amount)
    };
  };

  return withErrorHandlingAndValidation(fn, recoveryBreakdownInputSchema);
}
