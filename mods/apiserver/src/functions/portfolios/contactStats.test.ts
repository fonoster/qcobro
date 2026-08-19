import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactStats, type ContactStatsClient } from "./contactStats.js";

const WORKSPACE = "WOworkspace1";

/**
 * Fakes `portfolioAccount.count` over an in-memory set of accounts, each carrying the
 * outcomes of its gestións (or none, for a never-attempted account). Mirrors the shape of
 * the real Prisma filter closely enough to exercise the query the factory builds.
 */
function makeClient(
  accounts: { archived?: boolean; portfolioArchived?: boolean; outcomes?: string[] }[]
): ContactStatsClient {
  return {
    portfolioAccount: {
      count: async (args) => {
        const { where } = args;
        return accounts.filter((a) => {
          if (a.archived) return false;
          if (a.portfolioArchived && where.portfolio.archivedAt === null) return false;
          if (where.contactLogs) {
            const notIn = where.contactLogs.some.outcome.notIn;
            return (a.outcomes ?? []).some((o) => !notIn.includes(o));
          }
          return true;
        }).length;
      }
    }
  };
}

describe("contactStats", () => {
  it("excludes an account whose attempts all failed", async () => {
    const client = makeClient([{ outcomes: ["NOT_DELIVERED", "NO_ANSWER", "WRONG_NUMBER"] }]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 0 });
  });

  it("includes an account whose only gestión is PAYMENT_PROMISE", async () => {
    const client = makeClient([{ outcomes: ["PAYMENT_PROMISE"] }]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 1 });
  });

  it("excludes an account whose only gestión is still DISPATCHED", async () => {
    const client = makeClient([{ outcomes: ["DISPATCHED"] }]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 0 });
  });

  it("counts an account with several failures and one DELIVERED exactly once", async () => {
    const client = makeClient([
      { outcomes: ["NOT_DELIVERED", "NO_ANSWER", "DELIVERED", "WRONG_NUMBER"] }
    ]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 1 });
  });

  it("counts a never-attempted account in the total only", async () => {
    const client = makeClient([{ outcomes: [] }]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 0 });
  });

  it("excludes archived accounts from both counts", async () => {
    const client = makeClient([
      { archived: true, outcomes: ["DELIVERED"] },
      { outcomes: ["DELIVERED"] }
    ]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 1 });
  });

  it("excludes accounts in an archived portfolio from both counts", async () => {
    const client = makeClient([
      { portfolioArchived: true, outcomes: ["DELIVERED"] },
      { portfolioArchived: true, outcomes: ["NO_ANSWER"] },
      { outcomes: ["DELIVERED"] }
    ]);
    const result = await createContactStats(client)(WORKSPACE);
    assert.deepEqual(result, { total: 1, contacted: 1 });
  });
});
