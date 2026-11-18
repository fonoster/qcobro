import {
  classifyExitsInputSchema,
  withErrorHandlingAndValidation,
  type AccountExitRecord,
  type ClassifyExitsInput,
  type ClassifyExitsResult,
  type RecoveryTx
} from "@qcobro/common";
import { businessError } from "../businessError.js";
import { classifyOpenExit } from "./classifyOpenExit.js";

export interface ClassifyExitsClient {
  $transaction<T>(
    fn: (
      tx: RecoveryTx & {
        portfolioAccount: {
          findMany(args: {
            where: Record<string, unknown>;
            select: Record<string, boolean>;
          }): Promise<{ id: string; externalId: string }[]>;
        };
      }
    ) => Promise<T>
  ): Promise<T>;
}

const pendingError = (ids: string[]) =>
  businessError(
    "exits",
    ids.map((id) => `externalId "${id}" has no exit pending classification`).join("; ")
  );

/**
 * Gives accounts that left a portfolio without a reason (open UNKNOWN exits) their reason.
 * CURED and PAID_OFF record a recovery from the sent installments and amount, on the exit's
 * own date and with the snapshot stored at exit, so a past period's Recuperado can go up.
 * All or nothing: one entry that isn't pending classification fails the whole call.
 */
export function createClassifyExits(client: ClassifyExitsClient) {
  const fn = async (input: ClassifyExitsInput): Promise<ClassifyExitsResult> =>
    client.$transaction(async (tx) => {
      // Same row lock as the sync, so a sync and a classification can't race on one exit.
      await tx.$queryRaw`SELECT id FROM portfolios WHERE id = ${input.portfolioId} FOR UPDATE`;
      const now = new Date();

      const accounts = await tx.portfolioAccount.findMany({
        where: {
          portfolioId: input.portfolioId,
          externalId: { in: input.exits.map((e) => e.externalId) }
        },
        select: { id: true, externalId: true }
      });
      const accountIds = new Map(accounts.map((a) => [a.externalId, a.id]));

      const open = await tx.accountExit.findMany({
        where: { portfolioAccountId: { in: accounts.map((a) => a.id) }, reenteredAt: null },
        orderBy: { exitedAt: "desc" }
      });
      const latest = new Map<string, AccountExitRecord>();
      for (const exit of open) {
        if (!latest.has(exit.portfolioAccountId)) latest.set(exit.portfolioAccountId, exit);
      }

      const pending = (externalId: string) => {
        const exit = latest.get(accountIds.get(externalId) ?? "");
        return exit?.reason === "UNKNOWN" ? exit : undefined;
      };
      const notPending = input.exits.map((e) => e.externalId).filter((id) => !pending(id));
      if (notPending.length > 0) throw pendingError(notPending);

      const result: ClassifyExitsResult = {
        classified: 0,
        recoveries: { cured: 0, paidOff: 0, amount: 0 },
        promisesMet: 0
      };
      for (const entry of input.exits) {
        const outcome = await classifyOpenExit(tx, pending(entry.externalId)!, entry, now);
        // Classified by someone else between the read and the write: fail the whole call.
        if (outcome === false) throw pendingError([entry.externalId]);
        result.classified++;
        result.promisesMet += outcome.promisesMet;
        if (outcome.recovery) {
          if (outcome.recovery.kind === "CURED") result.recoveries.cured++;
          else result.recoveries.paidOff++;
          result.recoveries.amount += outcome.recovery.amount;
        }
      }
      return result;
    });

  return withErrorHandlingAndValidation(fn, classifyExitsInputSchema);
}
