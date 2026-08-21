import {
  contactStatsInputSchema,
  withErrorHandlingAndValidation,
  type ContactStatsInput
} from "@qcobro/common";

export interface ContactStatsResult {
  /** Distinct accounts with >=1 gestión (any entrega) in the window. The rate's denominator. */
  total: number;
  /** Distinct accounts with >=1 DELIVERED gestión in the window. The rate's numerator. */
  contacted: number;
  /** Total gestión rows in the window, regardless of account — the "envíos" figure the card
   *  shows alongside the rate. Not part of the ratio: this is attempt volume, the rate is
   *  account coverage. A window where this number balloons relative to `total` means the
   *  engine is grinding retries against unreachable numbers. */
  totalSends: number;
}

const PERIOD_MS: Record<ContactStatsInput["period"], number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "28d": 28 * 24 * 60 * 60 * 1000
};

/** Minimal Prisma surface this statistic needs. */
export interface ContactStatsClient {
  accountContactLog: {
    /** `distinct` + a single-field `select` gets one row per distinct `portfolioAccountId`
     *  without a raw `groupBy`, so `.length` is the distinct-account count. */
    findMany(args: {
      where: {
        contactedAt: { gte: Date };
        entrega?: "DELIVERED";
        portfolioAccount: { portfolio: { workspaceRef: string } };
      };
      distinct: ["portfolioAccountId"];
      select: { portfolioAccountId: true };
    }): Promise<{ portfolioAccountId: string }[]>;

    count(args: {
      where: {
        contactedAt: { gte: Date };
        portfolioAccount: { portfolio: { workspaceRef: string } };
      };
    }): Promise<number>;
  };
}

/**
 * Windowed contactability: within the selected period, how many distinct accounts were
 * attempted at least once, how many of those were actually reached, and how many gestión
 * (send) attempts that took in total.
 *
 * **Windowed, not all-time.** This previously counted `portfolioAccount` rows with no date
 * filter at all — an account reached once counted as reached forever, so the number only
 * climbed toward 100% and sat there, measuring import history rather than contact performance.
 * It now counts `accountContactLog` rows with `contactedAt` inside `[now - period, now)`, so an
 * account that goes quiet drops back out of both the numerator and the denominator once its
 * gestiones age out of the window.
 *
 * **Account-level, not attempt-level.** The denominator is every distinct account with >=1
 * gestión in the window; the numerator is every distinct account with >=1 `DELIVERED` gestión
 * in the window. Each account counts once no matter how many attempts it took. The obvious
 * alternative — "of X sent, Y delivered" — reintroduces a worse distortion: a retry to someone
 * who did not receive the first message drops the rate, and *succeeding* on the second attempt
 * still only scores 50%. Both are backwards; reaching the account is the objective, and how
 * many tries it took is a separate question (see issue #109 for the worked example). Retrying
 * an unreached account changes neither count; reaching it on any attempt inside the window
 * counts it as reached exactly once.
 *
 * **Reached is defined on `entrega` alone**, deliberately not on `camino` or `resultado`: a
 * delivered message that produced no interaction is still a reached account. An account whose
 * attempts are all `DISPATCHED` or `FAILED` is not reached — a message still in flight is not
 * a contact.
 *
 * **`totalSends`** is the raw gestión count in the window — the "envíos" figure the card shows
 * next to the rate. The gap between it and `total` is the retry load: it carries information
 * a blended percentage hides, and it's also what an empty window is detected from, since a zero
 * denominator rendering as 0% is the most common way a metric like this lies.
 *
 * No archived-account/archived-portfolio filter here (unlike the old all-time version): those
 * filters existed to keep this number in step with "Cuentas en gestión", a *current* snapshot.
 * A windowed rate is asking what happened during the period, not what the book looks like
 * today, so a gestión sent while an account was active still counts even if the account or its
 * portfolio was archived afterward — mirroring how `contactLog.list` scopes gestiones (by
 * workspace only, not current archived state).
 */
export function createContactStats(client: ContactStatsClient, workspaceRef: string) {
  const fn = async (params: ContactStatsInput): Promise<ContactStatsResult> => {
    const since = new Date(Date.now() - PERIOD_MS[params.period]);
    const windowWhere = {
      contactedAt: { gte: since },
      portfolioAccount: { portfolio: { workspaceRef } }
    };

    const [attempted, delivered, totalSends] = await Promise.all([
      client.accountContactLog.findMany({
        where: windowWhere,
        distinct: ["portfolioAccountId"],
        select: { portfolioAccountId: true }
      }),
      client.accountContactLog.findMany({
        where: { ...windowWhere, entrega: "DELIVERED" as const },
        distinct: ["portfolioAccountId"],
        select: { portfolioAccountId: true }
      }),
      client.accountContactLog.count({ where: windowWhere })
    ]);

    return { total: attempted.length, contacted: delivered.length, totalSends };
  };

  return withErrorHandlingAndValidation(fn, contactStatsInputSchema);
}
