import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreatePortfolio } from "./createPortfolio.js";
import { ValidationError } from "@qcobro/common";
import type { PortfolioClient, PortfolioRecord } from "@qcobro/common";

function record(): PortfolioRecord {
  return {
    id: "p1",
    workspaceRef: "ws1",
    name: "x",
    clientId: "c",
    accountCount: 0,
    totalOutstandingBalance: 0,
    recoveredAmount: 0,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function mockClient(overrides?: Partial<PortfolioClient["portfolio"]>): PortfolioClient {
  return {
    portfolio: {
      findMany: async () => [],
      findFirstOrThrow: async () => record(),
      create: async (args) => ({ ...record(), ...(args.data as Record<string, unknown>) }),
      update: async () => record(),
      delete: async () => record(),
      ...overrides
    },
    portfolioAccount: {
      findMany: async () => [],
      count: async () => 0,
      aggregate: async () => ({ _sum: { outstandingBalance: null } }),
      create: async () => ({ id: "a1" }) as never,
      update: async () => ({ id: "a1" }) as never,
      updateMany: async () => ({ count: 0 })
    },
    paymentPromise: {
      updateMany: async () => ({ count: 0 })
    },
    $transaction: async <T>(fn: (tx: PortfolioClient) => Promise<T>) => fn(mockClient(overrides))
  };
}

describe("createPortfolio", () => {
  it("creates a portfolio with correct workspace and inputs", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = mockClient({
      create: async (args) => {
        const data = args.data as Record<string, unknown>;
        calls.push(data);
        return { ...record(), ...data };
      }
    });

    await createCreatePortfolio(client as never, "ws_abc")({ name: "Test", clientId: "acme" });

    const data = calls[0];
    assert.equal(data.name, "Test");
    assert.equal(data.clientId, "acme");
    assert.equal(data.workspaceRef, "ws_abc");
    assert.equal(data.totalOutstandingBalance, 0);
    assert.equal(data.accountCount, 0);
    // Currency is a workspace setting, not a portfolio field.
    assert.equal("currency" in data, false);
  });

  it("throws ValidationError when name is empty", async () => {
    await assert.rejects(
      () => createCreatePortfolio(mockClient() as never, "ws1")({ name: "", clientId: "acme" }),
      ValidationError
    );
  });

  it("throws ValidationError when clientId is empty", async () => {
    await assert.rejects(
      () => createCreatePortfolio(mockClient() as never, "ws1")({ name: "Test", clientId: "" }),
      ValidationError
    );
  });
});
