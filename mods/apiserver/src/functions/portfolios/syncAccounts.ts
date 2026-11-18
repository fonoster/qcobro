import { randomUUID } from "node:crypto";
import {
  createValidatePhoneE164,
  syncAccountsInputSchema,
  withErrorHandlingAndValidation,
  type AccountExitRecord,
  type ContactLogTouch,
  type ExitEntryInput,
  type ExitReason,
  type RecoveryCreate,
  type SyncAccountState,
  type SyncAccountsClient,
  type SyncAccountsInput,
  type SyncResult
} from "@qcobro/common";
import { businessError } from "../businessError.js";
import { classifyOpenExit } from "./classifyOpenExit.js";
import {
  buildRecoveryContext,
  CONTACT_LOG_TOUCH_SELECT,
  contextColumns
} from "./recoveryContext.js";

// Large REPLACE syncs exit many accounts in one transaction; Prisma's 5 s default for
// interactive transactions would roll the whole sync back.
const SYNC_TIMEOUT_MS = 60_000;

type NewExit = Omit<AccountExitRecord, "classifiedAt" | "reenteredAt" | "context">;

/**
 * Writes a batch of account rows into a portfolio and records what the batch says about
 * recovery: installments an account caught up on while staying overdue (PARTIAL), and accounts
 * that left with a reason (`exits`, any mode) or without one (missing from a REPLACE batch:
 * UNKNOWN). Every recovery and exit carries a snapshot of the account's gestiones since the
 * previous sync that wrote it. All of it happens in one transaction, with the portfolio row
 * locked, so a failed sync leaves nothing behind and overlapping syncs can't double count.
 */
