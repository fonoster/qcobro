import { CHANNEL_FAILED_OUTCOMES } from "@qcobro/common";

export interface ContactStatsResult {
  total: number;
  contacted: number;
}

/** Minimal Prisma surface this statistic needs. */
export interface ContactStatsClient {
  portfolioAccount: {
    count(args: {
      where: {
        archivedAt: null;
        portfolio: { workspaceRef: string };
        contactLogs?: { some: { outcome: { notIn: readonly string[] } } };
      };
    }): Promise<number>;
  };
}

/**
 * Workspace-scoped contactability statistic (see the `portfolios` capability): the accounts
 * under management, and how many of them have been reached at least once.
 *
 * Denominator — every non-archived `PortfolioAccount` in the workspace (unchanged from the
 * pre-fix query). Numerator — those with at least one gestión whose outcome is *not* in
 * {@link CHANNEL_FAILED_OUTCOMES}. Expressed as an exclusion, not `outcome === "DELIVERED"`,
 * because a downstream engagement outcome (`PAYMENT_PROMISE`, `CALLBACK_REQUESTED`, ...) only
 * happens once the channel already worked.
 */
export function createContactStats(client: ContactStatsClient) {
  return async (workspaceRef: string): Promise<ContactStatsResult> => {
    const base = {
      archivedAt: null as null,
      portfolio: { workspaceRef }
    };
    const [total, contacted] = await Promise.all([
      client.portfolioAccount.count({ where: base }),
      client.portfolioAccount.count({
        where: {
          ...base,
          contactLogs: { some: { outcome: { notIn: CHANNEL_FAILED_OUTCOMES } } }
        }
      })
    ]);
    return { total, contacted };
  };
}
