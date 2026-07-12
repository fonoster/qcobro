import { assertMicroUnits, type BillingClient } from "@qcobro/common";

/**
 * Derives a workspace's balance from the ledger (SUM of signed entries). The
 * ledger is the source of truth — nothing caches this except tick-scoped
 * credit buckets, which are reseeded from it every tick.
 */
export async function workspaceBalanceMicroTx(
  tx: BillingClient,
  workspaceRef: string
): Promise<number> {
  const { _sum } = await tx.ledgerEntry.aggregate({
    where: { workspaceRef },
    _sum: { amountMicro: true }
  });
  const balance = Number(_sum.amountMicro ?? 0n);
  assertMicroUnits(balance);
  return balance;
}
