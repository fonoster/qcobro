import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BillingClient, BillingConfig } from "@qcobro/common";
import { billingConfigSchema } from "@qcobro/common";
import { assessManualDispatch } from "./manualDispatchGate.js";
import { makeBillingStub } from "./billingStubClient.js";

const billing = billingConfigSchema.parse({
  enabled: true,
  voiceDebitEstimateSeconds: 60,
  plans: [
    {
      key: "starter",
      name: { es: "Inicial" },
      monthlyPrice: 9,
      monthlyAllowance: 9,
      stripePriceId: "price_x",
      rates: {
        sms: { perMessage: 0.008 },
        email: { perMessage: 0.0004 },
        whatsappMessage: { perMessage: 0.01 },
        voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
        voiceAi: { perMinute: 0.4, increments: "15/15" },
        whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
        whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
      }
    }
  ]
});

function stubDb(opts: {
  enrolled?: boolean;
  paymentFailed?: boolean;
  balanceMicro?: number;
}): BillingClient {
  const stub = makeBillingStub({
    workspaceBillings: opts.enrolled === false ? [] : [{}],
    billingAccounts: [{ paymentFailed: opts.paymentFailed ?? false }]
  });
  if (opts.balanceMicro) {
    void stub.client.ledgerEntry.create({
      data: {
        workspaceRef: "ws_1",
        kind: "GRANT",
        amountMicro: BigInt(opts.balanceMicro),
        at: new Date()
      }
    });
  }
  return stub.client;
}

describe("assessManualDispatch", () => {
  it("allows and marks metered when the balance covers the cost", async () => {
    const result = await assessManualDispatch(
      stubDb({ balanceMicro: 10_000 }),
      billing,
      "ws_1",
      "sms"
    );
    assert.deepEqual(result, { kind: "metered", estimatedCostMicro: 8000 });
  });

  it("rejects with insufficient_credits when the balance cannot cover it", async () => {
    const result = await assessManualDispatch(
      stubDb({ balanceMicro: 5000 }),
      billing,
      "ws_1",
      "sms"
    );
    assert.equal(result.kind, "insufficient_credits");
  });

  it("uses the voice estimate (60s at plan rate) for voice meters", async () => {
    const result = await assessManualDispatch(
      stubDb({ balanceMicro: 399_999 }),
      billing,
      "ws_1",
      "voiceAi"
    );
    // 60s at 0.40/min = 400,000 micro > balance.
    assert.equal(result.kind, "insufficient_credits");
  });

  it("suspends on payer dunning, distinct from exhaustion", async () => {
    const result = await assessManualDispatch(
      stubDb({ paymentFailed: true, balanceMicro: 10_000_000 }),
      billing,
      "ws_1",
      "sms"
    );
    assert.equal(result.kind, "payment_failed");
  });

  it("passes unenrolled workspaces and disabled billing through unmetered", async () => {
    assert.deepEqual(
      await assessManualDispatch(stubDb({ enrolled: false }), billing, "ws_1", "sms"),
      { kind: "unmetered" }
    );
    const disabled = { ...billing!, enabled: false } as BillingConfig;
    assert.deepEqual(await assessManualDispatch(stubDb({}), disabled, "ws_1", "sms"), {
      kind: "unmetered"
    });
    assert.deepEqual(await assessManualDispatch(stubDb({}), undefined, "ws_1", "sms"), {
      kind: "unmetered"
    });
  });
});
