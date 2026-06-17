import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreatePortfolio } from "./createPortfolio.js";
import { ValidationError } from "@qcobro/common";
import type { PortfolioClient } from "@qcobro/common";

function mockClient(overrides?: Partial<PortfolioClient["portfolio"]>): PortfolioClient {
  return {
    portfolio: {
      findMany: async () => [],
      findFirstOrThrow: async () => ({
        id: "p1",
        workspaceRef: "ws1",
        name: "x",
        clientId: "c",
        currency: "USD",
        accountCount: 0,
        totalOutstandingBalance: 0,
        recoveredAmount: 0,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      create: async (args) => ({
        id: "p1",
        workspaceRef: "ws1",
        accountCount: 0,
        totalOutstandingBalance: 0,
        recoveredAmount: 0,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data
      }),
      update: async () => ({
        id: "p1",
        workspaceRef: "ws1",
        name: "x",
        clientId: "c",
        currency: "USD",
        accountCount: 0,
        totalOutstandingBalance: 0,
        recoveredAmount: 0,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      delete: async () => ({
        id: "p1",
        workspaceRef: "ws1",
        name: "x",
        clientId: "c",
        currency: "USD",
        accountCount: 0,
        totalOutstandingBalance: 0,
        recoveredAmount: 0,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      ...overrides
    },
    portfolioAccount: {
      findMany: async () => [],
      count: async () => 0,
      aggregate: async () => ({ _sum: { outstandingBalance: null } }),
      create: async (args) => ({
        id: "a1",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data
      }),
      update: async () => ({ id: "a1" }) as never,
      updateMany: async () => ({ count: 0 })
    },
    $transaction: async <T>(fn: (tx: PortfolioClient) => Promise<T>) => fn(mockClient(overrides))
  };
}

describe("createPortfolio", () => {
  it("creates a portfolio with correct workspace and inputs", async () => {
    let captured: Record<string, unknown> | null = null;
    const client = mockClient({
      create: async (args) => {
        captured = args.data as Record<string, unknown>;
        return {
          id: "p1",
          workspaceRef: "ws_abc",
          accountCount: 0,
          totalOutstandingBalance: 0,
          recoveredAmount: 0,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data
        };
      }
    });

    await createCreatePortfolio(
      client as never,
      "ws_abc"
    )({ name: "Test", clientId: "acme", currency: "USD" });

    assert.equal(captured?.name, "Test");
    assert.equal(captured?.clientId, "acme");
    assert.equal(captured?.currency, "USD");
    assert.equal(captured?.workspaceRef, "ws_abc");
    assert.equal(captured?.totalOutstandingBalance, 0);
    assert.equal(captured?.accountCount, 0);
  });

  it("supports DOP currency", async () => {
    let captured: Record<string, unknown> | null = null;
    const client = mockClient({
      create: async (args) => {
        captured = args.data as Record<string, unknown>;
        return {
          id: "p1",
          workspaceRef: "ws1",
          accountCount: 0,
          totalOutstandingBalance: 0,
          recoveredAmount: 0,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data
        };
      }
    });

    await createCreatePortfolio(
      client as never,
      "ws1"
    )({ name: "Cartera DR", clientId: "banco", currency: "DOP" });

    assert.equal(captured?.currency, "DOP");
  });

  it("throws ValidationError when name is empty", async () => {
    await assert.rejects(
      () =>
        createCreatePortfolio(
          mockClient() as never,
          "ws1"
        )({ name: "", clientId: "acme", currency: "USD" }),
      ValidationError
    );
  });

  it("throws ValidationError when clientId is empty", async () => {
    await assert.rejects(
      () =>
        createCreatePortfolio(
          mockClient() as never,
          "ws1"
        )({ name: "Test", clientId: "", currency: "USD" }),
      ValidationError
    );
  });

  it("throws ValidationError for unsupported currency", async () => {
    await assert.rejects(
      () =>
        createCreatePortfolio(
          mockClient() as never,
          "ws1"
        )({ name: "Test", clientId: "acme", currency: "EUR" as never }),
      ValidationError
    );
  });
});
