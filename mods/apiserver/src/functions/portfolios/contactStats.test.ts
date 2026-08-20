import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactStats, type ContactStatsClient } from "./contactStats.js";

const WORKSPACE = "WOworkspace1";

/**
 * Fakes `portfolioAccount.count` over an in-memory set of accounts, each carrying the
 * `entrega` values of its gestións (or none, for a never-attempted account). Mirrors the shape
 * of the real Prisma filter closely enough to exercise the query the factory builds.
 */
function makeClient(
  accounts: { archived?: boolean; portfolioArchived?: boolean; entregas?: string[] }[]
): ContactStatsClient {
  return {
    portfolioAccount: {
      count: async (args) => {
        const { where } = args;
        return accounts.filter((a) => {
          if (a.archived) return false;
          if (a.portfolioArchived && where.portfolio.archivedAt === null) return false;
          if (where.contactLogs) {
            return (a.entregas ?? []).includes(where.contactLogs.some.entrega);
          }
          return true;
        }).length;
      }
    }
  };
}

describe("contactStats", () => {
  it("excludes an account whose every attempt failed", async () => {
    const client = makeClient([{ entregas: ["FAILED", "FAILED"] }]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 0 });
  });

  it("excludes an account still awaiting delivery confirmation", async () => {
    const client = makeClient([{ entregas: ["DISPATCHED"] }]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 0 });
  });

  /** Delivery is the question. Whether anything came of it is a different axis. */
  it("counts a delivered attempt that produced no interaction", async () => {
    const client = makeClient([{ entregas: ["DELIVERED"] }]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 1 });
  });

  it("counts an account with several failures and one delivery exactly once", async () => {
    const client = makeClient([{ entregas: ["FAILED", "DISPATCHED", "DELIVERED", "FAILED"] }]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 1 });
  });

  it("counts a never-attempted account in the total only", async () => {
    const client = makeClient([{ entregas: [] }]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 0 });
  });

  it("excludes archived accounts from both counts", async () => {
    const client = makeClient([
      { archived: true, entregas: ["DELIVERED"] },
      { entregas: ["DELIVERED"] }
    ]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 1 });
  });

  /**
   * Without this, "Cuentas en gestión" (summed from `portfolios.list`, which hides archived
   * carteras) and the contact rate would disagree about what is under management.
   */
  it("excludes accounts in an archived portfolio from both counts", async () => {
    const client = makeClient([
      { portfolioArchived: true, entregas: ["DELIVERED"] },
      { portfolioArchived: true, entregas: ["FAILED"] },
      { entregas: ["DELIVERED"] }
    ]);
    assert.deepEqual(await createContactStats(client)(WORKSPACE), { total: 1, contacted: 1 });
  });
});
