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
        contactLogs?: { some: { entrega: "DELIVERED" } };
      };
    }): Promise<number>;
  };
}

/**
 * Workspace-scoped contactability: the accounts under management, and how many of them have
 * actually been reached at least once.
 *
 * **Numerator — at least one gestión with `entrega: DELIVERED`.** This previously counted
 * `PortfolioAccount.lastContactedAt IS NOT NULL`, which is set on every *attempt* whether or
 * not it landed; a portfolio whose every call rang out reported a 100% contact rate. Delivery
 * is the question being asked, so `entrega` is the only field that can answer it.
 *
 * Reached is defined on `entrega` alone and deliberately not on `camino` or `resultado`: a
 * delivered message that produced no interaction is still a reached account. Equally, an
 * account whose attempts are all `DISPATCHED` or `FAILED` is not reached — a message still in
 * flight is not a contact.
 *
 * **Denominator — non-archived accounts in non-archived portfolios.** The portfolio filter
 * matters for more than tidiness: the Panel de control's "Cuentas en gestión" KPI sums
 * `portfolios.list`, which hides archived carteras, so counting their accounts here would make
 * two KPIs on the same screen disagree about what is under management.
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
        where: { ...base, contactLogs: { some: { entrega: "DELIVERED" as const } } }
      })
    ]);
    return { total, contacted };
  };
}
