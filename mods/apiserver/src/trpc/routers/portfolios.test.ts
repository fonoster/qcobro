import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../index.js";
import type { Context } from "../context.js";

// A Prisma stub where portfolio "p-own" belongs to the caller's workspace and "p-foreign" to
// another one. It records whether any account read or write was attempted.
function makePrisma() {
  const touched: string[] = [];
  const prisma = {
    portfolio: {
      findFirst: async (args: { where: { id: string; workspaceRef: string } }) =>
        args.where.id === "p-own" && args.where.workspaceRef === "ak_ws" ? { id: "p-own" } : null
    },
    portfolioAccount: {
      findMany: async () => {
        touched.push("findMany");
        return [];
      },
      count: async () => {
        touched.push("count");
        return 0;
      }
    },
    $transaction: async (arg: unknown) => {
      touched.push("transaction");
      return Array.isArray(arg) ? Promise.all(arg) : [];
    }
  };
  return { prisma, touched };
}

function ctx(prisma: unknown): Context {
  return {
    token: "tkn",
    user: { ref: "u1", accessKeyId: "us_1" },
    workspace: { accessKeyId: "ak_ws", role: "WORKSPACE_MEMBER" },
    prisma
  } as unknown as Context;
}

const isNotFound = (err: unknown) => err instanceof TRPCError && err.code === "NOT_FOUND";

describe("portfolios router workspace scoping", () => {
  it("listAccounts returns NOT_FOUND for another workspace's portfolio, reading nothing", async () => {
    const { prisma, touched } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    await assert.rejects(caller.portfolios.listAccounts({ portfolioId: "p-foreign" }), isNotFound);
    assert.deepEqual(touched, []);
  });

  it("listAccounts reads the caller's own portfolio", async () => {
    const { prisma } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    const res = await caller.portfolios.listAccounts({ portfolioId: "p-own" });
    assert.deepEqual(res, { items: [], total: 0 });
  });

  it("syncAccounts returns NOT_FOUND for another workspace's portfolio, writing nothing", async () => {
    const { prisma, touched } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    await assert.rejects(
      caller.portfolios.syncAccounts({ portfolioId: "p-foreign", mode: "REPLACE", rows: [] }),
      isNotFound
    );
    assert.deepEqual(touched, []);
  });
});
