import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUpdatePortfolio } from "./updatePortfolio.js";
import { ValidationError } from "@qcobro/common";
import type { PortfolioClient, PortfolioRecord } from "@qcobro/common";

function record(): PortfolioRecord {
  return {
    id: "p1",
    workspaceRef: "ws1",
    name: "x",
    clientId: "c",
    currency: "USD",
    accountCount: 0,
    totalOutstandingBalance: 0,
    recoveredAmount: 0,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function mockClient(onUpdate: (data: Record<string, unknown>) => void): PortfolioClient {
  return {
    portfolio: {
      findMany: async () => [],
      findFirstOrThrow: async () => record(),
      create: async () => record(),
      update: async (args) => {
        onUpdate(args.data as Record<string, unknown>);
        return { ...record(), ...(args.data as Record<string, unknown>) };
      },
      delete: async () => record()
    },
    portfolioAccount: {
      findMany: async () => [],
      count: async () => 0,
      aggregate: async () => ({ _sum: { outstandingBalance: null } }),
      create: async () => ({ id: "a1" }) as never,
      update: async () => ({ id: "a1" }) as never,
      updateMany: async () => ({ count: 0 })
    },
    $transaction: async <T>(fn: (tx: PortfolioClient) => Promise<T>) => fn(mockClient(onUpdate))
  };
}

describe("updatePortfolio", () => {
  it("archiving sets archivedAt to a timestamp", async () => {
    const calls: Record<string, unknown>[] = [];
    const fn = createUpdatePortfolio(mockClient((d) => calls.push(d)) as never, "ws1");

    await fn({ id: "p1", archived: true });

    assert.ok(calls[0].archivedAt instanceof Date);
  });

  it("restoring clears archivedAt", async () => {
    const calls: Record<string, unknown>[] = [];
    const fn = createUpdatePortfolio(mockClient((d) => calls.push(d)) as never, "ws1");

    await fn({ id: "p1", archived: false });

    assert.equal(calls[0].archivedAt, null);
  });

  it("does not touch archivedAt when only renaming", async () => {
    const calls: Record<string, unknown>[] = [];
    const fn = createUpdatePortfolio(mockClient((d) => calls.push(d)) as never, "ws1");

    await fn({ id: "p1", name: "Renamed" });

    assert.equal(calls[0].name, "Renamed");
    assert.equal("archivedAt" in calls[0], false);
  });

  it("throws ValidationError when id is empty", async () => {
    const fn = createUpdatePortfolio(mockClient(() => {}) as never, "ws1");

    await assert.rejects(() => fn({ id: "", archived: true }), ValidationError);
  });
});
