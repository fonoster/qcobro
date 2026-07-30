import {
  createValidatePhoneE164,
  syncAccountsInputSchema,
  withErrorHandlingAndValidation,
  type PortfolioClient,
  type SyncAccountsInput
} from "@qcobro/common";

export function createSyncAccounts(client: PortfolioClient) {
  const validatePhone = createValidatePhoneE164();

  const fn = async (params: SyncAccountsInput) => {
    const { portfolioId, mode, rows } = params;

    // Normalize every row's phone to canonical E.164 up front, before any DB write. An
    // unparseable phone fails the whole sync call — same atomicity as every other invalid
    // field on the row schema (e.g. a negative outstandingBalance already rejects the whole
    // batch) — rather than silently persisting a non-canonical number that inbound WhatsApp
    // matching (loadByPhoneAndSender) would then fail to correlate.
    const normalizedPhones = new Map<string, string | null>();
    for (const row of rows) {
      normalizedPhones.set(
        row.externalId,
        row.phone ? await validatePhone({ phone: row.phone }) : null
      );
    }

    return client.$transaction(async (tx) => {
      const existing = await tx.portfolioAccount.findMany({
        where: { portfolioId },
        select: { externalId: true }
      });

      const existingIds = new Set(existing.map((a) => a.externalId));
      const incomingIds = new Set(rows.map((r) => r.externalId));

      let created = 0;
      let updated = 0;
      let archived = 0;

      for (const row of rows) {
        const { externalId, lastPaymentDate, ...rest } = row;
        const data = {
          fullName: rest.fullName,
          phone: normalizedPhones.get(externalId) ?? null,
          email: rest.email ?? null,
          preferredLanguage: rest.preferredLanguage ?? null,
          bestTimeToCall: rest.bestTimeToCall ?? null,
          customerSegment: rest.customerSegment ?? null,
          principalAmount: rest.principalAmount,
          termsAmount: rest.termsAmount,
          termsFrequency: rest.termsFrequency ?? null,
          termsLength: rest.termsLength,
          outstandingBalance: rest.outstandingBalance,
          daysPastDue: rest.daysPastDue,
          missedInstallments: rest.missedInstallments,
          lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
          lastPaymentAmount: rest.lastPaymentAmount ?? null,
          negotiationOptions: rest.negotiationOptions ?? null
        };

        if (!existingIds.has(externalId)) {
          await tx.portfolioAccount.create({
            data: { portfolioId, externalId, archivedAt: null, ...data }
          });
          created++;
        } else if (mode === "UPDATE_EXISTING" || mode === "REPLACE") {
          await tx.portfolioAccount.update({
            where: { portfolioId_externalId: { portfolioId, externalId } },
            data: { ...data, archivedAt: null }
          });
          updated++;
        }
      }

      if (mode === "REPLACE") {
        const toArchive = [...existingIds].filter((id) => !incomingIds.has(id));
        if (toArchive.length > 0) {
          const result = await tx.portfolioAccount.updateMany({
            where: { portfolioId, externalId: { in: toArchive } },
            data: { archivedAt: new Date() }
          });
          archived = result.count;

          // Expire the PENDING payment promises of accounts that left the portfolio so
          // they stay visible (do-not-reach) but off the active worklist.
          await tx.paymentPromise.updateMany({
            where: {
              status: "PENDING",
              portfolioAccount: { portfolioId, externalId: { in: toArchive } }
            },
            data: { status: "EXPIRED" }
          });
        }
      }

      const [total, balanceAgg] = await Promise.all([
        tx.portfolioAccount.count({ where: { portfolioId, archivedAt: null } }),
        tx.portfolioAccount.aggregate({
          where: { portfolioId, archivedAt: null },
          _sum: { outstandingBalance: true }
        })
      ]);

      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          accountCount: total,
          totalOutstandingBalance: balanceAgg._sum.outstandingBalance ?? 0,
          lastSyncedAt: new Date()
        }
      });

      return { created, updated, archived, total };
    });
  };

  return withErrorHandlingAndValidation(fn, syncAccountsInputSchema);
}
