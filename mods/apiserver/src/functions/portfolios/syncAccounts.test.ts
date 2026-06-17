import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSyncAccounts } from "./syncAccounts.js";
import { ValidationError } from "@qcobro/common";
import type { PortfolioClient, PortfolioAccountRecord } from "@qcobro/common";

const BASE_ROW = {
  externalId: "C001",
  fullName: "Ana García",
  outstandingBalance: 1000,
  principalAmount: 1200,
  termsAmount: 100,
  termsLength: 12,
  daysPastDue: 30,
  missedInstallments: 1
};

function makeAccount(externalId: string, balance = 1000): PortfolioAccountRecord {
  return {
    id: externalId,
    portfolioId: "p1",
    externalId,
    fullName: "Test",
    phone: null,
    preferredLanguage: null,
    bestTimeToCall: null,
    customerSegment: null,
    principalAmount: 1200,
    termsAmount: 100,
    termsFrequency: null,
    termsLength: 12,
    outstandingBalance: balance,
    daysPastDue: 0,
    missedInstallments: 0,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    negotiationOptions: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function makeTx(existing: PortfolioAccountRecord[]) {
  const accounts = [...existing];
  let portfolioUpdate: Record<string, unknown> | null = null;
  let createdCount = 0;
  let updatedCount = 0;
  let archivedCount = 0;

  const tx = {
    portfolioAccount: {
      findMany: async (args: { where: { portfolioId: string }; select?: unknown }) => {
        if (args.select) {
          return accounts.filter((a) => !a.archivedAt).map((a) => ({ externalId: a.externalId }));
        }
        return accounts.filter((a) => !a.archivedAt);
      },
      count: async () => accounts.filter((a) => !a.archivedAt).length,
      aggregate: async () => ({
        _sum: {
          outstandingBalance: accounts
            .filter((a) => !a.archivedAt)
            .reduce((s, a) => s + a.outstandingBalance, 0)
        }
      }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdCount++;
        const acc = makeAccount(
          args.data.externalId as string,
          args.data.outstandingBalance as number
        );
        accounts.push(acc);
        return acc;
      },
      update: async (args: {
        where: { portfolioId_externalId: { portfolioId: string; externalId: string } };
        data: Record<string, unknown>;
      }) => {
        updatedCount++;
        const idx = accounts.findIndex(
          (a) => a.externalId === args.where.portfolioId_externalId.externalId
        );
        if (idx >= 0) Object.assign(accounts[idx], args.data);
        return accounts[idx]!;
      },
      updateMany: async (args: {
        where: { portfolioId: string; externalId: { in: string[] } };
        data: { archivedAt: Date };
      }) => {
        const toArchive = args.where.externalId.in;
        archivedCount += toArchive.length;
        toArchive.forEach((id) => {
          const acc = accounts.find((a) => a.externalId === id);
          if (acc) acc.archivedAt = new Date();
        });
        return { count: toArchive.length };
      }
    },
    portfolio: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        portfolioUpdate = args.data;
        return { id: args.where.id };
      }
    },
    _stats: () => ({ portfolioUpdate, createdCount, updatedCount, archivedCount })
  };

  const client: PortfolioClient = {
    portfolio: {
      findMany: async () => [],
      findFirstOrThrow: async () => ({ id: "p1" }) as never,
      create: async () => ({ id: "p1" }) as never,
      update: async (args) => {
        portfolioUpdate = args.data;
        return { id: "p1" } as never;
      },
      delete: async () => ({ id: "p1" }) as never
    },
    portfolioAccount: tx.portfolioAccount,
    $transaction: async <T>(fn: (tx: PortfolioClient) => Promise<T>) =>
      fn(tx as unknown as PortfolioClient)
  };

  return { client, stats: tx._stats };
}

describe("syncAccounts", () => {
  it("creates new accounts in APPEND_ONLY mode and updates portfolio totals", async () => {
    const { client, stats } = makeTx([]);
    const fn = createSyncAccounts(client as never);

    const result = await fn({ portfolioId: "p1", mode: "APPEND_ONLY", rows: [BASE_ROW] });

    assert.equal(result.created, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.archived, 0);
    assert.equal(result.total, 1);
    const s = stats();
    assert.equal(s.portfolioUpdate?.accountCount, 1);
    assert.equal(s.portfolioUpdate?.totalOutstandingBalance, 1000);
  });

  it("updates existing accounts in UPDATE_EXISTING mode", async () => {
    const { client, stats } = makeTx([makeAccount("C001", 1000)]);
    const fn = createSyncAccounts(client as never);

    const result = await fn({
      portfolioId: "p1",
      mode: "UPDATE_EXISTING",
      rows: [{ ...BASE_ROW, outstandingBalance: 800 }]
    });

    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(stats().updatedCount, 1);
  });

  it("archives absent accounts in REPLACE mode", async () => {
    const { client } = makeTx([makeAccount("C001"), makeAccount("C002")]);
    const fn = createSyncAccounts(client as never);

    const result = await fn({ portfolioId: "p1", mode: "REPLACE", rows: [BASE_ROW] });

    assert.equal(result.archived, 1);
    assert.equal(result.total, 1);
  });

  it("does NOT archive in APPEND_ONLY mode even if accounts are missing from the file", async () => {
    const { client } = makeTx([makeAccount("C001"), makeAccount("C002")]);
    const fn = createSyncAccounts(client as never);

    const result = await fn({ portfolioId: "p1", mode: "APPEND_ONLY", rows: [BASE_ROW] });

    assert.equal(result.archived, 0);
  });

  it("throws ValidationError when rows array is empty", async () => {
    const { client } = makeTx([]);
    const fn = createSyncAccounts(client as never);

    await assert.rejects(
      () => fn({ portfolioId: "p1", mode: "REPLACE", rows: [] }),
      ValidationError
    );
  });
});
