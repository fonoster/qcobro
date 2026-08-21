import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactStats, type ContactStatsClient } from "./contactStats.js";

const WORKSPACE = "WOworkspace1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** A single gestión row, as `AccountContactLog` shapes it for this query. */
interface Gestion {
  portfolioAccountId: string;
  entrega: "DISPATCHED" | "DELIVERED" | "FAILED";
  /** Milliseconds ago (relative to `Date.now()` at test time), not an absolute date, so the
   *  boundary math exercises the same clock the implementation uses. */
  agoMs: number;
  workspaceRef?: string;
}

/**
 * Fakes `accountContactLog.findMany`/`.count` over an in-memory set of gestiones, applying the
 * same filters the real Prisma query gets: `contactedAt >= gte`, optional `entrega`, and
 * workspace scoping through the `portfolioAccount.portfolio.workspaceRef` relation.
 */
function makeClient(gestiones: Gestion[]): ContactStatsClient {
  const rows = gestiones.map((g) => ({
    ...g,
    contactedAt: new Date(Date.now() - g.agoMs),
    workspaceRef: g.workspaceRef ?? WORKSPACE
  }));

  function matches(
    row: (typeof rows)[number],
    where: {
      contactedAt: { gte: Date };
      entrega?: "DELIVERED";
      portfolioAccount: { portfolio: { workspaceRef: string } };
    }
  ): boolean {
    if (row.contactedAt.getTime() < where.contactedAt.gte.getTime()) return false;
    if (where.entrega && row.entrega !== where.entrega) return false;
    if (row.workspaceRef !== where.portfolioAccount.portfolio.workspaceRef) return false;
    return true;
  }

  return {
    accountContactLog: {
      findMany: async ({ where }) => {
        const seen = new Set<string>();
        const out: { portfolioAccountId: string }[] = [];
        for (const row of rows) {
          if (!matches(row, where)) continue;
          if (seen.has(row.portfolioAccountId)) continue;
          seen.add(row.portfolioAccountId);
          out.push({ portfolioAccountId: row.portfolioAccountId });
        }
        return out;
      },
      count: async ({ where }) => rows.filter((row) => matches(row, where)).length
    }
  };
}

describe("contactStats", () => {
  it("does not lower the rate when an unreached account is retried repeatedly", async () => {
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: DAY_MS },
      { portfolioAccountId: "a2", entrega: "FAILED", agoMs: DAY_MS },
      { portfolioAccountId: "a2", entrega: "DISPATCHED", agoMs: DAY_MS / 2 },
      { portfolioAccountId: "a2", entrega: "FAILED", agoMs: DAY_MS / 4 },
      { portfolioAccountId: "a2", entrega: "FAILED", agoMs: DAY_MS / 8 },
      { portfolioAccountId: "a2", entrega: "FAILED", agoMs: DAY_MS / 16 }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "7d" });
    // a2's five attempts count as one unreached account, not five, and don't move the rate
    // below what a1 alone (reached on its only attempt) would produce.
    assert.deepEqual(result, { total: 2, contacted: 1, totalSends: 6 });
  });

  it("counts an account reached only on a later attempt as reached, once", async () => {
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "FAILED", agoMs: 3 * DAY_MS },
      { portfolioAccountId: "a1", entrega: "DISPATCHED", agoMs: 2 * DAY_MS },
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: DAY_MS }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "7d" });
    assert.deepEqual(result, { total: 1, contacted: 1, totalSends: 3 });
  });

  it("renders an empty window as all zeros, not a divide-by-zero rate", async () => {
    const client = makeClient([
      // Only gestión is outside the 7-day window.
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: 10 * DAY_MS }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "7d" });
    assert.deepEqual(result, { total: 0, contacted: 0, totalSends: 0 });
  });

  it("moves the window boundary with the selected period", async () => {
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: 10 * DAY_MS }
    ]);
    const sevenDay = await createContactStats(client, WORKSPACE)({ period: "7d" });
    assert.deepEqual(sevenDay, { total: 0, contacted: 0, totalSends: 0 });

    const fourteenDay = await createContactStats(client, WORKSPACE)({ period: "14d" });
    assert.deepEqual(fourteenDay, { total: 1, contacted: 1, totalSends: 1 });
  });

  it("defaults to a 7-day window when no period is given", async () => {
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: 6 * DAY_MS },
      { portfolioAccountId: "a2", entrega: "DELIVERED", agoMs: 8 * DAY_MS }
    ]);
    const result = await createContactStats(client, WORKSPACE)({});
    assert.deepEqual(result, { total: 1, contacted: 1, totalSends: 1 });
  });

  it("does not count an account reached only outside the window as reached", async () => {
    const client = makeClient([
      // Delivered 9 days ago — real, but not in a 7-day window.
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: 9 * DAY_MS },
      // Inside the window we only ever failed to reach them.
      { portfolioAccountId: "a1", entrega: "FAILED", agoMs: 2 * DAY_MS }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "7d" });
    // Attempted this week, not reached this week. The older success belongs to an older window;
    // letting it leak forward is exactly the ratchet this rewrite removes.
    assert.deepEqual(result, { total: 1, contacted: 0, totalSends: 1 });
  });

  it("scopes to the last 24 hours on the shortest window", async () => {
    const HOUR_MS = 60 * 60 * 1000;
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: 2 * HOUR_MS },
      { portfolioAccountId: "a2", entrega: "FAILED", agoMs: 20 * HOUR_MS },
      // Just over the edge — yesterday's run must not bleed into a 24h reading.
      { portfolioAccountId: "a3", entrega: "DELIVERED", agoMs: 25 * HOUR_MS }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "24h" });
    assert.deepEqual(result, { total: 2, contacted: 1, totalSends: 2 });
  });

  it("rejects an unrecognized period before querying", async () => {
    let queried = false;
    const client = makeClient([]);
    const spied: ContactStatsClient = {
      accountContactLog: {
        findMany: async (args) => {
          queried = true;
          return client.accountContactLog.findMany(args);
        },
        count: async (args) => {
          queried = true;
          return client.accountContactLog.count(args);
        }
      }
    };
    await assert.rejects(() => createContactStats(spied, WORKSPACE)({ period: "90d" } as never));
    assert.equal(queried, false, "validation must run before any query");
  });

  it("excludes gestiones from another workspace", async () => {
    const client = makeClient([
      { portfolioAccountId: "a1", entrega: "DELIVERED", agoMs: DAY_MS },
      { portfolioAccountId: "a2", entrega: "DELIVERED", agoMs: DAY_MS, workspaceRef: "WOother" }
    ]);
    const result = await createContactStats(client, WORKSPACE)({ period: "7d" });
    assert.deepEqual(result, { total: 1, contacted: 1, totalSends: 1 });
  });
});
