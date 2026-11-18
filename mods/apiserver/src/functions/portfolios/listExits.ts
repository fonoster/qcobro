import {
  listExitsInputSchema,
  withErrorHandlingAndValidation,
  type ExitListItem,
  type ExitReason,
  type ListExitsInput,
  type RecoveryReadClient
} from "@qcobro/common";

interface ExitRow {
  id: string;
  reason: ExitReason;
  exitedAt: Date;
  missedInstallments: number;
  termsAmount: number;
  classifiedAt: Date | null;
  portfolioAccount: { externalId: string; fullName: string };
}

/** A portfolio's open exits (accounts that left and haven't come back), newest first. */
export function createListExits(client: RecoveryReadClient, workspaceRef: string) {
  const fn = async (input: ListExitsInput): Promise<{ items: ExitListItem[]; total: number }> => {
    const where = {
      portfolioId: input.portfolioId,
      reenteredAt: null,
      ...(input.reason ? { reason: input.reason } : {}),
      portfolioAccount: { portfolio: { workspaceRef } }
    };
    const [rows, total] = await Promise.all([
      client.accountExit.findMany({
        where,
        include: { portfolioAccount: { select: { externalId: true, fullName: true } } },
        orderBy: { exitedAt: "desc" },
        take: input.limit,
        skip: input.offset
      }),
      client.accountExit.count({ where })
    ]);
    const items = (rows as unknown as ExitRow[]).map((e) => ({
      id: e.id,
      externalId: e.portfolioAccount.externalId,
      fullName: e.portfolioAccount.fullName,
      reason: e.reason,
      exitedAt: e.exitedAt,
      missedInstallments: e.missedInstallments,
      termsAmount: e.termsAmount,
      amountIfRecovered: e.missedInstallments * e.termsAmount,
      classifiedAt: e.classifiedAt
    }));
    return { items, total };
  };

  return withErrorHandlingAndValidation(fn, listExitsInputSchema);
}