export function createSyncAccounts(client: SyncAccountsClient) {
  const validatePhone = createValidatePhoneE164();

  const fn = async (params: SyncAccountsInput): Promise<SyncResult> => {
    const { portfolioId, mode, rows, exits } = params;

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

    return client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM portfolios WHERE id = ${portfolioId} FOR UPDATE`;
        const now = new Date();

        const existing = (await tx.portfolioAccount.findMany({
          where: { portfolioId },
          select: {
            id: true,
            externalId: true,
            archivedAt: true,
            missedInstallments: true,
            termsAmount: true,
            lastSyncedAt: true,
            createdAt: true
          }
        })) as unknown as SyncAccountState[];
        const byExternalId = new Map(existing.map((a) => [a.externalId, a]));

        const unknownIds = exits.map((e) => e.externalId).filter((id) => !byExternalId.has(id));
        if (unknownIds.length > 0) {
          throw businessError(
            "exits",
            `externalId(s) not in this portfolio: ${unknownIds.join(", ")}`
          );
        }

        // Open exits (latest, not re-entered) of archived accounts this batch mentions: they
        // either come back in `rows` or get a reason through `exits`.
        const archivedMentioned = [
          ...rows.map((r) => byExternalId.get(r.externalId)),
          ...exits.map((e) => byExternalId.get(e.externalId))
        ].filter((a): a is SyncAccountState => !!a && a.archivedAt !== null);
        const openExits = new Map<string, AccountExitRecord>();
        if (archivedMentioned.length > 0) {
          const found = await tx.accountExit.findMany({
            where: {
              portfolioAccountId: { in: archivedMentioned.map((a) => a.id) },
              reenteredAt: null
            },
            orderBy: { exitedAt: "desc" }
          });
          for (const exit of found) {
            if (!openExits.has(exit.portfolioAccountId))
              openExits.set(exit.portfolioAccountId, exit);
          }
        }

        // --- Rows: create or update, detect partial recoveries and re-entries.
        const compares = mode === "UPDATE_EXISTING" || mode === "REPLACE";
        const partials: {
          account: SyncAccountState;
          installments: number;
          amount: number;
          previousSyncAt: Date;
        }[] = [];
        const reentered: string[] = [];
        let created = 0;
        let updated = 0;

        for (const row of rows) {
          const { externalId, lastPaymentDate, termsAmount, missedInstallments, ...rest } = row;
          const data = {
            fullName: rest.fullName,
            phone: normalizedPhones.get(externalId) ?? null,
            email: rest.email ?? null,
            preferredLanguage: rest.preferredLanguage ?? null,
            bestTimeToCall: rest.bestTimeToCall ?? null,
            customerSegment: rest.customerSegment ?? null,
            principalAmount: rest.principalAmount,
            termsFrequency: rest.termsFrequency ?? null,
            termsLength: rest.termsLength,
            outstandingBalance: rest.outstandingBalance,
            daysPastDue: rest.daysPastDue,
            lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
            lastPaymentAmount: rest.lastPaymentAmount ?? null,
            negotiationOptions: rest.negotiationOptions ?? null,
            lastSyncedAt: now
          };
          const account = byExternalId.get(externalId);

          if (!account) {
            await tx.portfolioAccount.create({
              data: {
                portfolioId,
                externalId,
                archivedAt: null,
                ...data,
                termsAmount: termsAmount ?? 0,
                missedInstallments: missedInstallments ?? 0
              }
            });
            created++;
          } else if (compares) {
            if (account.archivedAt !== null) {
              const open = openExits.get(account.id);
              if (open) reentered.push(open.id);
            } else if (
              missedInstallments !== undefined &&
              missedInstallments < account.missedInstallments
            ) {
              // The stored values are the ones the last sync that included the account wrote;
              // the row's own termsAmount only applies from the next sync on.
              const installments = account.missedInstallments - missedInstallments;
              partials.push({
                account,
                installments,
                amount: installments * account.termsAmount,
                previousSyncAt: account.lastSyncedAt ?? account.createdAt
              });
            }
            await tx.portfolioAccount.update({
              where: { portfolioId_externalId: { portfolioId, externalId } },
              data: {
                ...data,
                ...(termsAmount !== undefined ? { termsAmount } : {}),
                ...(missedInstallments !== undefined ? { missedInstallments } : {}),
                archivedAt: null
              }
            });
            updated++;
          }
        }

        // --- Exits: new exits for active accounts, late reasons for open UNKNOWN exits.
        const newExits: NewExit[] = [];
        const lateClassifications: { exit: AccountExitRecord; entry: ExitEntryInput }[] = [];
        let skipped = 0;

        const newExit = (
          account: SyncAccountState,
          reason: ExitReason,
          entry: ExitEntryInput | null
        ) => {
          const recovers = reason === "CURED" || reason === "PAID_OFF";
          newExits.push({
            id: randomUUID(),
            portfolioId,
            portfolioAccountId: account.id,
            reason,
            exitedAt: now,
            previousSyncAt: account.lastSyncedAt ?? account.createdAt,
            missedInstallments: recovers ? entry!.missedInstallments! : account.missedInstallments,
            termsAmount: recovers ? entry!.termsAmount! : account.termsAmount
          });
        };

        for (const entry of exits) {
          const account = byExternalId.get(entry.externalId)!;
          if (account.archivedAt === null) {
            newExit(account, entry.reason, entry);
            continue;
          }
          const open = openExits.get(account.id);
          if (open && open.reason === "UNKNOWN") {
            lateClassifications.push({ exit: open, entry });
          } else {
            skipped++;
          }
        }

        if (mode === "REPLACE") {
          const listed = new Set([
            ...rows.map((r) => r.externalId),
            ...exits.map((e) => e.externalId)
          ]);
          for (const account of existing) {
            if (account.archivedAt === null && !listed.has(account.externalId)) {
              newExit(account, "UNKNOWN", null);
            }
          }
        }

        // --- Snapshots: one query for every account that recovered or left.
        const snapshotRanges = [
          ...partials.map((p) => ({ accountId: p.account.id, from: p.previousSyncAt })),
          ...newExits.map((e) => ({ accountId: e.portfolioAccountId, from: e.previousSyncAt }))
        ];
        let logs: ContactLogTouch[] = [];
        if (snapshotRanges.length > 0) {
          const earliest = new Date(Math.min(...snapshotRanges.map((r) => r.from.getTime())));
          logs = await tx.accountContactLog.findMany({
            where: {
              portfolioAccountId: { in: [...new Set(snapshotRanges.map((r) => r.accountId))] },
              contactedAt: { gt: earliest, lte: now }
            },
            select: CONTACT_LOG_TOUCH_SELECT
          });
        }

        // --- Writes.
        const recoveries: RecoveryCreate[] = [];

        for (const { account, installments, amount, previousSyncAt } of partials) {
          const context = buildRecoveryContext(logs, account.id, previousSyncAt, now);
          recoveries.push({
            id: randomUUID(),
            portfolioId,
            portfolioAccountId: account.id,
            exitId: null,
            kind: "PARTIAL",
            installments,
            amount,
            detectedAt: now,
            previousSyncAt,
            ...contextColumns(context),
            context
          });
        }

        if (reentered.length > 0) {
          await tx.accountExit.updateMany({
            where: { id: { in: reentered } },
            data: { reenteredAt: now }
          });
        }

        if (newExits.length > 0) {
          const exitRows = newExits.map((exit) => ({
            id: exit.id,
            portfolioId: exit.portfolioId,
            portfolioAccountId: exit.portfolioAccountId,
            reason: exit.reason,
            exitedAt: exit.exitedAt,
            previousSyncAt: exit.previousSyncAt,
            missedInstallments: exit.missedInstallments,
            termsAmount: exit.termsAmount,
            context: buildRecoveryContext(logs, exit.portfolioAccountId, exit.previousSyncAt, now)
          }));
          await tx.portfolioAccount.updateMany({
            where: { portfolioId, id: { in: exitRows.map((e) => e.portfolioAccountId) } },
            data: { archivedAt: now }
          });
          await tx.accountExit.createMany({ data: exitRows });

          const recovered = exitRows.filter((e) => e.reason === "CURED" || e.reason === "PAID_OFF");
          for (const exit of recovered) {
            recoveries.push({
              id: randomUUID(),
              portfolioId,
              portfolioAccountId: exit.portfolioAccountId,
              exitId: exit.id,
              kind: exit.reason as "CURED" | "PAID_OFF",
              installments: exit.missedInstallments,
              amount: exit.missedInstallments * exit.termsAmount,
              detectedAt: now,
              previousSyncAt: exit.previousSyncAt,
              ...contextColumns(exit.context),
              context: exit.context
            });
          }
          if (recovered.length > 0) {
            await tx.paymentPromise.updateMany({
              where: {
                portfolioAccountId: { in: recovered.map((e) => e.portfolioAccountId) },
                status: "PENDING"
              },
              data: { status: "MET" }
            });
          }

          // Accounts that left without recovering: their PENDING promises expire, tagged with
          // the exit so a later CURED/PAID_OFF classification can turn exactly these MET.
          const notRecovered = exitRows.filter(
            (e) => e.reason !== "CURED" && e.reason !== "PAID_OFF"
          );
          if (notRecovered.length > 0) {
            const withPending = await tx.paymentPromise.findMany({
              where: {
                portfolioAccountId: { in: notRecovered.map((e) => e.portfolioAccountId) },
                status: "PENDING"
              },
              select: { portfolioAccountId: true }
            });
            const pendingAccounts = new Set(withPending.map((p) => p.portfolioAccountId));
            for (const exit of notRecovered.filter((e) =>
              pendingAccounts.has(e.portfolioAccountId)
            )) {
              await tx.paymentPromise.updateMany({
                where: { portfolioAccountId: exit.portfolioAccountId, status: "PENDING" },
                data: { status: "EXPIRED", expiredByExitId: exit.id }
              });
            }
          }
        }

        if (recoveries.length > 0) {
          await tx.recovery.createMany({ data: recoveries });
        }

        let classified = 0;
        const lateRecoveries: RecoveryCreate[] = [];
        for (const { exit, entry } of lateClassifications) {
          const outcome = await classifyOpenExit(tx, exit, entry, now);
          if (outcome === false) {
            skipped++;
            continue;
          }
          classified++;
          if (outcome.recovery) lateRecoveries.push(outcome.recovery);
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
            lastSyncedAt: now
          }
        });

        const allRecoveries = [...recoveries, ...lateRecoveries];
        const exitsByReason: SyncResult["exitsByReason"] = {
          CURED: 0,
          PAID_OFF: 0,
          WRITTEN_OFF: 0,
          OTHER: 0,
          UNKNOWN: 0,
          classified,
          skipped
        };
        for (const exit of newExits) exitsByReason[exit.reason]++;

        return {
          created,
          updated,
          archived: newExits.length,
          total,
          exitsByReason,
          recoveries: {
            partial: allRecoveries.filter((r) => r.kind === "PARTIAL").length,
            cured: allRecoveries.filter((r) => r.kind === "CURED").length,
            paidOff: allRecoveries.filter((r) => r.kind === "PAID_OFF").length,
            amount: allRecoveries.reduce((sum, r) => sum + r.amount, 0)
          }
        };
      },
      { timeout: SYNC_TIMEOUT_MS }
    );
  };

  return withErrorHandlingAndValidation(fn, syncAccountsInputSchema);
}
