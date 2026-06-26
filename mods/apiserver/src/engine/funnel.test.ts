import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFunnel, type FunnelAccount } from "./funnel.js";
import { createTokenBucket, perTickCapacity } from "./buckets.js";

const TZ = "America/Costa_Rica";
const NOW = new Date("2026-06-23T15:00:00Z"); // 09:00 local
const CAMPAIGN = { maxAttemptsPerAccount: 3, maxAttemptsPerDay: 1 };

function acct(id: string, over: Partial<FunnelAccount> = {}): FunnelAccount {
  return {
    portfolioAccountId: id,
    phone: "+50670000000",
    email: null,
    intentStatus: null,
    accountSuppressUntil: null,
    state: null,
    ...over
  };
}

describe("runFunnel", () => {
  it("excludes with the right reasons", () => {
    const accounts: FunnelAccount[] = [
      acct("ok"),
      acct("nophone", { phone: null }),
      acct("optout", { intentStatus: "OPT_OUT" }),
      acct("gsupp", { accountSuppressUntil: new Date("2026-06-24T00:00:00Z") }),
      acct("promise", {
        state: {
          attemptCount: 0,
          attemptsToday: 0,
          lastAttemptAt: null,
          suppressUntil: new Date("2026-06-30T00:00:00Z")
        }
      }),
      acct("lifetime", {
        state: { attemptCount: 3, attemptsToday: 0, lastAttemptAt: null, suppressUntil: null }
      }),
      acct("daily", {
        state: { attemptCount: 1, attemptsToday: 1, lastAttemptAt: NOW, suppressUntil: null }
      })
    ];
    const { eligible, decisions } = runFunnel(CAMPAIGN, accounts, NOW, TZ);

    assert.deepEqual(
      eligible.map((a) => a.portfolioAccountId),
      ["ok"]
    );
    const byId = Object.fromEntries(decisions.map((d) => [d.portfolioAccountId, d.decision]));
    assert.equal(byId.nophone, "no_phone");
    assert.equal(byId.optout, "intent_suppressed");
    assert.equal(byId.gsupp, "account_suppressed");
    assert.equal(byId.promise, "promise_suppressed");
    assert.equal(byId.lifetime, "lifetime_cap");
    assert.equal(byId.daily, "daily_cap");
  });

  it("treats yesterday's attemptsToday as zero (daily reset by local date)", () => {
    const yesterday = new Date("2026-06-22T15:00:00Z");
    const a = acct("y", {
      state: { attemptCount: 1, attemptsToday: 5, lastAttemptAt: yesterday, suppressUntil: null }
    });
    const { eligible } = runFunnel(CAMPAIGN, [a], NOW, TZ);
    assert.deepEqual(
      eligible.map((x) => x.portfolioAccountId),
      ["y"]
    );
  });

  it("orders eligible least-recently-attempted first, nulls first, stable tiebreak", () => {
    const accounts: FunnelAccount[] = [
      acct("b-newer", {
        state: {
          attemptCount: 1,
          attemptsToday: 0,
          lastAttemptAt: new Date("2026-06-20T00:00:00Z"),
          suppressUntil: null
        }
      }),
      acct("a-older", {
        state: {
          attemptCount: 1,
          attemptsToday: 0,
          lastAttemptAt: new Date("2026-06-10T00:00:00Z"),
          suppressUntil: null
        }
      }),
      acct("c-never"),
      acct("a-never")
    ];
    const { eligible } = runFunnel(CAMPAIGN, accounts, NOW, TZ);
    // never-attempted (nulls) first, tie broken by id; then older before newer.
    assert.deepEqual(
      eligible.map((a) => a.portfolioAccountId),
      ["a-never", "c-never", "a-older", "b-newer"]
    );
  });
});

describe("token bucket", () => {
  it("spends down to zero then refuses", () => {
    const b = createTokenBucket(2);
    assert.equal(b.tryTake(), true);
    assert.equal(b.tryTake(), true);
    assert.equal(b.tryTake(), false);
    assert.equal(b.remaining(), 0);
  });

  it("per-tick capacity scales rate by tick length", () => {
    assert.equal(perTickCapacity(60, 60), 60);
    assert.equal(perTickCapacity(60, 30), 30);
    assert.equal(perTickCapacity(6, 60), 6);
    assert.equal(perTickCapacity(0, 60), 0);
  });
});
