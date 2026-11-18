import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecoveryBreakdown } from "./breakdown.js";
import { createRecoverySummary } from "./summary.js";
import { readClient, recovery } from "./fakeDb.js";

const OCT = { from: "2026-10-01", to: "2026-10-31" };

const withCampaigns = (amount: number, campaigns: { id: string; name: string }[], fields = {}) =>
  recovery({
    amount,
    campaignIds: campaigns.map((c) => c.id),
    context: {
      hasGestion: true,
      touches: 1,
      activeCampaigns: campaigns,
      lastTouch: null,
      daysSinceLastTouch: 1
    },
    ...fields
  });

describe("recovery.breakdown", () => {
  const mora = { id: "c1", name: "Mora 8-30 · Voz IA" };
  const sms = { id: "c2", name: "Recordatorio SMS" };

  it("credits a recovery in full to every campaign that touched it, and is not additive", async () => {
    const client = readClient({
      recoveries: [withCampaigns(3000, [mora, sms]), withCampaigns(1000, [mora])]
    });
    const result = await createRecoveryBreakdown(client as never, "ws")({ ...OCT, by: "CAMPAIGN" });
    assert.deepEqual(result, {
      additive: false,
      rows: [
        { key: "c1", name: "Mora 8-30 · Voz IA", amount: 4000, count: 2 },
        { key: "c2", name: "Recordatorio SMS", amount: 3000, count: 1 }
      ]
    });
  });

  it("makes CHANNEL, OUTCOME and DAYS_SINCE_TOUCH each add up to summary.recovered", async () => {
    const client = readClient({
      recoveries: [
        recovery({ amount: 3000, lastTouchAgentType: "VOICE_AI", daysSinceLastTouch: 0 }),
        recovery({
          amount: 1500,
          lastTouchAgentType: "SMS",
          lastTouchOutcome: null,
          daysSinceLastTouch: 5,
          context: {
            hasGestion: true,
            touches: 1,
            activeCampaigns: [],
            daysSinceLastTouch: 5,
            lastTouch: {
              contactLogId: "l",
              agentType: "SMS",
              delivery: "DELIVERED",
              path: "DELIVERED",
              outcome: null,
              contactedAt: "2026-10-10T00:00:00Z"
            }
          }
        }),
        recovery({ amount: 500, lastTouchAgentType: "VOICE_AI", daysSinceLastTouch: 9 }),
        recovery({ amount: 800, hasGestion: false, lastTouchAgentType: null })
      ]
    });
    const { recovered } = await createRecoverySummary(client as never, "ws")(OCT);
    for (const by of ["CHANNEL", "OUTCOME", "DAYS_SINCE_TOUCH"] as const) {
      const result = await createRecoveryBreakdown(client as never, "ws")({ ...OCT, by });
      assert.equal(result.additive, true, by);
      assert.equal(
        result.rows.reduce((s, r) => s + r.amount, 0),
        recovered,
        by
      );
    }
    const channel = await createRecoveryBreakdown(client as never, "ws")({ ...OCT, by: "CHANNEL" });
    assert.deepEqual(channel.rows, [
      { key: "VOICE_AI", name: null, amount: 3500, count: 2 },
      { key: "SMS", name: null, amount: 1500, count: 1 }
    ]);
    const outcome = await createRecoveryBreakdown(client as never, "ws")({ ...OCT, by: "OUTCOME" });
    assert.deepEqual(
      outcome.rows.map((r) => r.key),
      ["PAYMENT_PROMISE", "DELIVERED"]
    );
  });

  it("buckets days since the last touch at 1/2, 3/4 and 7/8", async () => {
    const days = [1, 2, 3, 4, 7, 8];
    const client = readClient({
      recoveries: days.map((d) => recovery({ amount: d, daysSinceLastTouch: d }))
    });
    const result = await createRecoveryBreakdown(
      client as never,
      "ws"
    )({ ...OCT, by: "DAYS_SINCE_TOUCH" });
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r.count]));
    assert.deepEqual(byKey, { "0-1": 1, "2-3": 2, "4-7": 2, "8+": 1 });
  });
});
