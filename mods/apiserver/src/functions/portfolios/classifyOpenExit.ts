import { randomUUID } from "node:crypto";
import type { AccountExitRecord, ExitEntryInput, RecoveryCreate, RecoveryTx } from "@qcobro/common";
import { contextColumns } from "./recoveryContext.js";

/**
 * Gives an open UNKNOWN exit its reason. CAUGHT_UP and PAID_OFF store the sent installments and
 * amount on the exit, record a Recovery on the exit's own date with the snapshot taken at
 * exit time, and turn MET the promises that exit expired (not those of an earlier episode).
 *
 * Returns the Recovery it created (null when the reason records none) and how many promises
 * became MET. Returns `false` when the exit was no longer an open UNKNOWN one (someone
 * classified it first); the caller decides whether that is an error.
 */
export async function classifyOpenExit(
  tx: RecoveryTx,
  exit: AccountExitRecord,
  entry: ExitEntryInput,
  now: Date
): Promise<{ recovery: RecoveryCreate | null; promisesMet: number } | false> {
  const recovers = entry.reason === "CAUGHT_UP" || entry.reason === "PAID_OFF";
  const values = recovers
    ? { missedInstallments: entry.missedInstallments!, termsAmount: entry.termsAmount! }
    : {};

  const { count } = await tx.accountExit.updateMany({
    where: { id: exit.id, reason: "UNKNOWN", reenteredAt: null },
    data: { reason: entry.reason, classifiedAt: now, ...values }
  });
  if (count !== 1) return false;
  if (!recovers) return { recovery: null, promisesMet: 0 };

  const recovery: RecoveryCreate = {
    id: randomUUID(),
    portfolioId: exit.portfolioId,
    portfolioAccountId: exit.portfolioAccountId,
    exitId: exit.id,
    kind: entry.reason as "CAUGHT_UP" | "PAID_OFF",
    installments: entry.missedInstallments!,
    amount: entry.missedInstallments! * entry.termsAmount!,
    detectedAt: exit.exitedAt,
    previousSyncAt: exit.previousSyncAt,
    ...contextColumns(exit.context),
    context: exit.context
  };
  await tx.recovery.createMany({ data: [recovery] });
  const met = await tx.paymentPromise.updateMany({
    where: { expiredByExitId: exit.id, status: "EXPIRED" },
    data: { status: "MET" }
  });
  return { recovery, promisesMet: met.count };
}
