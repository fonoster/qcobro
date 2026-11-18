import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../index.js";
import type { Context } from "../context.js";

function makePrisma() {
  const touched: string[] = [];
  const settings = { workspaceRef: "ak_ws", timezone: "America/Santo_Domingo", currency: "DOP" };
  const prisma = {
    portfolio: {
      findFirst: async (args: { where: { id: string; workspaceRef: string } }) =>
        args.where.id === "p-own" && args.where.workspaceRef === "ak_ws" ? { id: "p-own" } : null
    },
    workspaceSettings: { findUnique: async () => settings, upsert: async () => settings },
    recovery: {
      findMany: async (args: { where: { portfolio: { workspaceRef: string } } }) => {
        touched.push(`recovery:${args.where.portfolio.workspaceRef}`);
        return [];
      },
      count: async () => 0
    },
    accountExit: { count: async () => 0 }
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

const OCT = { from: "2026-10-01", to: "2026-10-31" };
const isNotFound = (err: unknown) => err instanceof TRPCError && err.code === "NOT_FOUND";

describe("recovery router", () => {
  it("returns NOT_FOUND for another workspace's portfolio on every procedure", async () => {
    const { prisma, touched } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    const foreign = { ...OCT, portfolioId: "p-foreign" };
    await assert.rejects(caller.recovery.summary(foreign), isNotFound);
    await assert.rejects(caller.recovery.breakdown({ ...foreign, by: "CHANNEL" }), isNotFound);
    await assert.rejects(caller.recovery.list(foreign), isNotFound);
    assert.deepEqual(touched, []);
  });

  it("scopes a workspace-wide summary to the caller's workspace", async () => {
    const { prisma, touched } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    const result = await caller.recovery.summary(OCT);
    assert.equal(result.currency, "DOP");
    assert.deepEqual(touched, ["recovery:ak_ws"]);
  });

  it("rejects a reversed period as BAD_REQUEST", async () => {
    const { prisma } = makePrisma();
    const caller = appRouter.createCaller(ctx(prisma));
    await assert.rejects(
      caller.recovery.summary({ from: "2026-11-01", to: "2026-10-31" }),
      (err: unknown) =>
        err instanceof TRPCError &&
        err.code === "BAD_REQUEST" &&
        /from must be on or before to/.test(err.message)
    );
  });
});
