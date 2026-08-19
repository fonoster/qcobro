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
        portfolio: { workspaceRef: string; archivedAt: null };
        contactLogs?: { some: { outcome: { notIn: readonly string[] } } };
      };
    }): Promise<number>;
  };
}

/**
 * Workspace-scoped contactability statistic (see the `portfolios` capability): the accounts
 * under management, and how many of them have been reached at least once.
 *
 * Denominator — every non-archived `PortfolioAccount` in a non-archived portfolio. The
 * portfolio filter matters for more than tidiness: the Panel de control's "Cuentas en
 * gestión" KPI sums `portfolios.list`, which hides archived carteras, so counting their
 * accounts here would make two KPIs on the same screen disagree about what is under
 * management.
 *
 * Numerator — those with at least one gestión whose outcome is *not* in
 * {@link CHANNEL_FAILED_OUTCOMES}. Expressed as an exclusion, not `outcome === "DELIVERED"`,
 * because a downstream engagement outcome (`PAYMENT_PROMISE`, `CALLBACK_REQUESTED`, ...) only
 * happens once the channel already worked.
 */
export function createContactStats(client: ContactStatsClient) {
  return async (workspaceRef: string): Promise<ContactStatsResult> => {
    const base = {
      archivedAt: null as null,
      portfolio: { workspaceRef, archivedAt: null as null }
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
